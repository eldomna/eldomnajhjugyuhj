import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/reports-center")({
  component: ReportsCenterPage,
});

const CATEGORIES = [
  { value: "legal", label: "التقارير القانونية" },
  { value: "financial", label: "التقارير المالية" },
  { value: "admin", label: "التقارير الإدارية" },
  { value: "performance", label: "تقارير الأداء" },
  { value: "ai", label: "تقارير الذكاء الاصطناعي" },
  { value: "usage", label: "تقارير الاستخدام" },
];

function toCsv(rows: Array<Record<string, unknown>>, name: string) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const csv = `\uFEFF${[keys.join(","), ...rows.map((r) => keys.map((k) => String(r[k] ?? "")).join(","))].join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsCenterPage() {
  const [category, setCategory] = useState("legal");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports-center", category],
    queryFn: async () => {
      if (category === "legal") {
        const { data } = await supabase
          .from("case_final_reports")
          .select("report_number, report_type, country, currency, final_balance, confidence_score, generated_at, archived")
          .order("generated_at", { ascending: false })
          .limit(200);
        return (data ?? []) as Array<Record<string, unknown>>;
      }
      if (category === "financial") {
        const { data } = await supabase
          .from("billing_transactions")
          .select("plan_code, amount, currency, status, provider_code, discount_amount, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        return (data ?? []) as Array<Record<string, unknown>>;
      }
      if (category === "admin") {
        const { data } = await supabase
          .from("audit_logs")
          .select("action, target_type, target_id, ip_address, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        return (data ?? []) as Array<Record<string, unknown>>;
      }
      if (category === "performance") {
        const { data } = await supabase
          .from("calculation_logs")
          .select("module_name, step_number, status, execution_time_ms, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        return (data ?? []) as Array<Record<string, unknown>>;
      }
      if (category === "ai") {
        const { data } = await supabase
          .from("ai_usage_logs")
          .select("feature, model, document_type, latency_ms, success, quality_rating, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        return (data ?? []) as Array<Record<string, unknown>>;
      }
      const { data } = await supabase
        .from("api_usage_logs")
        .select("endpoint, method, status_code, response_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });

  const keys = data && data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <AdminShell
      permission="reports.view"
      title="مركز التقارير"
      description="تقارير قانونية ومالية وإدارية وتقارير أداء واستخدام وذكاء اصطناعي قابلة للتصدير"
      icon={FileText}
      actions={
        <Button size="sm" variant="outline" onClick={() => toCsv(data ?? [], `report-${category}`)}>
          <Download className="h-4 w-4 ml-1" /> تصدير CSV
        </Button>
      }
    >
      <Card className="p-4 mb-4">
        <Label className="text-xs">نوع التقرير</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline">عدد السجلات: {data?.length ?? 0}</Badge>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              {keys.map((k) => (
                <th key={k} className="p-2 text-right whitespace-nowrap">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td className="p-6 text-center text-muted-foreground" colSpan={Math.max(keys.length, 1)}>جارٍ التحميل…</td></tr>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <tr><td className="p-6 text-center text-muted-foreground" colSpan={1}>لا توجد بيانات</td></tr>
            )}
            {(data ?? []).map((row, i) => (
              <tr key={i} className="border-t">
                {keys.map((k) => (
                  <td key={k} className="p-2 whitespace-nowrap">{String(row[k] ?? "—")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
