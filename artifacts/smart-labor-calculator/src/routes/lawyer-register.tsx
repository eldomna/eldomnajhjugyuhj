import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Scale, Upload, ArrowRight, CheckCircle2, ShieldCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import { GOVERNORATES, SPECIALIZATIONS } from "@/lib/governorates";
import { makeSlug } from "@/lib/slug";

export const Route = createFileRoute("/lawyer-register")({
  head: () => ({
    meta: [
      { title: "تسجيل محامي • حاسبة العمال الذكية" },
      { name: "description", content: "سجّل حساب محامي مهني، أرفق وثائقك، وانتظر اعتماد المنصة لظهور ملفك في الدليل العام." },
      { property: "og:title", content: "تسجيل محامي • حاسبة العمال الذكية" },
      { property: "og:description", content: "نموذج تسجيل المحامين: بيانات شخصية ومهنية ووثائق الترخيص للمراجعة من إدارة المنصة." },
    ],
  }),
  component: LawyerRegisterPage,
});

const DOC_KINDS = [
  { value: "license", label: "ترخيص مزاولة المحاماة" },
  { value: "professional", label: "البطاقة المهنية / شهادة النقابة" },
  { value: "other", label: "وثيقة تحقّق إضافية" },
] as const;

const accountSchema = z.object({
  full_name: z.string().trim().min(3, "الاسم قصير").max(120),
  email: z.string().trim().email("بريد غير صحيح").max(255),
  phone: z.string().trim().regex(/^\+?[0-9 \-]{7,20}$/, "رقم جوال غير صحيح"),
  whatsapp: z.string().trim().regex(/^\+?[0-9 \-]{7,20}$/, "رقم واتساب غير صحيح").or(z.literal("")),
  national_id: z.string().trim().max(40).or(z.literal("")),
  governorate: z.string().min(2, "اختر المحافظة"),
  city: z.string().trim().max(80).or(z.literal("")),
  office_name: z.string().trim().max(120).or(z.literal("")),
  years_experience: z.coerce.number().int().min(0).max(70),
  bio: z.string().trim().max(2000).or(z.literal("")),
  password: z.string().min(8, "8 أحرف على الأقل").max(72)
    .regex(/[A-Za-z]/, "أحرف وأرقام مطلوبة").regex(/[0-9]/, "أحرف وأرقام مطلوبة"),
});

type DocFile = { kind: typeof DOC_KINDS[number]["value"]; file: File };

function LawyerRegisterPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Account
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [national_id, setNationalId] = useState("");

  // Professional
  const [governorate, setGovernorate] = useState<string>("");
  const [city, setCity] = useState("");
  const [office_name, setOfficeName] = useState("");
  const [years_experience, setYears] = useState<number>(0);
  const [bio, setBio] = useState("");
  const [specializations, setSpecs] = useState<string[]>([]);

  // Media
  const [photo, setPhoto] = useState<File | null>(null);
  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [agree, setAgree] = useState(false);

  // Redirect already-signed-in users away from public signup
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  function toggleSpec(name: string) {
    setSpecs((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
  }

  function addDoc(kind: DocFile["kind"], file: File | null) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("الحد الأقصى لكل ملف 10MB");
    setDocs((d) => [...d, { kind, file }]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (password !== confirm) return toast.error("كلمتا المرور غير متطابقتين");
    if (!agree) return toast.error("الرجاء الموافقة على الشروط");
    if (specializations.length === 0) return toast.error("اختر تخصصاً واحداً على الأقل");
    if (docs.length === 0) return toast.error("أرفق وثيقة الترخيص على الأقل");
    const parsed = accountSchema.safeParse({
      full_name, email, phone, whatsapp, national_id, governorate, city,
      office_name, years_experience, bio, password,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    try {
      // 1) Create the auth account. The handle_new_user trigger inserts profiles + user_roles('user').
      const { data: signUp, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name, mobile_number: phone },
        },
      });
      if (signErr) throw signErr;

      // 2) Ensure a session for RLS-scoped inserts (account creation may not auto-sign-in
      //    when email confirmation is required).
      if (!signUp.session) {
        const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
        if (siErr) throw new Error("تم إنشاء الحساب — يرجى تأكيد البريد ثم متابعة التسجيل");
      }
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("تعذّر إنشاء الجلسة");

      // 3) Grant the lawyer role (in addition to the default 'user' role).
      await supabase.from("user_roles").insert({ user_id: userId, role: "lawyer" as never });

      // 4) Create the lawyer profile in pending state. Public listing filters on
      //    verification_status='approved' AND is_active=true, so it stays hidden.
      const slug = `${makeSlug(full_name)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: lawyerRow, error: lwErr } = await supabase
        .from("lawyers")
        .insert({
          user_id: userId,
          full_name,
          slug,
          governorate,
          city: city || null,
          office_name: office_name || null,
          phone: phone || null,
          whatsapp: whatsapp || null,
          email,
          bio: bio || null,
          years_experience,
          specializations,
          verification_status: "pending",
          is_active: false,
        })
        .select("id")
        .single();
      if (lwErr || !lawyerRow) throw lwErr ?? new Error("تعذّر إنشاء ملف المحامي");
      const lawyerId = lawyerRow.id;

      // 5) Upload profile photo (optional). Stored under <lawyer_id>/ so storage RLS
      //    treats it as owned by this lawyer. We keep a long-lived signed URL in
      //    photo_url so the public directory can render it once the lawyer is approved.
      if (photo) {
        const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${lawyerId}/photo.${ext}`;
        const up = await supabase.storage.from("lawyer-docs").upload(path, photo, {
          upsert: true,
          contentType: photo.type || "image/jpeg",
        });
        if (!up.error) {
          // 10 years signed URL; admins can refresh on approval if needed.
          const { data: signed } = await supabase.storage
            .from("lawyer-docs")
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
          if (signed?.signedUrl) {
            await supabase.from("lawyers").update({ photo_url: signed.signedUrl }).eq("id", lawyerId);
          }
        }
      }

      // 6) Upload verification documents and register each in lawyer_documents
      //    with status 'pending' for admin review.
      for (const d of docs) {
        const ts = Date.now();
        const ext = d.file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${lawyerId}/${d.kind}-${ts}.${ext}`;
        const up = await supabase.storage.from("lawyer-docs").upload(path, d.file, {
          upsert: false,
          contentType: d.file.type || "application/octet-stream",
        });
        if (up.error) continue;
        await supabase.from("lawyer_documents").insert({
          lawyer_id: lawyerId,
          kind: d.kind,
          file_url: path,
          status: "pending",
        });
      }

      setDone(true);
      toast.success("تم إرسال طلب التسجيل بنجاح");
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || "حدث خطأ غير متوقع");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-lg w-full p-8 text-center space-y-4 card-elev">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">تم استلام طلب التسجيل</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            حساب المحامي الخاص بك في حالة <span className="font-semibold text-foreground">«قيد التحقق»</span>.
            ستراجع إدارة المنصة وثائقك خلال أيام عمل قليلة، ولن يظهر ملفك في الدليل العام قبل الاعتماد.
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Button asChild>
              <Link to="/dashboard">لوحة حسابي</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/lawyers">دليل المحامين</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <Scale className="h-5 w-5 text-primary" /> حاسبة العمال الذكية
          </Link>
          <Link to="/auth" className="text-sm text-primary inline-flex items-center gap-1">
            لديك حساب؟ سجّل الدخول <ArrowRight className="h-4 w-4 rotate-180" />
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <Badge variant="secondary" className="mb-2">للمحامين</Badge>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">تسجيل محامي جديد</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            أنشئ حساب المحامي الخاص بك وأرفق وثائق الترخيص. لن يظهر ملفك في الدليل العام إلا بعد اعتماد الإدارة.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Section 1: Account */}
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">معلومات الحساب</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">الاسم الكامل *</Label>
                <Input id="full_name" required value={full_name} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">البريد الإلكتروني *</Label>
                <Input id="email" type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">رقم الجوال *</Label>
                <Input id="phone" required dir="ltr" placeholder="+9677XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">رقم واتساب</Label>
                <Input id="whatsapp" dir="ltr" placeholder="+9677XXXXXXXX" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nid">رقم الهوية الوطنية (اختياري)</Label>
                <Input id="nid" dir="ltr" value={national_id} onChange={(e) => setNationalId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="photo">الصورة الشخصية</Label>
                <div className="flex items-center gap-3">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="h-12 w-12 rounded-full object-cover border" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted border" />
                  )}
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.size > 5 * 1024 * 1024) return toast.error("الصورة يجب ألا تتجاوز 5MB");
                      setPhoto(f ?? null);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd">كلمة المرور *</Label>
                <Input id="pwd" type="password" required dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd2">تأكيد كلمة المرور *</Label>
                <Input id="pwd2" type="password" required dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>
          </Card>

          {/* Section 2: Professional */}
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">المعلومات المهنية</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>المحافظة *</Label>
                <Select value={governorate} onValueChange={setGovernorate}>
                  <SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger>
                  <SelectContent>
                    {GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">المدينة</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="office">اسم المكتب</Label>
                <Input id="office" value={office_name} onChange={(e) => setOfficeName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yrs">سنوات الخبرة</Label>
                <Input
                  id="yrs"
                  type="number"
                  min={0}
                  max={70}
                  dir="ltr"
                  value={years_experience}
                  onChange={(e) => setYears(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>التخصصات *</Label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((s) => {
                  const active = specializations.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpec(s)}
                      className={
                        "px-3 py-1.5 rounded-full text-sm border transition " +
                        (active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-muted")
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">نبذة شخصية</Label>
              <Textarea
                id="bio"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="خبرتك المهنية، اللغات، أبرز القضايا..."
              />
            </div>
          </Card>

          {/* Section 3: Documents */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">وثائق التحقّق</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              أرفق نسخة واضحة من ترخيص مزاولة المحاماة، البطاقة المهنية، وأي وثيقة داعمة. الملفات سرّية ولا يطّلع عليها سوى فريق المراجعة.
            </p>
            <div className="space-y-2">
              {DOC_KINDS.map((k) => (
                <label key={k.value} className="flex items-center gap-3 rounded-lg border bg-card p-3 cursor-pointer hover:bg-muted/40">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">{k.label}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      addDoc(k.value, e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                  <span className="text-xs text-primary">اختر ملف</span>
                </label>
              ))}
            </div>
            {docs.length > 0 && (
              <ul className="space-y-1.5">
                {docs.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm bg-muted/40 rounded-md px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{DOC_KINDS.find((k) => k.value === d.kind)?.label} — {d.file.name}</span>
                    <button
                      type="button"
                      onClick={() => setDocs((arr) => arr.filter((_, idx) => idx !== i))}
                      className="text-xs text-destructive"
                    >
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agree} onCheckedChange={(v) => setAgree(Boolean(v))} className="mt-0.5" />
              <span className="text-muted-foreground">
                أتعهّد بصحة البيانات والوثائق المرفقة، وأوافق على
                <Link to="/terms" className="text-primary underline mx-1">شروط الاستخدام</Link>
                و
                <Link to="/privacy" className="text-primary underline mx-1">سياسة الخصوصية</Link>.
              </span>
            </label>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "جارٍ الإرسال..." : "إرسال طلب التسجيل"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              سيخضع الحساب لمراجعة الإدارة قبل ظهوره في الدليل العام.
            </p>
          </Card>
        </form>
      </main>
    </div>
  );
}
