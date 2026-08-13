/**
 * Real dashboard data source for /admin.
 *
 * Reads live Lovable Cloud (Supabase) tables with the signed-in admin session,
 * shapes them into the `DashboardData` contract the UI already consumes, and
 * falls back to the sample dataset only if the whole read fails (offline).
 */
import { supabase } from "@/integrations/supabase/client";
import { MOCK_DASHBOARD, type DashboardData, type SeriesPoint } from "@/lib/admin/mockData";

export type { DashboardData, Kpi, SeriesPoint, ActivityItem, NotificationItem } from "@/lib/admin/mockData";

const PAID = ["succeeded", "paid", "completed", "approved"];
const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

type Money = { created_at: string; amount: number | null; status: string | null };

function count(res: { count: number | null } | undefined) {
  return res?.count ?? 0;
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.round(h / 24);
  return d === 1 ? "أمس" : `قبل ${d} يوم`;
}

function bucketDaily(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
function bucketWeekly(iso: string) {
  const d = new Date(iso);
  return `أسبوع ${Math.ceil(d.getDate() / 7)}/${d.getMonth() + 1}`;
}
function bucketMonthly(iso: string) {
  const d = new Date(iso);
  return MONTH_NAMES[d.getMonth()]!;
}

function buildSeries(
  bucket: (iso: string) => string,
  labels: string[],
  users: { created_at: string }[],
  orders: Money[],
): SeriesPoint[] {
  const map = new Map<string, SeriesPoint>(
    labels.map((label) => [label, { label, users: 0, orders: 0, revenue: 0 }]),
  );
  for (const u of users) {
    const p = map.get(bucket(u.created_at));
    if (p) p.users += 1;
  }
  for (const o of orders) {
    const p = map.get(bucket(o.created_at));
    if (!p) continue;
    p.orders += 1;
    if (PAID.includes((o.status ?? "").toLowerCase())) p.revenue += Number(o.amount ?? 0);
  }
  return labels.map((l) => map.get(l)!);
}

function lastLabels(days: number, bucket: (iso: string) => string, stepMs: number) {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const label = bucket(new Date(Date.now() - i * stepMs).toISOString());
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const now = Date.now();
    const since = new Date(now - 240 * 864e5).toISOString();
    const todayStart = new Date(new Date().toDateString()).toISOString();

    const [
      usersTotal,
      usersActive,
      casesTotal,
      casesOpen,
      calcsToday,
      subsActive,
      profileRows,
      requestRows,
      txnRows,
      calcRows,
      aiRows,
      auditRows,
      notifRows,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("sa_cases").select("id", { count: "exact", head: true }),
      supabase.from("sa_cases").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("case_calculations").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("profiles").select("created_at").gte("created_at", since).limit(3000),
      supabase.from("subscription_requests").select("created_at, amount, status").gte("created_at", since).limit(3000),
      supabase.from("billing_transactions").select("created_at, amount, status").gte("created_at", since).limit(3000),
      supabase
        .from("case_calculations")
        .select(
          "confidence_score, calculation_status, total_salary, total_leave, total_gratuity, total_compensation, total_insurance",
        )
        .limit(1000),
      supabase.from("ai_usage_logs").select("success").limit(1000),
      supabase.from("audit_logs").select("id, action, target_type, created_at, actor_id").order("created_at", { ascending: false }).limit(8),
      supabase.from("notifications").select("id, title, message, created_at, read").order("created_at", { ascending: false }).limit(6),
    ]);

    const profiles = (profileRows.data ?? []) as { created_at: string }[];
    const requests = (requestRows.data ?? []) as Money[];
    const txns = (txnRows.data ?? []) as Money[];
    const orders: Money[] = [...requests, ...txns];

    const revenue = orders
      .filter((o) => PAID.includes((o.status ?? "").toLowerCase()))
      .reduce((a, o) => a + Number(o.amount ?? 0), 0);
    const pending = orders.filter((o) => (o.status ?? "") === "pending").length;
    const completed = orders.filter((o) => PAID.includes((o.status ?? "").toLowerCase())).length;

    // actor names for the activity feed
    const actorIds = [...new Set((auditRows.data ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
    const actorNames = new Map<string, string>();
    if (actorIds.length) {
      const { data: actors } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
      for (const a of actors ?? []) actorNames.set(a.id, a.full_name || a.email || "مستخدم");
    }

    const calcs = (calcRows.data ?? []) as Record<string, number | string | null>[];
    const confidences = calcs.map((c) => Number(c["confidence_score"] ?? 0)).filter((v) => v > 0);
    const avgConfidence = confidences.length
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;
    const calcSuccess = calcs.length
      ? Math.round((calcs.filter((c) => c["calculation_status"] === "completed").length / calcs.length) * 100)
      : 0;
    const ai = (aiRows.data ?? []) as { success: boolean | null }[];
    const aiSuccess = ai.length ? Math.round((ai.filter((a) => a.success).length / ai.length) * 100) : 0;
    const approvalRate = orders.length ? Math.round((completed / orders.length) * 100) : 0;

    const sum = (key: string) => calcs.reduce((a, c) => a + Number(c[key] ?? 0), 0);

    // status distribution across all money records
    const statusMap = new Map<string, number>();
    for (const o of orders) {
      const s = (o.status ?? "unknown").toLowerCase();
      const label =
        s === "pending" ? "معلّقة"
        : PAID.includes(s) ? "مكتملة"
        : s === "rejected" ? "مرفوضة"
        : s === "refunded" ? "مستردة"
        : "أخرى";
      statusMap.set(label, (statusMap.get(label) ?? 0) + 1);
    }

    // monthly user growth (cumulative)
    const byMonth = new Map<string, number>();
    for (const p of profiles) {
      const k = p.created_at.slice(0, 7);
      byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
    }
    let running = 0;
    const userGrowth = [...byMonth.entries()].sort().slice(-8).map(([k, v]) => {
      running += v;
      return { label: MONTH_NAMES[Number(k.slice(5, 7)) - 1] ?? k, total: running };
    });

    const dailyLabels = lastLabels(7, bucketDaily, 864e5);
    const weeklyLabels = lastLabels(28, bucketWeekly, 864e5);
    const monthlyLabels = lastLabels(8, bucketMonthly, 30 * 864e5);

    return {
      kpis: [
        { key: "users", label: "إجمالي المستخدمين", value: count(usersTotal), format: "number", delta: 0 },
        { key: "orders", label: "طلبات الاشتراك", value: orders.length, format: "number", delta: 0 },
        { key: "active", label: "الاشتراكات النشطة", value: count(subsActive), format: "number", delta: 0 },
        { key: "revenue", label: "الإيرادات المحصّلة", value: Math.round(revenue), format: "currency", delta: 0 },
        { key: "pending", label: "طلبات معلّقة", value: pending, format: "number", delta: 0 },
        { key: "completed", label: "عمليات مكتملة", value: completed, format: "number", delta: 0 },
        { key: "cases", label: "إجمالي القضايا", value: count(casesTotal), format: "number", delta: 0 },
        { key: "open", label: "قضايا مفتوحة", value: count(casesOpen), format: "number", delta: 0 },
        { key: "calcs", label: "حسابات اليوم", value: count(calcsToday), format: "number", delta: 0 },
        { key: "activeUsers", label: "حسابات مُفعّلة", value: count(usersActive), format: "number", delta: 0 },
      ],
      activity: (auditRows.data ?? []).map((a) => ({
        id: a.id,
        actor: (a.actor_id && actorNames.get(a.actor_id)) || "النظام",
        action: `${a.action}${a.target_type ? " · " + a.target_type : ""}`,
        at: relative(a.created_at),
      })),
      notifications: (notifRows.data ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.message ?? "",
        at: relative(n.created_at),
        unread: !n.read,
      })),
      performance: [
        { label: "نجاح الحسابات", value: calcSuccess, target: 99 },
        { label: "نجاح الذكاء الاصطناعي", value: aiSuccess, target: 95 },
        { label: "اكتمال البيانات", value: avgConfidence, target: 90 },
        { label: "اعتماد الطلبات", value: approvalRate, target: 90 },
      ],
      userGrowth,
      topServices: [
        { name: "مكافأة نهاية الخدمة", value: Math.round(sum("total_gratuity")) },
        { name: "التعويضات", value: Math.round(sum("total_compensation")) },
        { name: "الأجور", value: Math.round(sum("total_salary")) },
        { name: "الرصيد السنوي", value: Math.round(sum("total_leave")) },
        { name: "التأمينات", value: Math.round(sum("total_insurance")) },
      ].filter((s) => s.value > 0),
      transactionStatus: [...statusMap.entries()].map(([name, value]) => ({ name, value })),
      series: {
        daily: buildSeries(bucketDaily, dailyLabels, profiles, orders),
        weekly: buildSeries(bucketWeekly, weeklyLabels, profiles, orders),
        monthly: buildSeries(bucketMonthly, monthlyLabels, profiles, orders),
      },
    };
  } catch {
    return MOCK_DASHBOARD;
  }
}
