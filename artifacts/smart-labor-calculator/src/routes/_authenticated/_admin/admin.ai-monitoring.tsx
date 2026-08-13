import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_authenticated/_admin/admin/ai-monitoring")({
  component: AiMonitoringPage,
});

function AiMonitoringPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "ai-monitoring"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("ai_usage_logs")
        .select("feature, model, document_type, latency_ms, success, quality_rating, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      const list = rows ?? [];
      const total = list.length;
      const ok = list.filter((r) => r.success).length;
      const latencies = list.map((r) => r.latency_ms ?? 0).filter((v) => v > 0);
      const ratings = list.map((r) => r.quality_rating ?? 0).filter((v) => v > 0);
      const byDoc = new Map<string, number>();
      for (const r of list) {
        const key = r.document_type ?? "غير محدد";
        byDoc.set(key, (byDoc.get(key) ?? 0) + 1);
      }
      const byFeature = new Map<string, number>();
      for (const r of list) byFeature.set(r.feature, (byFeature.get(r.feature) ?? 0) + 1);
      return {
        total,
        successRate: total ? Math.round((ok / total) * 100) : 0,
        avgLatency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
        avgQuality: ratings.length
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : 0,
        errors: list.filter((r) => !r.success).slice(0, 15),
        docChart: [...byDoc.entries()].map(([name, value]) => ({ name, value })).slice(0, 10),
        featureChart: [...byFeature.entries()].map(([name, value]) => ({ name, value })).slice(0, 10),
        recent: list.slice(0, 25),
      };
    },
    refetchInterval: 60_000,
  });

  return (
    <AdminShell
      permission="ai.view"
      title="مراقبة الذكاء الاصطناعي"
      description="عدد التحليلات وزمن التنفيذ ونسبة النجاح وجودة النتائج وأكثر المستندات تحليلاً"
      icon={Brain}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-2xl font-bold">{isLoading ? "—" : data?.total}</div>
          <div className="text-xs text-muted-foreground mt-1">عدد التحليلات</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{data?.successRate ?? 0}%</div>
          <Progress value={data?.successRate ?? 0} className="mt-2 h-2" />
          <div className="text-xs text-muted-foreground mt-1">نسبة النجاح</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{data?.avgLatency ?? 0} مل.ث</div>
          <div className="text-xs text-muted-foreground mt-1">متوسط زمن التنفيذ</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{data?.avgQuality ?? 0}/5</div>
          <div className="text-xs text-muted-foreground mt-1">جودة النتائج (تقييم المستخدمين)</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">أكثر المستندات تحليلاً</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.docChart ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">التحليلات حسب الميزة</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.featureChart ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">آخر الأخطاء</h3>
          <div className="space-y-2 text-xs">
            {(data?.errors ?? []).map((e, i) => (
              <div key={i} className="border-b pb-2 last:border-0">
                <Badge variant="destructive" className="mb-1">{e.feature}</Badge>
                <div className="text-muted-foreground">{e.error_message ?? "خطأ غير محدد"}</div>
              </div>
            ))}
            {(data?.errors ?? []).length === 0 && <p className="text-muted-foreground">لا توجد أخطاء</p>}
          </div>
        </Card>
        <Card className="p-4 overflow-x-auto">
          <h3 className="font-bold text-sm mb-3">آخر التحليلات</h3>
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right">الميزة</th>
                <th className="p-2 text-right">الموديل</th>
                <th className="p-2 text-right">الزمن</th>
                <th className="p-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent ?? []).map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{r.feature}</td>
                  <td className="p-2">{r.model ?? "—"}</td>
                  <td className="p-2">{r.latency_ms ?? 0} مل.ث</td>
                  <td className="p-2">
                    <Badge variant={r.success ? "outline" : "destructive"}>{r.success ? "نجاح" : "فشل"}</Badge>
                  </td>
                </tr>
              ))}
              {(data?.recent ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">لا توجد بيانات بعد</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </AdminShell>
  );
}
