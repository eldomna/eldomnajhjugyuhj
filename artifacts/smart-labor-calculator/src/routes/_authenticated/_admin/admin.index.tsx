import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FolderOpen,
  FolderCheck,
  Globe2,
  FileText,
  Calculator,
  Timer,
  Gauge,
  Archive,
  AlertTriangle,
  RefreshCw,
  Activity,
} from "lucide-react";
export const Route = createFileRoute("/_authenticated/_admin/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin", "home-kpis"],
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
      const todayStart = new Date(new Date().toDateString()).toISOString();
      const [
        cases,
        openCases,
        closedCases,
        users,
        countriesActive,
        reports,
        calcsToday,
        calcsRecent,
        backup,
        alerts,
        aiRecent,
        casesRecent,
        auditRecent,
        errorsRecent,
      ] = await Promise.all([
        supabase.from("sa_cases").select("id", { count: "exact", head: true }),
        supabase.from("sa_cases").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("sa_cases").select("id", { count: "exact", head: true }).eq("status", "closed"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("countries").select("code", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("case_final_reports").select("id", { count: "exact", head: true }),
        supabase
          .from("case_calculations")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),
        supabase
          .from("case_calculations")
          .select(
            "confidence_score, calculation_started_at, calculation_completed_at, created_at, results, total_rights",
          )
          .gte("created_at", since30)
          .limit(500),
        supabase
          .from("backups")
          .select("created_at, table_name")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("security_alerts")
          .select("id, severity, alert_type, message, created_at")
          .eq("resolved", false)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("ai_usage_logs")
          .select("created_at, success, latency_ms")
          .gte("created_at", since30)
          .limit(1000),
        supabase
          .from("sa_cases")
          .select("id, employee_name, employer_name, status, total_amount, currency, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("audit_logs")
          .select("id, action, target_type, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("calculation_logs")
          .select("id, module_name, error_message, created_at")
          .eq("status", "error")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const calcRows = calcsRecent.data ?? [];
      const durations = calcRows
        .map((r) =>
          r.calculation_started_at && r.calculation_completed_at
            ? new Date(r.calculation_completed_at).getTime() - new Date(r.calculation_started_at).getTime()
            : null,
        )
        .filter((v): v is number => typeof v === "number" && v >= 0);
      const avgDuration = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
      const confidences = calcRows
        .map((r) => Number(r.confidence_score ?? 0))
        .filter((v) => v > 0);
      const avgConfidence = confidences.length
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : 0;

      const byMonth = new Map<string, number>();
      for (const c of calcRows) byMonth.set(monthKey(c.created_at), (byMonth.get(monthKey(c.created_at)) ?? 0) + 1);

      const aiRows = aiRecent.data ?? [];
      const aiByDay = new Map<string, number>();
      for (const a of aiRows) {
        const d = a.created_at.slice(0, 10);
        aiByDay.set(d, (aiByDay.get(d) ?? 0) + 1);
      }

      return {
        cases: cases.count ?? 0,
        openCases: openCases.count ?? 0,
        closedCases: closedCases.count ?? 0,
        users: users.count ?? 0,
        countriesActive: countriesActive.count ?? 0,
        reports: reports.count ?? 0,
        calcsToday: calcsToday.count ?? 0,
        avgDuration,
        avgConfidence,
        lastBackup: backup.data?.[0]?.created_at ?? null,
        alerts: alerts.data ?? [],
        calcByMonth: [...byMonth.entries()].sort().map(([m, v]) => ({ month: m, value: v })),
        aiByDay: [...aiByDay.entries()].sort().map(([d, v]) => ({ day: d.slice(5), value: v })),
        aiSuccess: aiRows.length
          ? Math.round((aiRows.filter((a) => a.success).length / aiRows.length) * 100)
          : 0,
        casesRecent: casesRecent.data ?? [],
        auditRecent: auditRecent.data ?? [],
        errorsRecent: errorsRecent.data ?? [],
        statusPie: [
          { name: "مفتوحة", value: openCases.count ?? 0 },
          { name: "مغلقة", value: closedCases.count ?? 0 },
        ],
      };
    },
    refetchInterval: 60_000,
  });

  const fmt = (n: number) => n.toLocaleString("ar-SA");
  const kpis = [
    { label: "عدد القضايا", value: fmt(data?.cases ?? 0), icon: Briefcase },
    { label: "القضايا المفتوحة", value: fmt(data?.openCases ?? 0), icon: FolderOpen },
    { label: "القضايا المغلقة", value: fmt(data?.closedCases ?? 0), icon: FolderCheck },
    { label: "عدد المستخدمين", value: fmt(data?.users ?? 0), icon: Users },
    { label: "الدول المفعّلة", value: fmt(data?.countriesActive ?? 0), icon: Globe2 },
    { label: "التقارير الصادرة", value: fmt(data?.reports ?? 0), icon: FileText },
    { label: "عمليات الحساب اليوم", value: fmt(data?.calcsToday ?? 0), icon: Calculator },
    { label: "متوسط زمن الحساب", value: `${fmt(data?.avgDuration ?? 0)} مل.ث`, icon: Timer },
    { label: "نسبة اكتمال البيانات", value: `${data?.avgConfidence ?? 0}%`, icon: Gauge },
    {
      label: "آخر نسخة احتياطية",
      value: data?.lastBackup ? new Date(data.lastBackup).toLocaleDateString("ar-SA") : "—",
      icon: Archive,
    },
    { label: "نجاح الذكاء الاصطناعي", value: `${data?.aiSuccess ?? 0}%`, icon: Gauge },
    { label: "تنبيهات النظام", value: fmt(data?.alerts.length ?? 0), icon: AlertTriangle },
  ];

  return (
    <AdminShell
      title="لوحة التحكم"
      description="مؤشرات الأداء الرئيسية والرسوم البيانية وآخر العمليات"
      icon={LayoutDashboard}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> تحديث
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/overview">
              <Gauge className="h-3.5 w-3.5 ml-1" /> لوحة المؤشرات
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/cases">
              <Briefcase className="h-3.5 w-3.5 ml-1" /> القضايا
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/users">
              <Users className="h-3.5 w-3.5 ml-1" /> المستخدمون
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/system">
              <Activity className="h-3.5 w-3.5 ml-1" /> حالة النظام
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <k.icon className="h-4 w-4 text-primary" />
            <div className="mt-2 text-2xl font-bold">{isLoading ? "—" : k.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-bold mb-3 text-sm">آخر القضايا</h3>
          <div className="space-y-2 text-sm">
            {(data?.casesRecent ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                <span className="truncate">{c.employee_name || "—"}</span>
                <Badge variant="outline">{c.status ?? "open"}</Badge>
              </div>
            ))}
            {!isLoading && (data?.casesRecent.length ?? 0) === 0 && (
              <p className="text-muted-foreground text-xs">لا توجد قضايا بعد</p>
            )}
          </div>
          <Link to="/admin/cases" className="text-xs text-primary mt-3 inline-block">
            إدارة القضايا
          </Link>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold mb-3 text-sm">آخر العمليات</h3>
          <div className="space-y-2 text-xs">
            {(data?.auditRecent ?? []).map((a) => (
              <div key={a.id} className="border-b pb-2 last:border-0">
                <div className="font-medium">{a.action}</div>
                <div className="text-muted-foreground">
                  {a.target_type ?? "—"} · {new Date(a.created_at).toLocaleString("ar-SA")}
                </div>
              </div>
            ))}
            {!isLoading && (data?.auditRecent.length ?? 0) === 0 && (
              <p className="text-muted-foreground">لا توجد عمليات</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold mb-3 text-sm">التنبيهات وآخر الأخطاء</h3>
          <div className="space-y-2 text-xs">
            {(data?.alerts ?? []).map((a) => (
              <div key={a.id} className="border-b pb-2 last:border-0">
                <Badge variant="destructive" className="mb-1">
                  {a.severity}
                </Badge>
                <div>{a.message}</div>
              </div>
            ))}
            {(data?.errorsRecent ?? []).map((e) => (
              <div key={e.id} className="border-b pb-2 last:border-0">
                <div className="font-medium">{e.module_name}</div>
                <div className="text-muted-foreground">{e.error_message ?? "خطأ غير محدد"}</div>
              </div>
            ))}
            {!isLoading &&
              (data?.alerts.length ?? 0) === 0 &&
              (data?.errorsRecent.length ?? 0) === 0 && (
                <p className="text-muted-foreground">لا توجد تنبيهات أو أخطاء</p>
              )}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
