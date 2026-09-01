import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Users,
  ShoppingCart,
  Activity,
  Wallet,
  Clock,
  CheckCircle2,
  Gauge,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchDashboardData, type Kpi } from "@/lib/admin/dashboard";

export const Route = createFileRoute("/_authenticated/_admin/admin/overview")({
  component: AdminOverviewPage,
});

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users,
  orders: ShoppingCart,
  active: Activity,
  revenue: Wallet,
  pending: Clock,
  completed: CheckCircle2,
};

function formatKpi(kpi: Kpi) {
  if (kpi.format === "currency") return `${kpi.value.toLocaleString("ar-SA")} ر.س`;
  if (kpi.format === "percent") return `${kpi.value}%`;
  return kpi.value.toLocaleString("ar-SA");
}

type Range = "daily" | "weekly" | "monthly";
const RANGE_LABELS: Record<Range, string> = { daily: "يومي", weekly: "أسبوعي", monthly: "شهري" };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function AdminOverviewPage() {
  const [range, setRange] = useState<Range>("daily");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard-overview"],
    queryFn: fetchDashboardData,
  });

  const series = data?.series[range] ?? [];

  return (
    <AdminShell
      title="لوحة المؤشرات"
      description="مؤشرات الأداء والرسوم البيانية التفاعلية — بيانات حية من قاعدة البيانات"
      icon={Gauge}
      permission="overview.view"
      actions={
        <div className="flex gap-1 rounded-md border p-1">
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "ghost"}
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </Button>
          ))}
        </div>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {(data?.kpis ?? []).map((k) => {
          const Icon = ICONS[k.key] ?? Activity;
          return (
            <Card key={k.key} className="p-4">
              <Icon className="h-4 w-4 text-primary" />
              <div className="mt-2 truncate text-xl font-bold">{isLoading ? "—" : formatKpi(k)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{k.label}</div>
              <div
                className={`mt-1 text-[11px] font-medium ${k.delta >= 0 ? "text-emerald-600" : "text-destructive"}`}
              >
                {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}%
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title={`المستخدمون والطلبات — ${RANGE_LABELS[range]}`}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="users" name="المستخدمون" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="orders" name="الطلبات" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title={`الإيرادات — ${RANGE_LABELS[range]}`}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke={COLORS[4]} fill={COLORS[4]} fillOpacity={0.2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="نمو المستخدمين">
          <LineChart data={data?.userGrowth ?? []}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="total" name="المستخدمون" stroke={COLORS[1]} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="حالة المعاملات">
          <PieChart>
            <Pie data={data?.transactionStatus ?? []} dataKey="value" nameKey="name" outerRadius={90} label>
              {(data?.transactionStatus ?? []).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-bold">آخر النشاطات</h3>
          <div className="space-y-2 text-sm">
            {(data?.activity ?? []).map((a) => (
              <div key={a.id} className="border-b pb-2 last:border-0">
                <div className="font-medium truncate">{a.actor}</div>
                <div className="text-xs text-muted-foreground">
                  {a.action} · {a.at}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-bold">الإشعارات</h3>
          <div className="space-y-2 text-sm">
            {(data?.notifications ?? []).map((n) => (
              <div key={n.id} className="border-b pb-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{n.title}</span>
                  {n.unread && <Badge variant="secondary" className="text-[10px]">جديد</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{n.body}</div>
                <div className="text-[11px] text-muted-foreground/70">{n.at}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="h-4 w-4 text-primary" /> مؤشرات الأداء
          </h3>
          <div className="space-y-3">
            {(data?.performance ?? []).map((p) => (
              <div key={p.label}>
                <div className="flex items-center justify-between text-xs">
                  <span>{p.label}</span>
                  <span className="text-muted-foreground">
                    {p.value}% / {p.target}%
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (p.value / p.target) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-2 mt-5 text-sm font-bold">أكثر الخدمات استخداماً</h3>
          <div className="space-y-2 text-sm">
            {(data?.topServices ?? []).map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-2">
                <span className="truncate">{s.name}</span>
                <Badge variant="outline">{s.value.toLocaleString("ar-SA")}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
