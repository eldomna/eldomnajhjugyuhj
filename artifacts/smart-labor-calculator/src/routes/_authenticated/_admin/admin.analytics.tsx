import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Eye, FileText, Calculator, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "analytics", "30d"],
    queryFn: async () => {
      const [views, docs, calcs] = await Promise.all([
        supabase
          .from("page_views")
          .select("path, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10000),
        supabase
          .from("documents")
          .select("created_at, total_amount")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("calculations")
          .select("created_at, total_due")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
      ]);
      return {
        views: views.data ?? [],
        docs: docs.data ?? [],
        calcs: calcs.data ?? [],
      };
    },
  });

  // Aggregations
  const byPath = new Map<string, number>();
  const dayKeys: string[] = [];
  const dayMap = new Map<string, { day: string; views: number; docs: number; calcs: number }>();

  // seed last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toLocaleDateString("en-CA");
    dayKeys.push(d);
    dayMap.set(d, { day: d, views: 0, docs: 0, calcs: 0 });
  }

  for (const v of data?.views ?? []) {
    byPath.set(v.path, (byPath.get(v.path) ?? 0) + 1);
    const day = new Date(v.created_at).toLocaleDateString("en-CA");
    const row = dayMap.get(day);
    if (row) row.views += 1;
  }
  for (const d of data?.docs ?? []) {
    const day = new Date(d.created_at).toLocaleDateString("en-CA");
    const row = dayMap.get(day);
    if (row) row.docs += 1;
  }
  for (const c of data?.calcs ?? []) {
    const day = new Date(c.created_at).toLocaleDateString("en-CA");
    const row = dayMap.get(day);
    if (row) row.calcs += 1;
  }

  const dailyData = dayKeys.map((k) => dayMap.get(k)!);
  const topPaths = Array.from(byPath, ([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalViews = data?.views.length ?? 0;
  const totalDocs = data?.docs.length ?? 0;
  const totalCalcs = data?.calcs.length ?? 0;
  const conversion = totalCalcs > 0 ? ((totalDocs / totalCalcs) * 100).toFixed(1) : "0.0";

  const kpis = [
    { label: "زيارات (30 يوم)", value: totalViews, icon: Eye },
    { label: "حسابات أُجريت", value: totalCalcs, icon: Calculator },
    { label: "مستندات صدرت", value: totalDocs, icon: FileText },
    { label: "نسبة التحويل %", value: `${conversion}%`, icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">تحليلات المنصة (آخر 30 يوم)</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((k) => (
            <Card key={k.label} className="p-5">
              <k.icon className="h-5 w-5 text-primary" />
              <div className="mt-3 text-2xl font-bold">
                {isLoading ? "—" : typeof k.value === "number" ? k.value.toLocaleString("ar") : k.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
            </Card>
          ))}
        </div>

        <Card className="p-5 mb-6">
          <h2 className="font-semibold mb-4">النشاط اليومي</h2>
          <div className="h-72">
            {isLoading ? (
              <div className="h-full grid place-items-center text-muted-foreground">جاري التحميل…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="views" name="زيارات" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="calcs" name="حسابات" stroke="#157347" strokeWidth={2} />
                  <Line type="monotone" dataKey="docs" name="مستندات" stroke="#dc8a00" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h2 className="font-semibold mb-4">المستندات الصادرة يومياً</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="docs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold mb-4">أكثر الصفحات زيارة</h2>
            <div className="space-y-2">
              {topPaths.map((p) => {
                const max = topPaths[0]?.count || 1;
                return (
                  <div key={p.path} className="flex items-center gap-3">
                    <div className="w-40 truncate text-sm text-muted-foreground font-mono" dir="ltr">{p.path}</div>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${(p.count / max) * 100}%` }} />
                    </div>
                    <div className="w-14 text-end font-semibold tabular-nums">{p.count}</div>
                  </div>
                );
              })}
              {!isLoading && topPaths.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
