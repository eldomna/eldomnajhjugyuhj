import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createBackupSnapshot } from "@/lib/backups.functions";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, Download, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/backups")({
  component: BackupsPage,
});

function downloadJson(name: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function BackupsPage() {
  const qc = useQueryClient();
  const createSnapshot = useServerFn(createBackupSnapshot);
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "backups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backups")
        .select("id, table_name, row_count, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const runBackup = async () => {
    setRunning(true);
    try {
      const res = await createSnapshot();
      toast.success(`تم إنشاء نسخة احتياطية لـ ${res.results.length} جدول`);
      qc.invalidateQueries({ queryKey: ["admin", "backups"] });
    } catch (e) {
      toast.error("فشل إنشاء النسخة الاحتياطية");
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const downloadBackup = async (id: string, table: string, created: string) => {
    const { data, error } = await supabase.from("backups").select("snapshot").eq("id", id).single();
    if (error || !data) return toast.error("تعذر التنزيل");
    const date = new Date(created).toISOString().slice(0, 10);
    downloadJson(`${table}-${date}.json`, data.snapshot);
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذه النسخة؟")) return;
    const { error } = await supabase.from("backups").delete().eq("id", id);
    if (error) return toast.error("تعذر الحذف");
    qc.invalidateQueries({ queryKey: ["admin", "backups"] });
  };

  // Group by created_at date
  const groups = (data ?? []).reduce<Record<string, typeof data>>((acc, b) => {
    const key = new Date(b.created_at).toLocaleString("ar");
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(b);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">النسخ الاحتياطية</h1>
          </div>
          <Button onClick={runBackup} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Plus className="h-4 w-4 ml-1" />}
            إنشاء نسخة الآن
          </Button>
        </div>

        <Card className="p-4 mb-6 text-sm text-muted-foreground">
          يتم الاحتفاظ بآخر 30 يومًا من النسخ. كل نسخة عبارة عن لقطة JSON يمكن تنزيلها واستعادتها يدويًا.
        </Card>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : Object.keys(groups).length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
            لا توجد نسخ احتياطية بعد
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([date, items]) => (
              <div key={date}>
                <h3 className="text-sm font-bold mb-2 text-muted-foreground">{date}</h3>
                <Card className="divide-y">
                  {items!.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3">
                      <div>
                        <div className="font-medium">{b.table_name}</div>
                        <div className="text-xs text-muted-foreground">{b.row_count.toLocaleString("ar")} سجل</div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => downloadBackup(b.id, b.table_name, b.created_at)} title="تنزيل">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(b.id)} title="حذف">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
