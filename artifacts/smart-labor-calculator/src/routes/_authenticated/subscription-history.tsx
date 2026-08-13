import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionStatusBadge } from "@/components/SubscriptionStatusBadge";
import { SubscriptionRefreshButton } from "@/components/SubscriptionRefreshButton";
import { useSubscriptionStatus } from "@/lib/useSubscriptionStatus";
import { History, CalendarDays, Receipt, Sparkles, Inbox, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/subscription-history")({
  head: () => ({
    meta: [
      { title: "سجل الاشتراكات • حاسبة الحقوق العمالية" },
      { name: "description", content: "استعرض آخر الخطط المدفوعة وتواريخ التفعيل والانتهاء والحالة الحالية لكل عملية اشتراك." },
      { property: "og:title", content: "سجل الاشتراكات • حاسبة الحقوق العمالية" },
      { property: "og:description", content: "الخطط المدفوعة وتواريخ التفعيل والانتهاء وحالة كل عملية اشتراك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscriptionHistory,
});

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString("en-GB") : "—");
const fmtMoney = (n?: number | null) => (n == null ? "—" : new Intl.NumberFormat("en-US").format(Number(n)));

type FilterValue = "all" | "active" | "pending" | "expired";
type SortValue = "starts_desc" | "starts_asc";

function rowState(s: any, now: number, hasPendingForPlan: boolean): FilterValue {
  if (s.status === "active" && new Date(s.expires_at).getTime() > now) return "active";
  if (hasPendingForPlan) return "pending";
  return "expired";
}

const STATE_LABEL: Record<Exclude<FilterValue, "all">, string> = {
  active: "نشط",
  pending: "قيد المعالجة",
  expired: "منتهي",
};

function SubscriptionHistory() {
  const { sub } = useSubscriptionStatus();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortValue>("starts_desc");
  const [selected, setSelected] = useState<any | null>(null);

  const { data: subs, isLoading } = useQuery({
    queryKey: ["subscription-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, plan_id, status, starts_at, expires_at, notes, created_at, subscription_plans(name, price, currency, period, duration_days)")
        .order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: requests, isLoading: reqLoading } = useQuery({
    queryKey: ["subscription-history-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscription_requests")
        .select("id, plan_id, status, created_at, reviewed_at, amount, currency, transfer_reference, admin_notes, payment_method_id, subscription_plans(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const now = Date.now();
  const allSubs = subs ?? [];
  const allRequests = requests ?? [];

  const pendingPlanIds = useMemo(
    () => new Set(allRequests.filter((r: any) => r.status === "pending").map((r: any) => r.plan_id)),
    [allRequests],
  );

  const visible = useMemo(() => {
    const list = allSubs
      .map((s: any) => ({ ...s, _state: rowState(s, now, pendingPlanIds.has(s.plan_id)) }))
      .filter((s: any) => filter === "all" || s._state === filter);
    return list.sort((a: any, b: any) => {
      const av = new Date(a.starts_at ?? 0).getTime();
      const bv = new Date(b.starts_at ?? 0).getTime();
      return sort === "starts_desc" ? bv - av : av - bv;
    });
  }, [allSubs, filter, sort, now, pendingPlanIds]);

  const selectedRequests = useMemo(
    () => (selected ? allRequests.filter((r: any) => r.plan_id === selected.plan_id) : []),
    [selected, allRequests],
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold sm:text-3xl">سجل الاشتراكات</h1>
            <p className="text-sm text-muted-foreground">آخر الخطط المدفوعة وتواريخ التفعيل والانتهاء وحالة كل عملية.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SubscriptionStatusBadge status={sub.status} />
            <SubscriptionRefreshButton />
            <Button asChild variant="outline" size="sm"><Link to="/my-subscription">إدارة الخطة</Link></Button>
          </div>
        </div>

        <Card className="border-border/70 p-5 card-elev">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display font-extrabold">
              <History className="h-4 w-4 text-primary" /> الخطط المدفوعة
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="pending">قيد المعالجة</SelectItem>
                  <SelectItem value="expired">منتهي</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as SortValue)}>
                <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="الترتيب" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starts_desc">تاريخ التفعيل: الأحدث</SelectItem>
                  <SelectItem value="starts_asc">تاريخ التفعيل: الأقدم</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : allSubs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="mt-4 font-bold">لا توجد عمليات مدفوعة بعد</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                لم يتم تفعيل أي خطة على حسابك حتى الآن. اختر باقة وابدأ الاستخدام الكامل للحاسبة والتقارير.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button asChild size="sm" className="gap-2"><Link to="/subscribe"><Sparkles className="h-4 w-4" /> عرض الباقات</Link></Button>
                <SubscriptionRefreshButton label="تحديث الحالة" />
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              لا توجد اشتراكات مطابقة للفلتر المحدد.
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((s: any) => (
                <div key={s.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{s.subscription_plans?.name ?? "خطة اشتراك"}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={s._state === "active" ? "default" : s._state === "pending" ? "secondary" : "outline"}>
                        {STATE_LABEL[s._state as Exclude<FilterValue, "all">]}
                      </Badge>
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelected(s)}>
                        <Info className="h-4 w-4" /> التفاصيل
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-card/50 p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> التفعيل</div>
                      <div className="mt-1 font-semibold" dir="ltr">{fmtDate(s.starts_at)}</div>
                    </div>
                    <div className="rounded-lg border bg-card/50 p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> الانتهاء</div>
                      <div className="mt-1 font-semibold" dir="ltr">{fmtDate(s.expires_at)}</div>
                    </div>
                    <div className="rounded-lg border bg-card/50 p-3">
                      <div className="text-xs text-muted-foreground">القيمة</div>
                      <div className="mt-1 font-semibold" dir="ltr">
                        {fmtMoney(s.subscription_plans?.price)} {s.subscription_plans?.currency ?? ""}
                      </div>
                    </div>
                  </div>
                  {s.notes && <p className="mt-2 text-xs text-muted-foreground">{s.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-border/70 p-5 card-elev">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display font-extrabold">
              <Receipt className="h-4 w-4 text-primary" /> عمليات الدفع والطلبات
            </h2>
            <SubscriptionRefreshButton label="تحديث" variant="ghost" />
          </div>
          {reqLoading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : allRequests.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium">لا توجد عمليات دفع مسجّلة بعد</p>
              <p className="mt-1 text-xs text-muted-foreground">ستظهر هنا طلبات الاشتراك وإيصالات التحويل بعد إرسالها.</p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {allRequests.map((r: any) => (
                <div key={r.id} className="rounded-xl border border-border/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{r.subscription_plans?.name ?? "طلب اشتراك"}</span>
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                      {r.status === "approved" ? "مفعّل" : r.status === "rejected" ? "مرفوض" : "قيد المعالجة"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span dir="ltr">أُرسل: {fmtDate(r.created_at)}</span>
                    {r.reviewed_at && <span dir="ltr">روجع: {fmtDate(r.reviewed_at)}</span>}
                    {r.amount != null && <span dir="ltr">{fmtMoney(r.amount)} {r.currency}</span>}
                    {r.transfer_reference && <span dir="ltr">مرجع: {r.transfer_reference}</span>}
                  </div>
                  {r.admin_notes && <p className="mt-2 text-xs">ملاحظات الإدارة: {r.admin_notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.subscription_plans?.name ?? "تفاصيل الاشتراك"}</DialogTitle>
            <DialogDescription>تفاصيل عملية الاشتراك والمعرفات المرتبطة وعمليات الدفع.</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-card/50 p-3">
                  <div className="text-xs text-muted-foreground">تاريخ البدء</div>
                  <div className="mt-1 font-semibold" dir="ltr">{fmtDateTime(selected.starts_at)}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-3">
                  <div className="text-xs text-muted-foreground">تاريخ الانتهاء</div>
                  <div className="mt-1 font-semibold" dir="ltr">{fmtDateTime(selected.expires_at)}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-3">
                  <div className="text-xs text-muted-foreground">الحالة</div>
                  <div className="mt-1 font-semibold">{STATE_LABEL[selected._state as Exclude<FilterValue, "all">]}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-3">
                  <div className="text-xs text-muted-foreground">مدة الخطة</div>
                  <div className="mt-1 font-semibold">
                    {selected.subscription_plans?.duration_days ? `${selected.subscription_plans.duration_days} يوم` : "—"}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 text-xs font-bold text-muted-foreground">المعرفات المرتبطة</div>
                <div className="space-y-1 text-xs" dir="ltr">
                  <div>Subscription ID: <span className="font-mono">{selected.id}</span></div>
                  <div>Plan ID: <span className="font-mono">{selected.plan_id ?? "—"}</span></div>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 text-xs font-bold text-muted-foreground">عمليات الدفع المرتبطة</div>
                {selectedRequests.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد عمليات دفع مرتبطة بهذه الخطة.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedRequests.map((r: any) => (
                      <div key={r.id} className="rounded-md border p-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span dir="ltr" className="font-mono">{r.id.slice(0, 8)}…</span>
                          <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                            {r.status === "approved" ? "مفعّل" : r.status === "rejected" ? "مرفوض" : "قيد المعالجة"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground" dir="ltr">
                          <span>{fmtDate(r.created_at)}</span>
                          {r.amount != null && <span>{fmtMoney(r.amount)} {r.currency}</span>}
                          {r.transfer_reference && <span>Ref: {r.transfer_reference}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected.notes && (
                <p className="text-xs text-muted-foreground">ملاحظات: {selected.notes}</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <SubscriptionRefreshButton label="تحديث الحالة" variant="ghost" />
            <Button asChild size="sm" onClick={() => setSelected(null)}>
              <Link to="/my-subscription">الانتقال إلى إدارة الخطة</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
