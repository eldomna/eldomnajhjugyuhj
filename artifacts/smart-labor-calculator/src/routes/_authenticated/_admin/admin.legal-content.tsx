import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Archive, ArchiveRestore, Trash2, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/legal-content")({
  component: AdminLegalContent,
});

interface LegalItem {
  id: string;
  key: string;
  title: string;
  body: string;
  category: string;
  version: number;
  archived: boolean;
  updated_at: string;
}

function AdminLegalContent() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<LegalItem> | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["legal_content", showArchived],
    queryFn: async () => {
      const q = supabase.from("legal_content").select("*").order("category").order("title");
      const { data, error } = showArchived ? await q : await q.eq("archived", false);
      if (error) throw error;
      return (data ?? []) as LegalItem[];
    },
  });

  const save = useMutation({
    mutationFn: async (item: Partial<LegalItem>) => {
      if (item.id) {
        const { error } = await supabase
          .from("legal_content")
          .update({
            key: item.key,
            title: item.title,
            body: item.body,
            category: item.category,
            version: (item.version ?? 1) + 1,
          })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("legal_content").insert({
          key: item.key!,
          title: item.title!,
          body: item.body!,
          category: item.category || "general",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["legal_content"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleArchive = useMutation({
    mutationFn: async (it: LegalItem) => {
      const { error } = await supabase
        .from("legal_content")
        .update({ archived: !it.archived })
        .eq("id", it.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_content"] });
      toast.success("تم التحديث");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("legal_content").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_content"] });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">إدارة المحتوى القانوني</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? "إخفاء المؤرشف" : "إظهار المؤرشف"}
            </Button>
            <Button size="sm" onClick={() => setEditing({ category: "clause" })} className="gap-1.5">
              <Plus className="h-4 w-4" /> إضافة عنصر
            </Button>
          </div>
        </div>

        {editing && (
          <Card className="p-5 mb-6 border-primary">
            <h3 className="font-bold mb-4">{editing.id ? "تعديل" : "إضافة جديد"}</h3>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <Label className="mb-1.5 block">المعرّف (key)</Label>
                <Input
                  value={editing.key ?? ""}
                  onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                  placeholder="مثال: overtime"
                  dir="ltr"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">التصنيف</Label>
                <Input
                  value={editing.category ?? "clause"}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  placeholder="law / clause / general"
                />
              </div>
            </div>
            <div className="mb-3">
              <Label className="mb-1.5 block">العنوان</Label>
              <Input
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <Label className="mb-1.5 block">النص</Label>
              <Textarea
                value={editing.body ?? ""}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={5}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending || !editing.key || !editing.title || !editing.body}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" /> حفظ
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)} className="gap-1.5">
                <X className="h-4 w-4" /> إلغاء
              </Button>
            </div>
          </Card>
        )}

        <div className="space-y-3">
          {isLoading && <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>}
          {!isLoading && items.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">لا يوجد محتوى بعد</Card>
          )}
          {items.map((it) => (
            <Card key={it.id} className={`p-4 ${it.archived ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold">{it.title}</h3>
                    <Badge variant="secondary">{it.category}</Badge>
                    <Badge variant="outline" className="text-xs">v{it.version}</Badge>
                    {it.archived && <Badge variant="destructive">مؤرشف</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mb-2" dir="ltr">{it.key}</p>
                  <p className="text-sm whitespace-pre-wrap">{it.body}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditing(it)}>
                    تعديل
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => toggleArchive.mutate(it)}
                    title={it.archived ? "استعادة" : "أرشفة"}
                  >
                    {it.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`حذف "${it.title}" نهائياً؟`)) remove.mutate(it.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
