import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "billing"],
    queryFn: async () => {
      const [txs, methods, providers, wallets] = await Promise.all([
        supabase
          .from("billing_transactions")
          .select("id, user_id, plan_code, amount, currency, status, provider_code, provider_txn_id, discount_amount, receipt_url, created_at")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.from("payment_methods").select("*").limit(50),
        supabase.from("payment_providers").select("*").limit(50),
        supabase.from("wallet_balances").select("*").limit(200),
      ]);
      const rows = txs.data ?? [];
      const paid = rows.filter((r) => r.status === "success" || r.status === "paid");
      const sum = (list: typeof rows) => list.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      return {
        rows,
        methods: methods.data ?? [],
        providers: providers.data ?? [],
        wallets: wallets.data ?? [],
        totals: {
          revenue: sum(paid),
          refunds: sum(rows.filter((r) => r.status === "refunded")),
          discounts: rows.reduce((s, r) => s + Number(r.discount_amount ?? 0), 0),
          pending: rows.filter((r) => r.status === "pending").length,
        },
      };
    },
  });

  const exportCsv = () => {
    const rows = data?.rows ?? [];
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = `\uFEFF${[keys.join(","), ...rows.map((r) => keys.map((k) => String((r as Record<string, unknown>)[k] ?? "")).join(","))].join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "billing.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      permission="billing.manage"
      title="الفوترة والمدفوعات"
      description="الفواتير والمدفوعات والخصومات والمبالغ المستردة وطرق الدفع والأرصدة"
      icon={Receipt}
      actions={
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4 ml-1" /> تصدير CSV
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-2xl font-bold">{(data?.totals.revenue ?? 0).toLocaleString("ar-SA")}</div>
          <div className="text-xs text-muted-foreground mt-1">إجمالي الإيرادات المحصّلة</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{(data?.totals.discounts ?? 0).toLocaleString("ar-SA")}</div>
          <div className="text-xs text-muted-foreground mt-1">إجمالي الخصومات</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{(data?.totals.refunds ?? 0).toLocaleString("ar-SA")}</div>
          <div className="text-xs text-muted-foreground mt-1">المبالغ المستردة</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{data?.totals.pending ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">عمليات معلّقة</div>
        </Card>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList className="mb-4">
          <TabsTrigger value="transactions">الفواتير والمدفوعات</TabsTrigger>
          <TabsTrigger value="methods">طرق الدفع</TabsTrigger>
          <TabsTrigger value="wallets">الأرصدة</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الخطة</th>
                  <th className="p-2 text-right">المبلغ</th>
                  <th className="p-2 text-right">الخصم</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">المزوّد</th>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">الإيصال</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جارٍ التحميل…</td></tr>
                )}
                {(data?.rows ?? []).map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{t.plan_code}</td>
                    <td className="p-2">{Number(t.amount).toLocaleString("ar-SA")} {t.currency}</td>
                    <td className="p-2">{Number(t.discount_amount ?? 0).toLocaleString("ar-SA")}</td>
                    <td className="p-2"><Badge variant="outline">{t.status}</Badge></td>
                    <td className="p-2 text-xs">{t.provider_code ?? "—"}</td>
                    <td className="p-2 text-xs">{new Date(t.created_at).toLocaleDateString("ar-SA")}</td>
                    <td className="p-2 text-xs">
                      {t.receipt_url ? (
                        <a className="text-primary" href={t.receipt_url} target="_blank" rel="noreferrer">عرض</a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {!isLoading && (data?.rows ?? []).length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد عمليات</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="methods">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-3">طرق الدفع</h3>
              <div className="space-y-2 text-sm">
                {(data?.methods ?? []).map((m, i) => (
                  <div key={i} className="border-b pb-2 last:border-0">
                    {String((m as Record<string, unknown>)["name_ar"] ?? (m as Record<string, unknown>)["code"] ?? "—")}
                  </div>
                ))}
                {(data?.methods ?? []).length === 0 && <p className="text-muted-foreground text-xs">لا توجد طرق دفع</p>}
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-3">مزوّدو الدفع</h3>
              <div className="space-y-2 text-sm">
                {(data?.providers ?? []).map((p, i) => (
                  <div key={i} className="border-b pb-2 last:border-0">
                    {String((p as Record<string, unknown>)["name_ar"] ?? (p as Record<string, unknown>)["code"] ?? "—")}
                  </div>
                ))}
                {(data?.providers ?? []).length === 0 && <p className="text-muted-foreground text-xs">لا يوجد مزوّدون</p>}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="wallets">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">المستخدم</th>
                  <th className="p-2 text-right">العملة</th>
                  <th className="p-2 text-right">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {(data?.wallets ?? []).map((w, i) => {
                  const row = w as Record<string, unknown>;
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-xs">{String(row["user_id"] ?? "—").slice(0, 8)}</td>
                      <td className="p-2">{String(row["currency"] ?? "—")}</td>
                      <td className="p-2">{Number(row["balance"] ?? 0).toLocaleString("ar-SA")}</td>
                    </tr>
                  );
                })}
                {(data?.wallets ?? []).length === 0 && (
                  <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">لا توجد أرصدة</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
