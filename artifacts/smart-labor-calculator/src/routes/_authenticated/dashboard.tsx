import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, FileText, History, User, Shield, Globe2, CreditCard, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/calculator";
import { claimFirstAdmin } from "@/lib/admin-bootstrap.functions";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useSubscriptionStatus } from "@/lib/useSubscriptionStatus";
import { SubscriptionStatusBadge } from "@/components/SubscriptionStatusBadge";
import { SubscriptionRefreshButton } from "@/components/SubscriptionRefreshButton";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم • حقوق العمال" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const qc = useQueryClient();
  const claim = useServerFn(claimFirstAdmin);
  const { sub, loading: subLoading } = useSubscriptionStatus();


  const { data: anyAdmin } = useQuery({
    queryKey: ["any-admin"],
    enabled: !adminLoading && !isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
      return (count ?? 0) > 0;
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => claim(),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("تم تعيينك كأول مدير");
        qc.invalidateQueries();
      } else {
        toast.error("يوجد مدير بالفعل");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ["calc-recent", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("calculations").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });


  const { data: count } = useQuery({
    queryKey: ["calc-count", user.id],
    queryFn: async () => {
      const { count } = await supabase.from("calculations").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: lawyerProfile } = useQuery({
    queryKey: ["my-lawyer", user.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lawyers").select("id,verification_status").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const quickActions = [
    { to: "/calculator" as const, icon: Calculator, title: "حاسبة جديدة", desc: "ابدأ احتساب الحقوق العمالية" },
    { to: "/select-country" as const, icon: Globe2, title: "اختيار الدولة", desc: "السعودية 🇸🇦 أو اليمن 🇾🇪" },
    { to: "/calculations" as const, icon: FileText, title: "حساباتي المحفوظة", desc: "استعرض وحمّل تقاريرك" },
    { to: "/my-subscription" as const, icon: CreditCard, title: "اشتراكي", desc: "حالة الاشتراك والتجديد" },
    { to: "/subscription-history" as const, icon: History, title: "سجل الاشتراكات", desc: "الخطط المدفوعة والتواريخ" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="pb-12">
        {/* Welcome banner */}
        <section className="relative overflow-hidden brand-gradient text-primary-foreground">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.6) 0 1px, transparent 1px 14px)" }}
          />
          <div className="relative container mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-10">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-accent">لوحة التحكم</p>
              <h1 className="font-display mt-1 truncate text-2xl sm:text-3xl font-extrabold">أهلاً بك</h1>
              <p className="mt-1 truncate text-sm opacity-80">{user.email}</p>
              {!subLoading && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SubscriptionStatusBadge status={sub.status} />
                  {sub.status === "active" && (
                    <span className="text-xs opacity-80">متبقٍ {sub.daysLeft} يوم</span>
                  )}
                </div>
              )}
            </div>
            <Button asChild className="shrink-0 gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/calculator"><Calculator className="h-4 w-4" /><span className="hidden sm:inline">حساب جديد</span></Link>
            </Button>
          </div>
        </section>

        <div className="container mx-auto -mt-6 space-y-6 px-4">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: History, label: "إجمالي الحسابات", value: String(count ?? 0) },
              { icon: TrendingUp, label: "آخر حساب", value: recent?.[0] ? new Date(recent[0].created_at).toLocaleDateString("ar-EG") : "—" },
              { icon: Shield, label: "نوع الحساب", value: isAdmin ? "مدير النظام" : "مستخدم" },
            ].map((s) => (
              <Card key={s.label} className="border-border/70 p-5 card-elev hover-lift">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-accent/20">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="truncate font-display text-xl font-extrabold">{s.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Subscription status */}
          <Card className="border-accent/40 p-5 card-elev">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-accent/20">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">حالة الاشتراك</p>
                    {!subLoading && <SubscriptionStatusBadge status={sub.status} />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subLoading
                      ? "جارٍ التحقق من حالة اشتراكك..."
                      : sub.status === "active"
                        ? `${sub.planName ?? "خطة مفعّلة"} • ينتهي في ${sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("en-GB") : "—"}`
                        : sub.status === "pending"
                          ? sub.delayed
                            ? "طلبك قيد المراجعة منذ أكثر من 24 ساعة — يمكنك التواصل مع الدعم."
                            : "طلبك قيد المراجعة وسيتم التفعيل فور تأكيد الإيصال."
                          : sub.status === "rejected"
                            ? "لم يتم قبول آخر طلب اشتراك. راجع بيانات التحويل وأعد الإرسال."
                            : sub.status === "expired"
                              ? "انتهت صلاحية اشتراكك. جدّد الخطة لمواصلة الاستخدام."
                              : "لا يوجد اشتراك فعّال بعد."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(sub.status === "pending" || sub.status === "rejected" || sub.delayed) && (
                  <SubscriptionRefreshButton />
                )}
                <Button asChild size="sm" variant="outline"><Link to="/subscription-history">سجل الاشتراكات</Link></Button>

                <Button asChild size="sm">
                  <Link to={sub.status === "active" || sub.status === "pending" ? "/my-subscription" : "/subscribe"}>
                    {sub.status === "active" || sub.status === "pending" ? "إدارة الخطة" : "اشترك الآن"}
                  </Link>
                </Button>
              </div>
            </div>
          </Card>


          {/* Quick actions */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-display font-extrabold">إجراءات سريعة</h2>
              <div className="h-px flex-1 gold-rule opacity-60" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map((a) => (
                <Link key={a.to} to={a.to} className="group">
                  <Card className="h-full border-border/70 p-5 card-elev hover-lift group-hover:border-accent/50">
                    <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-accent/20">
                      <a.icon className="h-5 w-5" />
                    </div>
                    <p className="font-bold">{a.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{a.desc}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {isAdmin && (
            <Card className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-accent/40 bg-primary-soft/40 p-5 card-elev">
              <div className="flex min-w-0 items-center gap-3">
                <Shield className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-bold">صلاحيات الإدارة</p>
                  <p className="truncate text-xs text-muted-foreground">الوصول للوحة الإدارة والإحصائيات</p>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0"><Link to="/admin">فتح الإدارة</Link></Button>
            </Card>
          )}

          {lawyerProfile && (
            <Card className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-accent/40 bg-primary-soft/40 p-5 card-elev">
              <div className="flex min-w-0 items-center gap-3">
                <Shield className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-bold">لوحة المحامي</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lawyerProfile.verification_status === "approved" || lawyerProfile.verification_status === "verified"
                      ? "ملفك موثّق وظاهر للعامة"
                      : "ملفك قيد المراجعة من قبل الإدارة"}
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0"><Link to="/lawyer-dashboard">فتح اللوحة</Link></Button>
            </Card>
          )}

          {!isAdmin && !adminLoading && anyAdmin === false && (
            <Card className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-dashed p-5">
              <div className="min-w-0">
                <p className="font-bold">لا يوجد مدير بعد</p>
                <p className="text-xs text-muted-foreground">يمكنك المطالبة بصلاحيات المدير الأول (متاح لأول مستخدم فقط)</p>
              </div>
              <Button size="sm" className="shrink-0" onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
                المطالبة بالإدارة
              </Button>
            </Card>
          )}

          {/* Recent */}
          <Card className="border-border/70 p-5 card-elev">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display font-extrabold">آخر الحسابات</h2>
              <Button asChild variant="ghost" size="sm"><Link to="/calculations">عرض الكل</Link></Button>
            </div>
            {recentLoading ? (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : !recent || recent.length === 0 ? (
              <div className="py-10 text-center">
                <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">لا توجد حسابات محفوظة بعد.</p>
                <Button asChild size="sm" className="mt-4"><Link to="/calculator">ابدأ أول حساب</Link></Button>
              </div>
            ) : (

              <div className="divide-y divide-border/70">
                {recent.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.employee_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.employer_name} • {new Date(c.created_at).toLocaleDateString("ar-EG")}</p>
                    </div>
                    <p className="whitespace-nowrap font-semibold tabular-nums text-primary">{formatCurrency(Number(c.total_due), (c as { currency?: string }).currency ?? "YER")}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-border/70 p-5 card-elev">
            <div className="flex min-w-0 items-center gap-3">
              <User className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-bold">الملف الشخصي</p>
                <p className="truncate text-xs text-muted-foreground">تحديث بياناتك أو حذف الحساب</p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0"><Link to="/profile">إدارة الحساب</Link></Button>
          </Card>
        </div>
      </main>
    </div>
  );
}

