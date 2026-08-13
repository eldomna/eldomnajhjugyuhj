import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSystemHealth } from "@/lib/backups.functions";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Database, Users, FileText, Eye, AlertTriangle, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/system")({
  component: SystemPage,
});

function SystemPage() {
  const router = useRouter();
  const fetchHealth = useServerFn(getSystemHealth);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "system-health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 30_000,
  });

  const healthy = data?.dbOk && (data?.dbLatency ?? 9999) < 1000 && (data?.counts.errors24h ?? 0) < 10;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">حالة النظام</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-1 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ الفحص...</div>
        ) : !data ? (
          <Card className="p-6 text-center text-destructive">تعذر جلب حالة النظام</Card>
        ) : (
          <>
            <Card className={`p-6 mb-6 border-2 ${healthy ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
              <div className="flex items-center gap-3">
                {healthy ? (
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                ) : (
                  <AlertTriangle className="h-10 w-10 text-amber-600" />
                )}
                <div>
                  <h2 className="text-xl font-bold">
                    {healthy ? "النظام يعمل بشكل طبيعي" : "يلزم الانتباه"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    آخر فحص: {new Date(data.timestamp).toLocaleString("ar")}
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <HealthCard
                icon={Database}
                label="قاعدة البيانات"
                value={data.dbOk ? "متصلة" : "خطأ"}
                sub={`${data.dbLatency} ms`}
                ok={data.dbOk}
              />
              <HealthCard
                icon={Users}
                label="المستخدمون"
                value={data.counts.users.toLocaleString("ar")}
                ok
              />
              <HealthCard
                icon={FileText}
                label="الحسابات"
                value={data.counts.calcs.toLocaleString("ar")}
                ok
              />
              <HealthCard
                icon={FileText}
                label="التقارير المُصدرة"
                value={data.counts.docs.toLocaleString("ar")}
                ok
              />
              <HealthCard
                icon={Eye}
                label="زيارات 24س"
                value={data.counts.views24h.toLocaleString("ar")}
                ok
              />
              <HealthCard
                icon={AlertTriangle}
                label="أخطاء 24س"
                value={data.counts.errors24h.toLocaleString("ar")}
                ok={data.counts.errors24h < 10}
              />
            </div>

            <Card className="p-6">
              <h3 className="font-bold mb-3">إجراءات سريعة</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => router.navigate({ to: "/admin/backups" })}>
                  إدارة النسخ الاحتياطية
                </Button>
                <Button variant="outline" onClick={() => router.navigate({ to: "/admin/audit" })}>
                  سجل التدقيق
                </Button>
                <Button variant="outline" onClick={() => router.navigate({ to: "/admin/notifications" })}>
                  الإشعارات
                </Button>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, sub, ok }: { icon: typeof Database; label: string; value: string; sub?: string; ok: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-primary" />
        {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
      </div>
      <div className="text-2xl font-bold mt-3">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
