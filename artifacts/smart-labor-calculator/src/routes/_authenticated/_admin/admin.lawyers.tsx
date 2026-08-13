import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Scale, Plus, Pencil, Trash2, Check, X, Search, Pause, Play, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GOVERNORATES, SPECIALIZATIONS } from "@/lib/governorates";
import { makeSlug } from "@/lib/slug";
import { LawyerDocsManager } from "@/components/lawyers/LawyerDocsManager";

export const Route = createFileRoute("/_authenticated/_admin/admin/lawyers")({
  component: AdminLawyers,
});

type LawyerForm = {
  id?: string;
  full_name: string; slug: string; photo_url: string; governorate: string; city: string;
  office_name: string; phone: string; whatsapp: string; email: string; bio: string;
  years_experience: number; specializations: string[]; verification_status: string; is_active: boolean;
};

const empty: LawyerForm = {
  full_name: "", slug: "", photo_url: "", governorate: GOVERNORATES[0], city: "",
  office_name: "", phone: "", whatsapp: "", email: "", bio: "",
  years_experience: 0, specializations: [], verification_status: "pending", is_active: true,
};

function AdminLawyers() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-lawyers"],
    queryFn: async () => {
      // Contact columns are not selectable from the table; admins read them
      // through an admin-gated RPC and we merge them in for moderation.
      const [rows, contacts] = await Promise.all([
        (supabase as any)
          .from("lawyers")
          .select(
            "id,user_id,full_name,slug,photo_url,governorate,city,office_name,bio,years_experience,specializations,verification_status,is_active,avg_rating,reviews_count,created_at,updated_at",
          )
          .order("created_at", { ascending: false }),
        (supabase as any).rpc("admin_lawyer_contacts"),
      ]);
      const byId = new Map<string, any>((contacts.data || []).map((c: any) => [c.id, c]));
      return (rows.data || []).map((l: any) => ({ ...l, ...(byId.get(l.id) || {}) }));
    },
  });


  const [editing, setEditing] = useState<LawyerForm | null>(null);

  const save = useMutation({
    mutationFn: async (f: LawyerForm) => {
      const payload = { ...f, slug: f.slug || makeSlug(f.full_name) };
      if (f.id) {
        const { error } = await (supabase as any).from("lawyers").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("lawyers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("تم الحفظ"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-lawyers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("lawyers").update({ verification_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تحديث الحالة"); qc.invalidateQueries({ queryKey: ["admin-lawyers"] }); },
  });

  const setActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from("lawyers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["admin-lawyers"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("lawyers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-lawyers"] }); },
  });

  const [search, setSearch] = useState("");
  const [govFilter, setGovFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = (data || []).filter((l: any) => {
    if (govFilter !== "all" && l.governorate !== govFilter) return false;
    if (statusFilter !== "all" && l.verification_status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${l.full_name} ${l.email || ""} ${l.phone || ""} ${l.city || ""} ${l.office_name || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2"><Scale className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">إدارة المحامين</h1></div>
          <Button onClick={() => setEditing(empty)} className="gap-1"><Plus className="h-4 w-4" /> محامٍ جديد</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px] mb-4">
          <div className="relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الهاتف أو البريد..." value={search} onChange={(e) => setSearch(e.target.value)} className="pe-9" />
          </div>
          <Select value={govFilter} onValueChange={setGovFilter}>
            <SelectTrigger><SelectValue placeholder="المحافظة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المحافظات</SelectItem>
              {GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="pending">بانتظار</SelectItem>
              <SelectItem value="approved">موثّق</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
              <SelectItem value="revoked">ملغى</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3">
          {filtered.map((l: any) => (
            <Card key={l.id} className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-muted grid place-items-center shrink-0">
                {l.photo_url ? <img src={l.photo_url} alt="" className="h-full w-full object-cover" /> : <span className="font-bold">{l.full_name.charAt(0)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="truncate">{l.full_name}</strong>
                  <Badge variant={l.verification_status === "approved" ? "default" : l.verification_status === "rejected" || l.verification_status === "revoked" ? "destructive" : "secondary"}>
                    {l.verification_status === "approved" ? "موثّق" : l.verification_status === "pending" ? "بانتظار" : l.verification_status === "rejected" ? "مرفوض" : "ملغى"}
                  </Badge>
                  {!l.is_active && <Badge variant="outline">معطّل</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{l.governorate} {l.city ? `— ${l.city}` : ""} {l.office_name ? `— ${l.office_name}` : ""}</div>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {l.verification_status !== "approved" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "approved" })} className="gap-1"><Check className="h-3.5 w-3.5" />موافقة</Button>}
                {l.verification_status !== "rejected" && l.verification_status !== "approved" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "rejected" })} className="gap-1"><X className="h-3.5 w-3.5" />رفض</Button>}
                {l.verification_status === "approved" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "revoked" })} className="gap-1"><ShieldOff className="h-3.5 w-3.5" />سحب التوثيق</Button>}
                <Button size="sm" variant="outline" onClick={() => setActive.mutate({ id: l.id, is_active: !l.is_active })} className="gap-1">
                  {l.is_active ? <><Pause className="h-3.5 w-3.5" />تعليق</> : <><Play className="h-3.5 w-3.5" />تفعيل</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...empty, ...l })}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذا المحامي؟")) del.mutate(l.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">لا نتائج.</p>}
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل" : "إضافة"} محامٍ</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="الاسم الكامل *"><Input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value, slug: editing.slug || makeSlug(e.target.value) })} /></Field>
                <Field label="المعرّف (slug)"><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} dir="ltr" className="font-mono text-xs" /></Field>
                <Field label="رابط الصورة"><Input value={editing.photo_url} onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })} dir="ltr" className="text-xs" /></Field>
                <Field label="اسم المكتب"><Input value={editing.office_name} onChange={(e) => setEditing({ ...editing, office_name: e.target.value })} /></Field>
                <Field label="المحافظة *">
                  <Select value={editing.governorate} onValueChange={(v) => setEditing({ ...editing, governorate: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="المدينة"><Input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
                <Field label="الهاتف"><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} dir="ltr" /></Field>
                <Field label="واتساب"><Input value={editing.whatsapp} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} dir="ltr" /></Field>
                <Field label="البريد"><Input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} dir="ltr" /></Field>
                <Field label="سنوات الخبرة"><Input type="number" value={editing.years_experience} onChange={(e) => setEditing({ ...editing, years_experience: parseInt(e.target.value) || 0 })} /></Field>
              </div>
              <Field label="نبذة"><Textarea value={editing.bio} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} rows={3} /></Field>
              <Field label="التخصصات">
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALIZATIONS.map((s) => {
                    const on = editing.specializations.includes(s);
                    return (
                      <button key={s} type="button" onClick={() => setEditing({ ...editing, specializations: on ? editing.specializations.filter(x => x !== s) : [...editing.specializations, s] })}
                        className={`text-xs px-2.5 py-1 rounded-full border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>{s}</button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="حالة التوثيق">
                  <Select value={editing.verification_status} onValueChange={(v) => setEditing({ ...editing, verification_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">بانتظار</SelectItem>
                      <SelectItem value="approved">موثّق</SelectItem>
                      <SelectItem value="rejected">مرفوض</SelectItem>
                      <SelectItem value="revoked">ملغى</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="نشط">
                  <Select value={editing.is_active ? "1" : "0"} onValueChange={(v) => setEditing({ ...editing, is_active: v === "1" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="1">نعم</SelectItem><SelectItem value="0">لا</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>
              {editing.id && <LawyerDocsManager lawyerId={editing.id} />}
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending} className="w-full">{save.isPending ? "جارٍ الحفظ..." : "حفظ"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
