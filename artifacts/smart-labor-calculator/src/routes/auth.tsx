import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Loader2 } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";

import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول • حاسبة العمال الذكية" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساباً لحفظ حساباتك وتنزيل تقاريرك." },
    ],
  }),
  component: AuthPage,
});

const COUNTRIES = {
  SA: { label: "المملكة العربية السعودية", dial: "+966", pattern: /^5[0-9]{8}$/, hint: "5XXXXXXXX", flag: "🇸🇦" },
  YE: { label: "الجمهورية اليمنية", dial: "+967", pattern: /^7[0-9]{8}$/, hint: "7XXXXXXXX", flag: "🇾🇪" },
} as const;
type CountryCode = keyof typeof COUNTRIES;

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "الاسم قصير").max(100),
  email: z.string().trim().email("بريد غير صحيح").max(255),
  mobile: z.string().trim().regex(/^\+?[0-9 \-]{7,20}$/, "رقم جوال غير صحيح"),
  password: z.string().min(8, "8 أحرف على الأقل").max(72)
    .regex(/[A-Za-z]/, "أحرف وأرقام مطلوبة").regex(/[0-9]/, "أحرف وأرقام مطلوبة"),
});


function translateAuthError(msg: string, code?: string): string {
  const m = (msg || "").toLowerCase();
  const c = (code || "").toLowerCase();
  if (c === "email_not_confirmed" || m.includes("email not confirmed") || m.includes("not confirmed"))
    return "لم يتم تأكيد البريد الإلكتروني بعد. افتح بريدك واضغط رابط التأكيد ثم أعد تسجيل الدخول.";
  if (c === "invalid_credentials" || m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "كلمة المرور غير صحيحة أو الحساب غير موجود. تأكد من البيانات أو أنشئ حساباً جديداً.";
  if (c === "user_not_found" || m.includes("user not found")) return "الحساب غير موجود. الرجاء إنشاء حساب جديد.";
  if (m.includes("user already registered") || m.includes("already exists") || c === "user_already_exists")
    return "هذا البريد مسجّل مسبقاً. سجّل دخولك أو استخدم استعادة كلمة المرور.";
  if (m.includes("password should be") || c === "weak_password")
    return "كلمة المرور لا تستوفي المتطلبات (8 أحرف على الأقل، حروف وأرقام).";
  if (m.includes("rate limit") || m.includes("too many") || c === "over_request_rate_limit")
    return "محاولات كثيرة، الرجاء الانتظار قليلاً قبل المحاولة مجدداً.";
  if (m.includes("network") || m.includes("fetch")) return "تعذّر الاتصال بالخادم. تأكد من الإنترنت وأعد المحاولة.";
  if (c === "unexpected_failure" || m.includes("database error") || !msg || msg.trim() === "{}")
    return "تعذّر إنشاء الحساب حالياً. تأكد من صحة البيانات (البريد ورقم الجوال) ثم أعد المحاولة.";
  return msg || "حدث خطأ غير متوقع. أعد المحاولة.";
}


function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // form fields
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<CountryCode>("YE");
  const [localMobile, setLocalMobile] = useState("");
  const mobile = COUNTRIES[country].dial + localMobile.replace(/[^0-9]/g, "");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [referral, setReferral] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      setReferral(ref.toUpperCase());
      setMode("signup");
    }
  }, []);


  useEffect(() => {
    setFormError(null);
  }, [mode]);

  const fail = (msg: string) => {
    setFormError(msg);
    toast.error(msg);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/select-country", replace: true });
    });
  }, [navigate]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) return fail(translateAuthError(error.message, (error as { code?: string }).code));
    toast.success("أهلاً بعودتك");
    navigate({ to: "/select-country", replace: true });
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (password !== confirm) return fail("كلمتا المرور غير متطابقتين");
    if (!agree) return fail("الرجاء الموافقة على سياسة الخصوصية والشروط");
    const digits = localMobile.replace(/[^0-9]/g, "");
    if (!COUNTRIES[country].pattern.test(digits))
      return fail(`رقم الجوال غير صحيح لـ${COUNTRIES[country].label}. الصيغة: ${COUNTRIES[country].dial} ${COUNTRIES[country].hint}`);
    const parsed = signupSchema.safeParse({ full_name, email: email.trim(), mobile, password });
    if (!parsed.success) return fail(parsed.error.issues[0].message);


    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name, mobile_number: mobile, country },
      },
    });
    if (error) {
      setLoading(false);
      return fail(translateAuthError(error.message, (error as { code?: string }).code));
    }
    const attachReferral = async () => {
      const code = referral.trim().toUpperCase();
      if (!code) return;
      try {
        await supabase.rpc("attach_referral_code", { _code: code });
      } catch {
        /* رمز الإحالة اختياري — لا يمنع إنشاء الحساب */
      }
    };
    if (data.session) {
      await attachReferral();
      setLoading(false);
      toast.success("تم إنشاء الحساب وتسجيل الدخول");
      navigate({ to: "/select-country", replace: true });
      return;
    }
    // No session — try immediate sign-in (works when email confirmation is disabled)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (!signInErr) await attachReferral();
    setLoading(false);
    if (!signInErr) {
      toast.success("تم إنشاء الحساب وتسجيل الدخول");
      navigate({ to: "/select-country", replace: true });
      return;
    }

    const code = (signInErr as { code?: string }).code?.toLowerCase() || "";
    if (code === "email_not_confirmed" || signInErr.message.toLowerCase().includes("not confirmed")) {
      toast.success("تم إنشاء الحساب. الرجاء فتح بريدك الإلكتروني والضغط على رابط التأكيد ثم العودة لتسجيل الدخول.");
    } else {
      toast.success("تم إنشاء الحساب. يمكنك الآن تسجيل الدخول.");
    }
    setMode("signin");
  };

  const onForgot = async () => {
    const target = email.trim().toLowerCase();
    setFormError(null);
    if (!target) return fail("اكتب بريدك الإلكتروني أولاً ثم اضغط استعادة كلمة المرور");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) return fail(translateAuthError(error.message, (error as { code?: string }).code));
    toast.success("تم إرسال رابط إعادة التعيين إلى بريدك");
  };


  // OAuth via standard Supabase Auth providers (configured in the Supabase project).
  const social = async (provider: "google" | "apple") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) return toast.error("فشل تسجيل الدخول: " + error.message);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between p-12 brand-gradient text-primary-foreground">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.6) 0 1px, transparent 1px 14px)" }}
        />
        <Link to="/" className="relative flex items-center gap-3 font-display font-extrabold">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-black/25 ring-1 ring-accent/40">
            <img src={logoAsset.url} alt="شعار المنصة" className="h-10 w-10 object-contain" />
          </span>
          حاسبة العمال الذكية
        </Link>
        <div className="relative">
          <div className="h-px w-32 gold-rule mb-6" />
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            احسب. احفظ.
            <span className="block gold-text">حمّل تقاريرك الرسمية.</span>
          </h2>
          <p className="mt-5 max-w-md leading-relaxed opacity-85">
            منصة تخدم العاملين وأصحاب العمل لاحتساب الحقوق العمالية بموثوقية وسرعة وفق أنظمة
            المملكة العربية السعودية والجمهورية اليمنية.
          </p>
          <ul className="mt-7 space-y-2 text-sm opacity-90">
            {["تقارير قانونية موثّقة برقم تسلسلي", "مراجع نظامية لكل بند محتسب", "يعمل كتطبيق على هاتفك"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs opacity-60">© {new Date().getFullYear()} جميع الحقوق محفوظة</p>
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-10">
        <div className="lg:hidden mb-6 flex justify-center">
          <Link to="/" className="inline-flex items-center gap-2 font-display font-extrabold">
            <img src={logoAsset.url} alt="شعار المنصة" className="h-11 w-11 object-contain" />
            حاسبة العمال الذكية
          </Link>
        </div>
        <Card className="relative w-full max-w-md mx-auto overflow-hidden border-border/70 p-6 sm:p-8 card-elev">
          <div className="absolute inset-x-10 top-0 h-px gold-rule" />
          <div className="mb-6 text-center">
            <h1 className="font-display text-xl font-extrabold">
              {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "signin" ? "أدخل بياناتك للوصول إلى حسابك وتقاريرك." : "دقيقة واحدة تفصلك عن حسابك التجريبي المجاني."}
            </p>
          </div>
          <div className="flex rounded-xl bg-muted p-1 mb-6">
            <button onClick={() => setMode("signin")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === "signin" ? "bg-card text-primary shadow-sm ring-1 ring-accent/25" : "text-muted-foreground"}`}>
              تسجيل الدخول
            </button>
            <button onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-card text-primary shadow-sm ring-1 ring-accent/25" : "text-muted-foreground"}`}>
              إنشاء حساب
            </button>
          </div>

          {formError && (
            <div role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
              {formError}
            </div>
          )}

          {mode === "signin" ? (
            <form onSubmit={onSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd">كلمة المرور</Label>
                <Input id="pwd" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
              </div>
              <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "جارٍ تسجيل الدخول..." : "دخول"}
              </Button>
              <button type="button" onClick={onForgot} disabled={loading} className="text-xs text-primary hover:underline w-full text-center disabled:opacity-50">
                {loading ? "..." : "نسيت كلمة المرور؟"}
              </button>
            </form>
          ) : (
            <form onSubmit={onSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">الاسم الكامل</Label>
                <Input id="name" autoComplete="name" required value={full_name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email2">البريد الإلكتروني</Label>
                <Input id="email2" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">الدولة</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value as CountryCode)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {(Object.keys(COUNTRIES) as CountryCode[]).map((c) => (
                    <option key={c} value={c}>
                      {COUNTRIES[c].flag} {COUNTRIES[c].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mob">رقم الجوال</Label>
                <div className="flex items-center gap-2" dir="ltr">
                  <span className="inline-flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                    {COUNTRIES[country].dial}
                  </span>
                  <Input
                    id="mob"
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={9}
                    value={localMobile}
                    onChange={(e) => setLocalMobile(e.target.value.replace(/[^0-9]/g, ""))}
                    dir="ltr"
                    placeholder={COUNTRIES[country].hint}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ref">رمز الإحالة (اختياري)</Label>
                <Input
                  id="ref"
                  value={referral}
                  onChange={(e) => setReferral(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  dir="ltr"
                  maxLength={12}
                  placeholder="ABCD1234"
                />
                <p className="text-[11px] text-muted-foreground">
                  عند استخدام رمز إحالة صالح تحصل على خصم 10٪ على أول عملية دفع.
                </p>
              </div>



              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pwd2">كلمة المرور</Label>
                  <Input id="pwd2" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cnf">تأكيد كلمة المرور</Label>
                  <Input id="cnf" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                كلمة المرور: 8 أحرف على الأقل وتحتوي على حروف وأرقام.
              </p>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(Boolean(v))} className="mt-0.5" />
                <span>
                  أوافق على <Link to="/privacy" className="text-primary underline">سياسة الخصوصية</Link> و
                  <Link to="/terms" className="text-primary underline mx-1">شروط الاستخدام</Link>.
                </span>
              </label>
              <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
              </Button>
            </form>
          )}


          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            بيانات محمية ومشفّرة • لا نشارك معلوماتك مع أي جهة
          </p>
        </Card>
      </div>
    </div>
  );
}

