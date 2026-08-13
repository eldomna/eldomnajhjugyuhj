import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { makeSlug } from "@/lib/slug";

export const Route = createFileRoute("/_authenticated/_admin/admin/knowledge")({
  component: AdminKnowledge,
});

type ArtForm = { id?: string; category_id: string | null; title: string; slug: string; excerpt: string; body: string; is_published: boolean; seo_title: string; seo_description: string };
const empty: ArtForm = { category_id: null, title: "", slug: "", excerpt: "", body: "", is_published: false, seo_title: "", seo_description: "" };

function AdminKnowledge() {
  const qc = useQueryClient();
  const { data: cats } = useQuery({
    queryKey: ["admin-cats"],
    queryFn: async () => { const { data } = await (supabase as any).from("knowledge_categories").select("*").order("sort_order"); return data || []; },
  });
  const { data: arts } = useQuery({
    queryKey: ["admin-arts"],
    queryFn: async () => { const { data } = await (supabase as any).from("knowledge_articles").select("*").order("created_at", { ascending: false }); return data || []; },
  });
  const [editing, setEditing] = useState<ArtForm | null>(null);
  const [newCat, setNewCat] = useState("");

  const addCat = useMutation({
    mutationFn: async (name: string) => { const { error } = await (supabase as any).from("knowledge_categories").insert({ name, slug: makeSlug(name) }); if (error) throw error; },
    onSuccess: () => { setNewCat(""); qc.invalidateQueries({ queryKey: ["admin-cats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (f: ArtForm) => {
      const payload = { ...f, slug: f.slug || makeSlug(f.title) };
      if (f.id) { const { error } = await (supabase as any).from("knowledge_articles").update(payload).eq("id", f.id); if (error) throw error; }
      else { const { error } = await (supabase as any).from("knowledge_articles").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success("تم الحفظ"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-arts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("knowledge_articles").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-arts"] }); },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">المعرفة القانونية</h1></div>
          <Button onClick={() => setEditing(empty)} className="gap-1"><Plus className="h-4 w-4" /> مقال جديد</Button>
        </div>

        <Card className="p-4 mb-6">
          <Label className="mb-2 block text-sm font-bold">التصنيفات</Label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(cats || []).map((c: any) => <Badge key={c.id} variant="secondary">{c.name}</Badge>)}
          </div>
          <div className="flex gap-2">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="اسم تصنيف جديد" />
            <Button onClick={() => newCat.trim() && addCat.mutate(newCat.trim())} disabled={!newCat.trim()}>إضافة</Button>
          </div>
        </Card>

        <div className="grid gap-3">
          {(arts || []).map((a: any) => (
            <Card key={a.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><strong className="truncate">{a.title}</strong>{!a.is_published && <Badge variant="secondary">مسودة</Badge>}</div>
                <div className="text-xs text-muted-foreground font-mono">/{a.slug}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing({ ...empty, ...a, seo_title: a.seo_title || "", seo_description: a.seo_description || "" })}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف؟")) del.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </Card>
          ))}
          {(arts || []).length === 0 && <p className="text-center text-muted-foreground py-12">لا توجد مقالات.</p>}
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل" : "إضافة"} مقال</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <K label="العنوان *"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing.slug || makeSlug(e.target.value) })} /></K>
              <K label="المعرّف (slug)"><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} dir="ltr" className="font-mono text-xs" /></K>
              <K label="التصنيف">
                <Select value={editing.category_id || "_none"} onValueChange={(v) => setEditing({ ...editing, category_id: v === "_none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent><SelectItem value="_none">بدون</SelectItem>{(cats || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </K>
              <K label="ملخص"><Textarea value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} rows={2} maxLength={300} /></K>
              <K label="المحتوى *"><Textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={10} /></K>
              <div className="grid sm:grid-cols-2 gap-3">
                <K label="SEO Title"><Input value={editing.seo_title} onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })} /></K>
                <K label="نشر">
                  <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={editing.is_published ? "1" : "0"} onChange={(e) => setEditing({ ...editing, is_published: e.target.value === "1" })}>
                    <option value="0">مسودة</option><option value="1">منشور</option>
                  </select>
                </K>
              </div>
              <K label="SEO Description"><Textarea value={editing.seo_description} onChange={(e) => setEditing({ ...editing, seo_description: e.target.value })} rows={2} maxLength={160} /></K>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending} className="w-full">{save.isPending ? "جارٍ الحفظ..." : "حفظ"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function K({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
