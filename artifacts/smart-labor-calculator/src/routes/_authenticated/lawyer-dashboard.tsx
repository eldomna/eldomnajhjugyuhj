import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { LawyerDocsManager } from "@/components/lawyers/LawyerDocsManager";
import { toast } from "sonner";
import { Star, ShieldCheck, Clock, XCircle, Upload, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lawyer-dashboard")({
  head: () => ({ meta: [{ title: "لوحة المحامي • حقوق العمال" }] }),
  component: LawyerDashboard,
});

type Lawyer = {
  id: string;
  user_id: string;
  full_name: string;
  slug: string;
  photo_url: string | null;
  governorate: string;
  city: string | null;
  office_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  bio: string | null;
  years_experience: number | null;
  specializations: string[] | null;
  verification_status: string;
  is_active: boolean;
  avg_rating: number;
  reviews_count: number;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  is_hidden: boolean;
};

const STATUS_META: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" }> = {
  approved: { label: "موثّق", icon: ShieldCheck, variant: "default" },
  verified: { label: "موثّق", icon: ShieldCheck, variant: "default" },
  pending: { label: "قيد المراجعة", icon: Clock, variant: "secondary" },
  rejected: { label: "مرفوض", icon: XCircle, variant: "destructive" },
};

function LawyerDashboard() {
  const { user } = Route.useRouteContext();
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newSpec, setNewSpec] = useState("");

  // Editable form state
  const [form, setForm] = useState({
    full_name: "",
    governorate: "",
    city: "",
    office_name: "",
    phone: "",
    whatsapp: "",
    email: "",
    bio: "",
    years_experience: "",
    specializations: [] as string[],
  });

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("lawyers")
      .select(
        "id,user_id,full_name,slug,photo_url,governorate,city,office_name,bio,years_experience,specializations,verification_status,is_active,avg_rating,reviews_count,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) toast.error(error.message);
    if (data) {
      // Contact channels are PII and only readable through the gated RPC.
      const { data: contactRows } = await (supabase as any).rpc("get_lawyer_contact", {
        _lawyer_id: data.id,
      });
      const contact = (Array.isArray(contactRows) ? contactRows[0] : contactRows) || {};
      setLawyer({ ...data, ...contact });
      setForm({
        full_name: data.full_name || "",
        governorate: data.governorate || "",
        city: data.city || "",
        office_name: data.office_name || "",
        phone: contact.phone || "",
        whatsapp: contact.whatsapp || "",
        email: contact.email || "",
        bio: data.bio || "",
        years_experience: data.years_experience?.toString() || "",
        specializations: data.specializations || [],
      });

      // Load reviews
      const { data: revs } = await (supabase as any)
        .from("lawyer_reviews")
        .select("id,rating,comment,created_at,is_hidden")
        .eq("lawyer_id", data.id)
        .order("created_at", { ascending: false });
      setReviews(revs || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [user.id]);

  async function saveProfile() {
    if (!lawyer) return;
    if (!form.full_name.trim() || !form.governorate.trim()) {
      toast.error("الاسم والمحافظة مطلوبان");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("lawyers")
      .update({
        full_name: form.full_name.trim(),
        governorate: form.governorate.trim(),
        city: form.city.trim() || null,
        office_name: form.office_name.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        bio: form.bio.trim() || null,
        years_experience: form.years_experience ? parseInt(form.years_experience) : null,
        specializations: form.specializations,
      })
      .eq("id", lawyer.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ التعديلات");
    load();
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !lawyer) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5MB");

    setUploadingPhoto(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${lawyer.id}/photo-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("lawyer-docs").upload(path, file, { upsert: false });
    if (up.error) {
      setUploadingPhoto(false);
      return toast.error(up.error.message);
    }
    const { data: signed } = await supabase.storage
      .from("lawyer-docs")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (!signed) {
      setUploadingPhoto(false);
      return toast.error("تعذّر إنشاء رابط الصورة");
    }
    const { error } = await (supabase as any)
      .from("lawyers")
      .update({ photo_url: signed.signedUrl })
      .eq("id", lawyer.id);
    setUploadingPhoto(false);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث الصورة");
    load();
  }

  function addSpec() {
    const v = newSpec.trim();
    if (!v) return;
    if (form.specializations.includes(v)) return;
    setForm({ ...form, specializations: [...form.specializations, v] });
    setNewSpec("");
  }

  function removeSpec(s: string) {
    setForm({ ...form, specializations: form.specializations.filter((x) => x !== s) });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto px-4 py-10 text-center text-muted-foreground">جارٍ التحميل...</div>
      </div>
    );
  }

  if (!lawyer) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto px-4 py-10 max-w-xl text-center space-y-4">
          <h1 className="text-2xl font-bold">لا يوجد ملف محامي مرتبط بحسابك</h1>
          <p className="text-muted-foreground">إذا كنت محامياً، فضلاً أكمل تسجيلك أولاً.</p>
          <Button asChild>
            <Link to="/lawyer-register">تسجيل محامي جديد</Link>
          </Button>
        </div>
      </div>
    );
  }

  const status = STATUS_META[lawyer.verification_status] || STATUS_META.pending;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Header card: photo + status */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarImage src={lawyer.photo_url || undefined} alt={lawyer.full_name} />
                <AvatarFallback className="text-2xl">{lawyer.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <label className={`absolute -bottom-1 -end-1 inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground cursor-pointer shadow ${uploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="h-4 w-4" />
                <input type="file" hidden accept="image/*" onChange={uploadPhoto} disabled={uploadingPhoto} />
              </label>
            </div>
            <div className="flex-1 text-center sm:text-start space-y-2">
              <h1 className="text-2xl font-bold">{lawyer.full_name}</h1>
              <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                <Badge variant={status.variant} className="gap-1">
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </Badge>
                {!lawyer.is_active && (
                  <Badge variant="outline">غير نشط</Badge>
                )}
                <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                  {lawyer.avg_rating.toFixed(1)} ({lawyer.reviews_count} تقييم)
                </span>
              </div>
              {lawyer.verification_status !== "approved" && lawyer.verification_status !== "verified" && (
                <p className="text-xs text-muted-foreground">
                  ملاحظة: لن يظهر ملفك للعامة حتى يقوم المدير بتوثيق حسابك.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Profile form */}
        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-bold">المعلومات الشخصية والمهنية</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الاسم الكامل *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>الهاتف</Label>
              <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>واتساب</Label>
              <Input dir="ltr" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>المحافظة *</Label>
              <Input value={form.governorate} onChange={(e) => setForm({ ...form, governorate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>المدينة</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>اسم المكتب</Label>
              <Input value={form.office_name} onChange={(e) => setForm({ ...form, office_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>سنوات الخبرة</Label>
              <Input type="number" min="0" value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>السيرة الذاتية</Label>
            <Textarea rows={5} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>

          {/* Specializations */}
          <div className="space-y-2">
            <Label>التخصصات</Label>
            <div className="flex gap-2">
              <Input
                placeholder="مثال: قانون العمل"
                value={newSpec}
                onChange={(e) => setNewSpec(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSpec(); } }}
              />
              <Button type="button" variant="outline" onClick={addSpec}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.specializations.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 pe-1">
                  {s}
                  <button onClick={() => removeSpec(s)} className="hover:bg-destructive/20 rounded p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {form.specializations.length === 0 && (
                <span className="text-xs text-muted-foreground">لم تُضَف تخصصات بعد.</span>
              )}
            </div>
          </div>

          <Separator />
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </div>
        </Card>

        {/* Documents (read + upload only; admin approval done elsewhere) */}
        <Card className="p-5 space-y-3">
          <h2 className="text-lg font-bold">الوثائق</h2>
          <p className="text-xs text-muted-foreground">
            يمكنك رفع الوثائق وحذفها. الاعتماد يتم من قبل المدير فقط.
          </p>
          <LawyerDocsManager lawyerId={lawyer.id} canModerate={false} />
        </Card>

        {/* Reviews */}
        <Card className="p-5 space-y-3">
          <h2 className="text-lg font-bold">التقييمات والمراجعات</h2>
          {reviews.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد.</p>}
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className={`border rounded-md p-3 ${r.is_hidden ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("ar-EG")}
                  </span>
                  {r.is_hidden && <Badge variant="outline" className="text-[10px]">مخفي</Badge>}
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
