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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Plus, Pencil, Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { LegalReference } from "@/hooks/useLegalReferences";

export const Route = createFileRoute("/_authenticated/_admin/admin/legal-references")({
  component: AdminLegalReferences,
});

type Form = Omit<LegalReference, "id" | "approved_by" | "last_review_date"> & {
  id?: string;
};
const empty: Form = {
  article_number: "",
  title: "",
  summary: "",
  approval_status: "pending",
  sort_order: 0,
};

function AdminLegalReferences() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Form | null>(null);

  const { data: refs } = useQuery({
    queryKey: ["admin-legal-references"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("legal_references")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as LegalReference[];
    },
  });

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const payload: any = { ...f };
      if (f.approval_status === "approved") {
        const { data: u } = await supabase.auth.getUser();
        payload.approved_by = u.user?.id ?? null;
        payload.last_review_date = new Date().toISOString();
      }
      if (f.id) {
        const { error } = await (supabase as any).from("legal_references").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("legal_references").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-legal-references"] });
      qc.invalidateQueries({ queryKey: ["legal-references", "approved"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" | "pending" }) => {
      const patch: any = { approval_status: status };
      if (status === "approved") {
        const { data: u } = await supabase.auth.getUser();
        patch.approved_by = u.user?.id ?? null;
        patch.last_review_date = new Date().toISOString();
      }
      const { error } = await (supabase as any).from("legal_references").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["admin-legal-references"] });
      qc.invalidateQueries({ queryKey: ["legal-references", "approved"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("legal_references").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["admin-legal-references"] });
      qc.invalidateQueries({ queryKey: ["legal-references", "approved"] });
    },
  });

  const statusBadge = (s: string) =>
    s === "approved" ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> معتمد</Badge>
    : s === "rejected" ? <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> مرفوض</Badge>
    : <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> قيد المراجعة</Badge>;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">المراجع القانونية</h1></div>
          <Button onClick={() => setEditing(empty)} className="gap-1"><Plus className="h-4 w-4" /> مرجع جديد</Button>
        </div>
        <Card className="p-4 mb-6 bg-muted/40">
          <p className="text-sm text-muted-foreground">
            المراجع المعتمدة فقط هي التي تظهر للمستخدمين في الحاسبة وتقارير PDF وصيغ المطالبات.
            المراجع غير المعتمدة لا تُعرض ويظهر بدلاً منها نص: «مرجع قانوني قيد المراجعة من إدارة المنصة».
          </p>
        </Card>

        <div className="grid gap-3">
          {(refs || []).map((r) => (
            <Card key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {r.article_number && r.article_number !== "—" && <Badge variant="outline">المادة {r.article_number}</Badge>}
                  <strong className="truncate">{r.title}</strong>
                  {statusBadge(r.approval_status)}
                </div>
                <p className="text-sm text-muted-foreground">{r.summary}</p>
                {r.last_review_date && <p className="text-xs text-muted-foreground mt-1">آخر مراجعة: {new Date(r.last_review_date).toLocaleDateString("ar-EG")}</p>}
              </div>
              <div className="flex gap-1">
                {r.approval_status !== "approved" && (
                  <Button size="sm" variant="ghost" title="اعتماد" onClick={() => setStatus.mutate({ id: r.id, status: "approved" })}><CheckCircle2 className="h-4 w-4 text-green-600" /></Button>
                )}
                {r.approval_status !== "rejected" && (
                  <Button size="sm" variant="ghost" title="رفض" onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })}><XCircle className="h-4 w-4 text-destructive" /></Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, article_number: r.article_number, title: r.title, summary: r.summary, approval_status: r.approval_status, sort_order: r.sort_order })}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف؟")) del.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </Card>
          ))}
          {(refs || []).length === 0 && <p className="text-center text-muted-foreground py-12">لا توجد مراجع قانونية بعد.</p>}
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل" : "إضافة"} مرجع قانوني</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1"><Label className="mb-1.5 block text-xs">رقم المادة</Label><Input value={editing.article_number} onChange={(e) => setEditing({ ...editing, article_number: e.target.value })} placeholder="مثل: 66" /></div>
                <div className="col-span-2"><Label className="mb-1.5 block text-xs">الترتيب</Label><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div><Label className="mb-1.5 block text-xs">العنوان *</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label className="mb-1.5 block text-xs">الملخص *</Label><Textarea rows={3} value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} /></div>
              <div>
                <Label className="mb-1.5 block text-xs">حالة الاعتماد</Label>
                <Select value={editing.approval_status} onValueChange={(v: any) => setEditing({ ...editing, approval_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد المراجعة</SelectItem>
                    <SelectItem value="approved">معتمد</SelectItem>
                    <SelectItem value="rejected">مرفوض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.title || !editing.summary} className="w-full">
                {save.isPending ? "جارٍ الحفظ..." : "حفظ"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
