import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ShieldCheck, ShieldAlert, Sparkles, Receipt } from "lucide-react";
import { useUserNotifications } from "@/lib/useUserNotifications";
import { useSubscriptionStatus } from "@/lib/useSubscriptionStatus";
import { SubscriptionStatusBadge } from "@/components/SubscriptionStatusBadge";
import { SubscriptionRefreshButton } from "@/components/SubscriptionRefreshButton";

export const Route = createFileRoute("/_authenticated/my-subscription")({
  head: () => ({
    meta: [
      { title: "اشتراكي • حاسبة العمال الذكية" },
      { name: "description", content: "حالة اشتراكك الحالية وخطة الاشتراك وتاريخ البداية والنهاية وسجل طلبات الاشتراك السابقة." },
      { property: "og:title", content: "اشتراكي • حاسبة العمال الذكية" },
      { property: "og:description", content: "تابع حالة اشتراكك وتواريخه وسجل طلباتك السابقة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MySubscription,
});

const fmtMoney = (n: number) => new Intl.NumberFormat("en-US").format(n);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

function statusBadge(status: string) {
  if (status === "approved") return <Badge>مفعّل</Badge>;
  if (status === "rejected") return <Badge variant="destructive">مرفوض</Badge>;
  return <Badge variant="secondary">قيد المراجعة</Badge>;
}

function MySubscription() {
  const { items: notifications, markRead } = useUserNotifications(true);
  const { sub, loading: subLoading } = useSubscriptionStatus();

  const { data: subs, isLoading } = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status, starts_at, expires_at, notes, plan_id, subscription_plans(name, period, price, currency, duration_days)")
        .order("expires_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["my-subscription-requests-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_requests")
        .select("id, status, created_at, reviewed_at, amount, currency, transfer_reference, admin_notes, plan_id, subscription_plans(name)")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const now = Date.now();
  const active = (subs ?? []).find(
    (s) => s.status === "active" && new Date(s.expires_at).getTime() > now,
  );
  const daysLeft = active
    ? Math.max(0, Math.ceil((new Date(active.expires_at).getTime() - now) / 86_400_000))
    : 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">اشتراكي</h1>
            <p className="text-sm text-muted-foreground">حالة الاشتراك الحالية والخطة وتواريخ البداية والنهاية وسجل الطلبات.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!subLoading && <SubscriptionStatusBadge status={sub.status} />}
            <Button asChild variant="outline" size="sm"><Link to="/subscription-history">سجل الاشتراكات</Link></Button>
            <SubscriptionRefreshButton />
            <Button asChild variant="outline" size="sm"><Link to="/subscribe">تجديد / اشتراك جديد</Link></Button>
          </div>
        </div>

        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">جارٍ التحميل...</Card>
        ) : active ? (
          <Card className="p-6 border-primary/40">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-7 w-7 text-primary shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-lg">اشتراكك فعّال</div>
                <div className="text-sm text-muted-foreground">
                  الخطة: {active.subscription_plans?.name ?? "—"}
                  {active.subscription_plans?.price != null && (
                    <span dir="ltr"> • {fmtMoney(Number(active.subscription_plans.price))} {active.subscription_plans.currency}</span>
                  )}
                </div>
                <div className="grid sm:grid-cols-3 gap-3 mt-4">
                  <div className="rounded-lg border bg-card/50 p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> تاريخ البداية</div>
                    <div className="font-semibold mt-1" dir="ltr">{fmtDate(active.starts_at)}</div>
                  </div>
                  <div className="rounded-lg border bg-card/50 p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> تاريخ الانتهاء</div>
                    <div className="font-semibold mt-1" dir="ltr">{fmtDate(active.expires_at)}</div>
                  </div>
                  <div className="rounded-lg border bg-card/50 p-3">
                    <div className="text-xs text-muted-foreground">المتبقي</div>
                    <div className="font-semibold mt-1 tabular-nums">{daysLeft} يوم</div>
                  </div>
                </div>
                {daysLeft <= 7 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                    اشتراكك يقترب من الانتهاء — جدّد الآن لتفادي توقف الوصول للحاسبة والتقارير.
                  </p>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-7 w-7 text-destructive shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-lg">لا يوجد اشتراك فعّال</div>
                <p className="text-sm text-muted-foreground mt-1">
                  انتهت صلاحية اشتراكك أو لم تشترك بعد. اشترك للوصول الكامل للحاسبة والتقارير القانونية.
                </p>
                <Button asChild className="mt-4 gap-2">
                  <Link to="/subscribe"><Sparkles className="h-4 w-4" /> عرض الباقات</Link>
                </Button>
              </div>
            </div>
          </Card>
        )}

        {(subs ?? []).length > 1 && (
          <Card className="p-5">
            <h2 className="font-bold mb-3">سجل الاشتراكات</h2>
            <div className="space-y-2 text-sm">
              {(subs ?? []).map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                  <span className="font-medium">{s.subscription_plans?.name ?? "—"}</span>
                  <span className="text-muted-foreground" dir="ltr">{fmtDate(s.starts_at)} → {fmtDate(s.expires_at)}</span>
                  <Badge variant={new Date(s.expires_at).getTime() > now && s.status === "active" ? "default" : "secondary"}>
                    {new Date(s.expires_at).getTime() > now && s.status === "active" ? "فعّال" : "منتهٍ"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> سجل طلبات الاشتراك</h2>
          {(requests ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد طلبات سابقة.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {(requests ?? []).map((r) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{r.subscription_plans?.name ?? "طلب اشتراك"}</span>
                    {statusBadge(r.status)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span dir="ltr">أُرسل: {fmtDate(r.created_at)}</span>
                    {r.reviewed_at && <span dir="ltr">روجع: {fmtDate(r.reviewed_at)}</span>}
                    {r.amount != null && <span dir="ltr">{fmtMoney(Number(r.amount))} {r.currency}</span>}
                    {r.transfer_reference && <span dir="ltr">مرجع: {r.transfer_reference}</span>}
                  </div>
                  {r.admin_notes && <p className="text-xs mt-2">ملاحظات الإدارة: {r.admin_notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">إشعاراتي</h2>
            {notifications.some((n) => !n.read) && (
              <button className="text-xs text-primary" onClick={() => markRead()}>تعليم الكل كمقروء</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد إشعارات.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {notifications.map((n) => (
                <div key={n.id} className={`rounded-lg border p-3 ${n.read ? "" : "bg-primary/5 border-primary/30"}`}>
                  <div className="font-medium">{n.title}</div>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                  <div className="text-[10px] text-muted-foreground mt-1" dir="ltr">
                    {new Date(n.created_at).toLocaleString("en-GB")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
