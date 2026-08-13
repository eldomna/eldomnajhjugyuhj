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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/payments")({
  component: AdminPayments,
});

type PMForm = { id?: string; name: string; logo_url: string; account_number: string; account_holder: string; instructions: string; is_active: boolean; sort_order: number };
const empty: PMForm = { name: "", logo_url: "", account_number: "", account_holder: "", instructions: "", is_active: true, sort_order: 0 };

function AdminPayments() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("payment_methods").select("*").order("sort_order");
      return data || [];
    },
  });
  const [editing, setEditing] = useState<PMForm | null>(null);

  const save = useMutation({
    mutationFn: async (f: PMForm) => {
      if (f.id) {
        const { error } = await (supabase as any).from("payment_methods").update(f).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("payment_methods").insert(f);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("تم الحفظ"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-payments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("payment_methods").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-payments"] }); },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">وسائل الدفع</h1></div>
          <Button onClick={() => setEditing(empty)} className="gap-1"><Plus className="h-4 w-4" /> وسيلة جديدة</Button>
        </div>
        <div className="grid gap-3">
          {(data || []).map((m: any) => (
            <Card key={m.id} className="p-4 flex items-center gap-3">
              {m.logo_url ? <img src={m.logo_url} alt="" className="h-10 w-10 object-contain" /> : <div className="h-10 w-10 bg-muted rounded" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><strong>{m.name}</strong>{!m.is_active && <Badge variant="secondary">معطّل</Badge>}</div>
                <div className="text-xs text-muted-foreground font-mono">{m.account_number || "—"}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing({ ...empty, ...m })}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف؟")) del.mutate(m.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </Card>
          ))}
          {(data || []).length === 0 && <p className="text-center text-muted-foreground py-12">لا توجد وسائل دفع.</p>}
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل" : "إضافة"} وسيلة دفع</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Lbl label="الاسم *"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Lbl>
              <Lbl label="رابط الشعار"><Input value={editing.logo_url} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} dir="ltr" className="text-xs" /></Lbl>
              <div className="grid sm:grid-cols-2 gap-3">
                <Lbl label="رقم الحساب"><Input value={editing.account_number} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} dir="ltr" /></Lbl>
                <Lbl label="باسم"><Input value={editing.account_holder} onChange={(e) => setEditing({ ...editing, account_holder: e.target.value })} /></Lbl>
              </div>
              <Lbl label="تعليمات"><Textarea value={editing.instructions} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} rows={3} /></Lbl>
              <div className="grid sm:grid-cols-2 gap-3">
                <Lbl label="ترتيب"><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></Lbl>
                <Lbl label="نشط">
                  <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={editing.is_active ? "1" : "0"} onChange={(e) => setEditing({ ...editing, is_active: e.target.value === "1" })}>
                    <option value="1">نعم</option><option value="0">لا</option>
                  </select>
                </Lbl>
              </div>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending} className="w-full">{save.isPending ? "جارٍ الحفظ..." : "حفظ"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Lbl({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
