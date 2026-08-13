/**
 * Mock data source for the admin dashboard.
 * Every export is shaped like a future API/Supabase response, so swapping the
 * implementation (e.g. a server fn or a Supabase query) needs no UI changes.
 */

export type Kpi = {
  key: string;
  label: string;
  value: number;
  format: "number" | "currency" | "percent";
  delta: number;
};

export type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  at: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  at: string;
  unread: boolean;
};

export type SeriesPoint = { label: string; users: number; orders: number; revenue: number };

export type DashboardData = {
  kpis: Kpi[];
  activity: ActivityItem[];
  notifications: NotificationItem[];
  performance: { label: string; value: number; target: number }[];
  userGrowth: { label: string; total: number }[];
  topServices: { name: string; value: number }[];
  transactionStatus: { name: string; value: number }[];
  series: { daily: SeriesPoint[]; weekly: SeriesPoint[]; monthly: SeriesPoint[] };
};

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const WEEKS = ["الأسبوع 1", "الأسبوع 2", "الأسبوع 3", "الأسبوع 4"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس"];

function series(labels: string[], base: number): SeriesPoint[] {
  return labels.map((label, i) => ({
    label,
    users: Math.round(base * (0.6 + Math.sin(i + 1) * 0.2 + i * 0.08)),
    orders: Math.round(base * 0.45 * (0.7 + Math.cos(i) * 0.18 + i * 0.06)),
    revenue: Math.round(base * 12 * (0.8 + Math.sin(i * 1.4) * 0.15 + i * 0.05)),
  }));
}

export const MOCK_DASHBOARD: DashboardData = {
  kpis: [
    { key: "users", label: "إجمالي المستخدمين", value: 12480, format: "number", delta: 8.4 },
    { key: "orders", label: "إجمالي الطلبات", value: 3260, format: "number", delta: 4.1 },
    { key: "active", label: "المعاملات النشطة", value: 184, format: "number", delta: -2.3 },
    { key: "revenue", label: "الإيرادات", value: 486300, format: "currency", delta: 12.7 },
    { key: "pending", label: "الطلبات المعلّقة", value: 47, format: "number", delta: -6.5 },
    { key: "completed", label: "الطلبات المكتملة", value: 3029, format: "number", delta: 5.9 },
  ],
  activity: [
    { id: "a1", actor: "أحمد ع.", action: "أنشأ قضية جديدة #4821", at: "قبل 4 دقائق" },
    { id: "a2", actor: "سارة م.", action: "أكملت عملية اشتراك شهري", at: "قبل 12 دقيقة" },
    { id: "a3", actor: "النظام", action: "تم إنشاء نسخة احتياطية", at: "قبل 40 دقيقة" },
    { id: "a4", actor: "خالد ف.", action: "طلب سحب من المحفظة", at: "قبل ساعة" },
    { id: "a5", actor: "منى س.", action: "صدّرت تقريراً قانونياً نهائياً", at: "قبل 3 ساعات" },
    { id: "a6", actor: "محرك القوانين", action: "تحديث إصدار قاعدة المادة 77", at: "أمس" },
  ],
  notifications: [
    { id: "n1", title: "طلب سحب جديد", body: "بانتظار الموافقة — 250 ر.س", at: "قبل 5 دقائق", unread: true },
    { id: "n2", title: "اشتراك جديد", body: "خطة سنوية — عميل من السعودية", at: "قبل 25 دقيقة", unread: true },
    { id: "n3", title: "تنبيه أمني", body: "3 محاولات دخول فاشلة", at: "قبل ساعتين", unread: false },
  ],
  performance: [
    { label: "زمن الاستجابة", value: 92, target: 95 },
    { label: "نجاح الحسابات", value: 98, target: 99 },
    { label: "توافر الخدمة", value: 99.8, target: 99.9 },
    { label: "رضا العملاء", value: 89, target: 90 },
  ],
  userGrowth: MONTHS.map((label, i) => ({ label, total: 3200 + i * 1180 + (i % 2 ? 240 : 0) })),
  topServices: [
    { name: "حساب مكافأة نهاية الخدمة", value: 1420 },
    { name: "التسوية النهائية", value: 980 },
    { name: "الرصيد السنوي", value: 760 },
    { name: "تقرير قانوني", value: 540 },
    { name: "استشارة محامي", value: 310 },
  ],
  transactionStatus: [
    { name: "مكتملة", value: 3029 },
    { name: "معلّقة", value: 47 },
    { name: "قيد المعالجة", value: 184 },
    { name: "مرفوضة", value: 22 },
  ],
  series: {
    daily: series(DAYS, 180),
    weekly: series(WEEKS, 920),
    monthly: series(MONTHS, 2600),
  },
};

/** Swap the body of this function for a Supabase query / server fn later. */
export async function fetchDashboardData(): Promise<DashboardData> {
  return MOCK_DASHBOARD;
}
