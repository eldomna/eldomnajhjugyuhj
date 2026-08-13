import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, Clock, CreditCard, ShieldCheck, Upload, Loader2, Globe2, LogIn } from "lucide-react";
import { useAccess } from "@/lib/useAccess";
import { validateReceiptFile, receiptStoragePath, RECEIPT_ACCEPT } from "@/lib/receipt-upload";
import { getMyPricing, createSubscriptionRequest } from "@/lib/billing/pricing.functions";


export const Route = createFileRoute("/subscribe")({
  head: () => ({
    meta: [
      { title: "الاشتراك • حاسبة العمال الذكية" },
      { name: "description", content: "باقات الاشتراك للوصول الكامل لحاسبة الحقوق العمالية والتقارير القانونية، حسب دولة حسابك." },
      { property: "og:title", content: "باقات الاشتراك • حاسبة العمال الذكية" },
      { property: "og:description", content: "اشترك للوصول الكامل لجميع الحاسبات والتقارير القانونية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscribePage,
});

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

function SubscribePage() {
  const qc = useQueryClient();
  const access = useAccess();
  const fetchPricing = useServerFn(getMyPricing);
  const submitRequest = useServerFn(createSubscriptionRequest);
  const [planId, setPlanId] = useState<string | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [useWallet, setUseWallet] = useState(true);
  const [saving, setSaving] = useState(false);


  // الأسعار تُجلب من الخادم حسب الدولة المحفوظة في الحساب — لا تُرسل أسعار الدول الأخرى للمتصفح.
  const {
    data: pricing,
    isLoading: plansLoading,
    isError: plansError,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ["my-pricing"],
    enabled: access.signedIn,
    queryFn: () => fetchPricing(),
    retry: false,
  });

  const plans = pricing?.plans ?? [];
  const country = pricing?.country ?? null;



  const { data: methods } = useQuery({
    queryKey: ["payment-methods-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, name, logo_url, account_number, account_holder, instructions")
        .eq("is_active", true)
        .order("sort_order");
      if (error) return [];
      return data;
    },
  });

  const { data: myRequests } = useQuery({
    queryKey: ["my-subscription-requests"],
    enabled: access.signedIn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_requests")
        .select("id, status, created_at, amount, currency, admin_notes")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) return [];
      return data;
    },
  });

  // خصم الإحالة: يُطبَّق تلقائياً على أول عملية دفع للمستخدم المُحال
  const { data: myReferral } = useQuery({
    queryKey: ["my-referral-discount"],
    enabled: access.signedIn,
    queryFn: async () => {
      const [{ data: ref }, { data: cfg }] = await Promise.all([
        supabase
          .from("referrals")
          .select("id, status, referral_codes(code)")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("referral_settings").select("discount_percent, is_active").eq("id", 1).maybeSingle(),
      ]);
      if (!ref || !cfg?.is_active) return null;
      const codes = ref.referral_codes as unknown as { code: string } | null;
      return { code: codes?.code ?? "", percent: Number(cfg.discount_percent ?? 0) };
    },
  });

  const selectedPlan = plans?.find((p) => p.id === planId) ?? null;
  const discountPercent = myReferral?.percent ?? 0;
  const basePrice = Number(selectedPlan?.price ?? 0);
  const discountAmount = discountPercent > 0 ? Math.round(basePrice * discountPercent) / 100 : 0;
  const priceAfterDiscount = Math.max(0, basePrice - discountAmount);

  const { data: walletRows } = useQuery({
    queryKey: ["my-wallet-summary"],
    enabled: access.signedIn,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_my_wallet_summary");
      if (error) return [];
      return (data ?? []) as { currency: string; balance: number }[];
    },
  });

  const planCurrency = selectedPlan?.currency ?? "YER";
  const walletBalance = Number(walletRows?.find((w) => w.currency === planCurrency)?.balance ?? 0);
  const walletApplied = useWallet ? Math.min(walletBalance, priceAfterDiscount) : 0;
  const finalPrice = Math.max(0, priceAfterDiscount - walletApplied);



  const submit = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      toast.error("سجّل الدخول أولاً");
      return;
    }
    if (!planId) {
      toast.error("اختر باقة الاشتراك");
      return;
    }
    setSaving(true);
    try {
      let receiptUrl: string | null = null;
      if (file) {
        const check = validateReceiptFile(file);
        if (!check.ok) {
          toast.error(check.error);
          setSaving(false);
          return;
        }
        const path = receiptStoragePath(user.id, check.ext);
        const { error: upErr } = await supabase.storage
          .from("receipts")
          .upload(path, file, { contentType: check.contentType, upsert: false, cacheControl: "3600" });
        if (upErr) throw upErr;
        receiptUrl = path;
      }

      // المبلغ والعملة والخصم يُحسبان في الخادم من خطة دولة الحساب.
      const res = await submitRequest({
        data: {
          planId,
          paymentMethodId: methodId,
          fullName: fullName.trim() || null,
          mobileNumber: mobile.trim() || null,
          transferReference: reference.trim() || null,
          receiptUrl,
          notes: notes.trim() || null,
          useWallet,
        },
      });

      toast.success("تم استلام عملية الدفع", {
        description: `المبلغ المطلوب: ${fmt(res.amount)} ${res.currency} — سيتم التفعيل فور مراجعة الإيصال.`,
      });
      setReference("");
      setNotes("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["my-subscription-requests"] });
      qc.invalidateQueries({ queryKey: ["subscription-status"] });
      qc.invalidateQueries({ queryKey: ["my-wallet-summary"] });

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إرسال الطلب");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 pb-12">
        <section className="relative overflow-hidden brand-gradient text-primary-foreground">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.6) 0 1px, transparent 1px 14px)" }}
          />
          <div className="relative container mx-auto px-4 py-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-black/25 px-3 py-1 text-xs font-semibold text-accent">
              <ShieldCheck className="h-3.5 w-3.5" /> اشتراك آمن • تفعيل يدوي موثّق
            </div>
            <h1 className="font-display mt-4 text-3xl font-extrabold">باقات الاشتراك</h1>
            <div className="mx-auto mt-4 h-px w-28 gold-rule" />
            <p className="mx-auto mt-4 max-w-xl text-sm opacity-85">
              اشترك للوصول الكامل لجميع الحاسبات والتقارير القانونية الرسمية.
            </p>
          </div>
        </section>

        <div className="container mx-auto px-4 pt-8">
          {access.isSubscribed && (
            <Card className="mx-auto mb-8 grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-accent/40 bg-primary-soft/40 p-5 card-elev">
              <div className="flex min-w-0 items-center gap-3">
                <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="font-bold">اشتراكك فعّال</div>
                  <div className="truncate text-sm text-muted-foreground">
                    ينتهي في:{" "}
                    {access.expiresAt
                      ? new Date(access.expiresAt).toLocaleDateString("en-GB")
                      : "—"}
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link to="/calculator">فتح الحاسبة</Link>
              </Button>
            </Card>
          )}

          {/* Steps */}
          <ol className="mx-auto mb-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            {["اختر الباقة المناسبة", "حوّل المبلغ عبر وسيلة الدفع", "أرسل الإيصال ليتم التفعيل"].map((s, i) => (
              <li key={s} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-xs">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground font-bold">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>

          {/* الأسعار لا تُعرض إلا بعد تسجيل الدخول */}
          {!access.loading && !access.signedIn && (
            <Card className="mx-auto mb-10 max-w-3xl border-border/70 p-8 text-center card-elev">
              <LogIn className="mx-auto mb-3 h-9 w-9 text-primary" />
              <h2 className="font-display text-lg font-extrabold mb-2">سجّل الدخول لعرض باقات الاشتراك</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                تُعرض الباقات والأسعار الخاصة بدولتك بعد تسجيل الدخول.
              </p>
              <Button asChild size="lg">
                <Link to="/auth">دخول / إنشاء حساب</Link>
              </Button>
            </Card>
          )}

          {access.signedIn && plansLoading && (
            <div className="mx-auto mb-10 grid max-w-3xl gap-5 md:grid-cols-2">
              {[0, 1].map((i) => (
                <Card key={i} className="border-border/70 p-6" aria-busy="true">
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="mt-4 h-8 w-40 animate-pulse rounded bg-muted" />
                  <div className="mt-4 h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
                </Card>
              ))}
            </div>
          )}

          {access.signedIn && plansError && (
            <Card role="alert" className="mx-auto mb-10 max-w-3xl border-destructive/40 bg-destructive/10 p-5 text-sm">
              <p className="font-semibold text-destructive">تعذّر تحميل باقات الاشتراك</p>
              <p className="mt-1 text-muted-foreground">تحقق من اتصالك بالإنترنت ثم أعد المحاولة.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchPlans()}>إعادة المحاولة</Button>
            </Card>
          )}

          {/* المستخدم بدون دولة محددة: يجب اختيار الدولة قبل عرض الأسعار */}
          {access.signedIn && !plansLoading && !plansError && !country && (
            <Card className="mx-auto mb-10 max-w-3xl border-accent/40 p-8 text-center card-elev">
              <Globe2 className="mx-auto mb-3 h-9 w-9 text-primary" />
              <h2 className="font-display text-lg font-extrabold mb-2">حدّد دولتك أولاً</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                تختلف الباقات والعملة حسب الدولة. اختر دولتك لعرض الباقات المتاحة لحسابك.
              </p>
              <Button asChild size="lg">
                <Link to="/select-country">اختيار الدولة</Link>
              </Button>
            </Card>
          )}

          {access.signedIn && !plansLoading && !plansError && country && plans.length === 0 && (
            <Card className="mx-auto mb-10 max-w-3xl border-border/70 p-5 text-sm text-muted-foreground">
              لا توجد باقات متاحة حالياً لدولتك. الرجاء المحاولة لاحقاً.
            </Card>
          )}

          <div className="mx-auto mb-10 grid max-w-3xl gap-5 md:grid-cols-2">


            {(plans ?? []).map((p) => (
              <Card
                key={p.id}
                className={`relative cursor-pointer overflow-hidden p-6 transition-all card-elev ${
                  planId === p.id
                    ? "border-accent ring-2 ring-accent/40"
                    : "border-border/70 hover-lift hover:border-accent/50"
                }`}
                onClick={() => setPlanId(p.id)}
              >
                {p.period === "yearly" && <div className="absolute inset-x-0 top-0 h-1 gold-rule" />}
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-extrabold">{p.name}</h3>
                  {p.period === "yearly" && (
                    <Badge className="bg-accent text-accent-foreground hover:bg-accent">الأفضل قيمة</Badge>
                  )}
                </div>
                <div className="font-display text-3xl font-extrabold text-primary">
                  {fmt(Number(p.price))}{" "}
                  <span className="text-base font-medium text-muted-foreground">{p.currency}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> مدة الاشتراك: {p.duration_days} يوم
                </div>
                {planId === p.id && (
                  <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                    <CheckCircle2 className="h-4 w-4" /> تم اختيار هذه الباقة
                  </div>
                )}
              </Card>
            ))}
          </div>

          {(methods ?? []).length > 0 && (
            <div className="mx-auto mb-8 max-w-3xl">
              <h2 className="mb-3 flex items-center gap-2 font-display font-extrabold">
                <CreditCard className="h-4 w-4 text-primary" /> اختر وسيلة التحويل
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(methods ?? []).map((m) => (
                  <Card
                    key={m.id}
                    className={`cursor-pointer p-4 transition-all ${
                      methodId === m.id ? "border-accent ring-2 ring-accent/40" : "border-border/70 hover:border-accent/50"
                    }`}
                    onClick={() => setMethodId(m.id)}
                  >
                    <div className="font-semibold">{m.name}</div>
                    {m.account_number && (
                      <div className="mt-1 text-sm text-muted-foreground" dir="ltr">
                        {m.account_number}
                      </div>
                    )}
                    {m.account_holder && (
                      <div className="text-xs text-muted-foreground">{m.account_holder}</div>
                    )}
                    {m.instructions && (
                      <p className="mt-2 text-xs text-muted-foreground">{m.instructions}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Card className="mx-auto max-w-3xl border-border/70 p-6 card-elev">
            <h2 className="mb-4 font-display font-extrabold">إرسال إيصال التحويل للتفعيل</h2>

          {!access.signedIn ? (
            <div className="text-sm">
              <p className="text-muted-foreground mb-4">سجّل الدخول لإرسال طلب الاشتراك.</p>
              <Button asChild><Link to="/auth">دخول / إنشاء حساب</Link></Button>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sub-name">الاسم الكامل</Label>
                  <Input id="sub-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="sub-mobile">رقم الجوال</Label>
                  <Input id="sub-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} dir="ltr" maxLength={20} />
                </div>
              </div>
              <div>
                <Label htmlFor="sub-ref">رقم/مرجع عملية التحويل</Label>
                <Input id="sub-ref" value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" maxLength={80} />
              </div>
              <div>
                <Label htmlFor="sub-file">صورة الإيصال</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="sub-file"
                    type="file"
                    accept={RECEIPT_ACCEPT}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) return setFile(null);
                      const check = validateReceiptFile(f);
                      if (!check.ok) {
                        toast.error(check.error);
                        e.target.value = "";
                        setFile(null);
                        return;
                      }
                      setFile(f);
                    }}
                  />
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" />

                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  المسموح: JPG أو PNG أو WEBP أو PDF — بحد أقصى 5 ميجابايت. يُحفظ الملف بشكل خاص داخل حسابك ولا يطّلع عليه سوى الإدارة.
                </p>
                {file && <p className="text-xs text-primary mt-1" dir="ltr">{file.name}</p>}
              </div>

              <div>
                <Label htmlFor="sub-notes">ملاحظات (اختياري)</Label>
                <Textarea id="sub-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} />
              </div>
              {selectedPlan && walletBalance > 0 && (
                <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs">
                  <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
                  استخدام رصيد الإحالات ({fmt(walletBalance)} {planCurrency}) لخصم قيمة الاشتراك
                </label>
              )}
              {selectedPlan && (discountAmount > 0 || walletApplied > 0) && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs">
                  {discountAmount > 0 && (
                    <div>خصم إحالة {fmt(discountPercent)}٪ بالرمز <span className="font-mono" dir="ltr">{myReferral?.code}</span></div>
                  )}
                  {walletApplied > 0 && <div>خصم من رصيد المحفظة: {fmt(walletApplied)} {planCurrency}</div>}
                  <div className="mt-1 font-bold">
                    المبلغ المطلوب تحويله: {fmt(finalPrice)} {selectedPlan.currency}
                    <span className="ms-2 font-normal text-muted-foreground line-through">{fmt(basePrice)}</span>
                  </div>
                </div>
              )}

              {!planId && (
                <p className="rounded-lg border border-border/70 bg-muted/50 p-3 text-xs text-muted-foreground">
                  اختر باقة الاشتراك من الأعلى لتفعيل زر الإرسال.
                </p>
              )}

              <Button onClick={submit} disabled={saving || !planId} size="lg" className="w-full gap-2 sm:w-auto">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "جارٍ إرسال الطلب..." : "إرسال طلب التفعيل"}
              </Button>

            </div>
          )}
        </Card>

          {(myRequests ?? []).length > 0 && (
            <Card className="mx-auto mt-6 max-w-3xl border-border/70 p-6 card-elev">
              <h2 className="mb-3 font-display font-extrabold">طلباتي السابقة</h2>
              <div className="space-y-2 text-sm">
                {(myRequests ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 border-b border-border/70 pb-2 last:border-0">
                    <span>{new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                    <span dir="ltr">{r.amount ? `${fmt(Number(r.amount))} ${r.currency}` : "—"}</span>
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                      {r.status === "approved" ? "مفعّل" : r.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </main>

    </div>
  );
}
