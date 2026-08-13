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
import { Megaphone, Plus, Pencil, Trash2, Eye, MousePointerClick, Upload, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

import { toast } from "sonner";
import { GOVERNORATES } from "@/lib/governorates";

export const Route = createFileRoute("/_authenticated/_admin/admin/ads")({
  component: AdminAds,
});

type AdForm = {
  id?: string; title: string; description: string; image_url: string; redirect_url: string;
  governorate: string; position: "hero" | "rotator"; sort_order: number; display_seconds: number;
  starts_at: string; ends_at: string; is_active: boolean;
};
const empty: AdForm = { title: "", description: "", image_url: "", redirect_url: "", governorate: "", position: "hero", sort_order: 0, display_seconds: 10, starts_at: "", ends_at: "", is_active: true };

function AdminAds() {
  const qc = useQueryClient();
  const { data: ads } = useQuery({
    queryKey: ["admin-ads"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("advertisements").select("*").order("sort_order");
      return data || [];
    },
  });
  const { data: stats } = useQuery({
    queryKey: ["ad-stats"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await (supabase as any).from("ad_events").select("ad_id,kind,created_at").gte("created_at", since).limit(20000);
      const perAd: Record<string, { impression: number; click: number }> = {};
      const perDay: Record<string, { impression: number; click: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        perDay[d] = { impression: 0, click: 0 };
      }
      (data || []).forEach((e: any) => {
        if (!perAd[e.ad_id]) perAd[e.ad_id] = { impression: 0, click: 0 };
        perAd[e.ad_id][e.kind as "impression" | "click"]++;
        const d = (e.created_at || "").slice(0, 10);
        if (perDay[d]) perDay[d][e.kind as "impression" | "click"]++;
      });
      const totals = Object.values(perAd).reduce((a, b) => ({ impression: a.impression + b.impression, click: a.click + b.click }), { impression: 0, click: 0 });
      const trend = Object.entries(perDay).map(([date, v]) => ({ date: date.slice(5), ...v }));
      return { perAd, totals, trend };
    },
  });


  const [editing, setEditing] = useState<AdForm | null>(null);

  const save = useMutation({
    mutationFn: async (f: AdForm) => {
      const payload: any = { ...f, governorate: f.governorate || null, starts_at: f.starts_at || null, ends_at: f.ends_at || null, redirect_url: f.redirect_url || null, description: f.description || null };
      if (f.id) {
        const { error } = await (supabase as any).from("advertisements").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("advertisements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("تم الحفظ"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-ads"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from("advertisements").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["admin-ads"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      // Fetch the row first so we can clean up its storage object too.
      const { data: row } = await (supabase as any)
        .from("advertisements").select("image_url").eq("id", id).maybeSingle();
      const { error } = await (supabase as any).from("advertisements").delete().eq("id", id);
      if (error) throw error;
      const path = storagePathOf(row?.image_url);
      if (path) await supabase.storage.from("ad-banners").remove([path]);
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-ads"] }); },
  });

  const [uploading, setUploading] = useState(false);
  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editing) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const up = await supabase.storage.from("ad-banners").upload(path, file, { upsert: false, contentType: file.type });
    if (up.error) { setUploading(false); return toast.error(up.error.message); }
    // Replacing an existing upload? remove the previous object.
    const prev = storagePathOf(editing.image_url);
    if (prev) supabase.storage.from("ad-banners").remove([prev]).then(() => {});
    // Bucket is private; store a stable path marker. The homepage slider
    // resolves it to a short-lived signed URL on render.
    setEditing({ ...editing, image_url: `ad-banners/${path}` });
    setUploading(false);
    toast.success("تم رفع الصورة");
  }



  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2"><Megaphone className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">إدارة الإعلانات</h1></div>
          <Button onClick={() => setEditing(empty)} className="gap-1"><Plus className="h-4 w-4" /> إعلان جديد</Button>
        </div>


        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">المشاهدات (٧ أيام)</div>
            <div className="text-2xl font-bold flex items-center gap-2 mt-1"><Eye className="h-5 w-5 text-primary" />{stats?.totals.impression ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">النقرات (٧ أيام)</div>
            <div className="text-2xl font-bold flex items-center gap-2 mt-1"><MousePointerClick className="h-5 w-5 text-primary" />{stats?.totals.click ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">معدّل النقر (CTR)</div>
            <div className="text-2xl font-bold mt-1">{stats?.totals.impression ? ((stats.totals.click / stats.totals.impression) * 100).toFixed(1) + "%" : "—"}</div>
          </Card>
        </div>

        <Card className="p-4 mb-6">
          <div className="text-sm font-semibold mb-3">آخر ٧ أيام</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="impression" name="مشاهدات" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="click" name="نقرات" stroke="hsl(var(--destructive))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid gap-3">

          {(ads || []).map((a: any) => {
            const s = stats?.perAd[a.id] || { impression: 0, click: 0 };
            return (
              <Card key={a.id} className="p-3 flex items-center gap-3">
                <AdImg raw={a.image_url} className="h-14 w-24 object-cover rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="truncate">{a.title}</strong>
                    <Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "نشط" : "معطّل"}</Badge>
                    <Badge variant="outline">{a.position === "hero" ? "رئيسي" : "دوار"}</Badge>
                    {a.governorate && <Badge variant="outline">{a.governorate}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{s.impression}</span>
                    <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{s.click}</span>
                    {s.impression > 0 && <span>CTR: {((s.click / s.impression) * 100).toFixed(1)}%</span>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: a.id, is_active: !a.is_active })} title={a.is_active ? "تعطيل" : "تفعيل"}><Power className={`h-4 w-4 ${a.is_active ? "text-primary" : "text-muted-foreground"}`} /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...empty, ...a, description: a.description || "", governorate: a.governorate || "", display_seconds: a.display_seconds ?? 10, starts_at: a.starts_at?.slice(0,16) || "", ends_at: a.ends_at?.slice(0,16) || "" })}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف؟")) del.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </Card>
            );
          })}
          {(ads || []).length === 0 && <p className="text-center text-muted-foreground py-12">لا توجد إعلانات.</p>}
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل" : "إضافة"} إعلان</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <F label="العنوان *"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></F>
              <F label="الوصف"><Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></F>
              <F label="صورة الإعلان *">
                <div className="flex gap-2 items-start">
                  <Input value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} dir="ltr" className="text-xs" placeholder="ارفع صورة أو ألصق رابطاً" />
                  <label className={`inline-flex items-center gap-1 px-3 h-9 rounded-md text-xs font-medium border bg-primary text-primary-foreground cursor-pointer shrink-0 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="h-3.5 w-3.5" />{uploading ? "جارٍ..." : "رفع"}
                    <input type="file" hidden accept="image/*" onChange={uploadImage} disabled={uploading} />
                  </label>
                </div>
                {editing.image_url && <AdImg raw={editing.image_url} className="mt-2 w-full h-28 object-cover rounded border" />}
              </F>
              <F label="رابط النقر"><Input value={editing.redirect_url} onChange={(e) => setEditing({ ...editing, redirect_url: e.target.value })} dir="ltr" className="text-xs" /></F>
              <div className="grid sm:grid-cols-2 gap-3">
                <F label="الموضع">
                  <Select value={editing.position} onValueChange={(v: any) => setEditing({ ...editing, position: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="hero">رئيسي (Hero)</SelectItem><SelectItem value="rotator">دوار (Rotator)</SelectItem></SelectContent>
                  </Select>
                </F>
                <F label="ترتيب"><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></F>
                <F label="مدة العرض (ثواني)"><Input type="number" min={2} max={120} value={editing.display_seconds} onChange={(e) => setEditing({ ...editing, display_seconds: Math.max(2, Math.min(120, parseInt(e.target.value) || 10)) })} /></F>
                <F label="المحافظة المستهدفة">
                  <Select value={editing.governorate || "_all"} onValueChange={(v) => setEditing({ ...editing, governorate: v === "_all" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent><SelectItem value="_all">جميع المحافظات</SelectItem>{GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="نشط">
                  <Select value={editing.is_active ? "1" : "0"} onValueChange={(v) => setEditing({ ...editing, is_active: v === "1" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="1">نعم</SelectItem><SelectItem value="0">لا</SelectItem></SelectContent>
                  </Select>
                </F>
                <F label="تاريخ البدء"><Input type="datetime-local" value={editing.starts_at} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} /></F>
                <F label="تاريخ الانتهاء"><Input type="datetime-local" value={editing.ends_at} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })} /></F>
              </div>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending} className="w-full">{save.isPending ? "جارٍ الحفظ..." : "حفظ"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
function AdImg({ raw, className }: { raw: string; className?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    if (!raw) { setSrc(""); return; }
    const m = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/ad-banners\/([^?#]+)/);
    const path = m ? decodeURIComponent(m[1]) : raw.startsWith("ad-banners/") ? raw.slice("ad-banners/".length) : null;
    if (!path) { setSrc(raw); return; }
    let cancelled = false;
    supabase.storage.from("ad-banners").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setSrc(data?.signedUrl || raw);
    });
    return () => { cancelled = true; };
  }, [raw]);
  return <img src={src} alt="" className={className} />;
}

function storagePathOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/ad-banners\/([^?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (raw.startsWith("ad-banners/")) return raw.slice("ad-banners/".length);
  return null;
}
