import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Copy, Wallet, Percent, Users, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "برنامج الإحالات • حاسبة العمال الذكية" },
      { name: "description", content: "رمز الإحالة الخاص بك، عدد الإحالات الناجحة، ونوع المكافأة: رصيد محفظة أو اشتراكات مجانية أو عمولة مالية." },
      { property: "og:title", content: "برنامج الإحالات • حاسبة العمال الذكية" },
      { property: "og:description", content: "شارك رمز الإحالة واحصل على رصيد أو اشتراك مجاني أو عمولة عن كل عملية دفع ناجحة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralsPage,
});

type RewardType = "wallet_credit" | "free_subscription" | "commission";

const REWARDS: { value: RewardType; title: string; desc: string }[] = [
  {
    value: "wallet_credit",
    title: "رصيد داخل المنصة",
    desc: "رصيد في محفظتك بعملة العملية (SAR للعمليات السعودية، YER للعمليات اليمنية) يُستخدم لدفع قيمة الحسبة أو الاشتراك.",
  },
  {
    value: "free_subscription",
    title: "اشتراكات مجانية",
    desc: "اشتراك مجاني عند الوصول إلى عدد محدد من الإحالات الناجحة (تُحدَّد الأعداد من الإدارة).",
  },
  {
    value: "commission",
    title: "عمولة مالية",
    desc: "عمولة عن كل عملية شراء ناجحة بالرمز، تُجمع في محفظتك وتصرفها الإدارة يدوياً بعد المراجعة.",
  },
];

type WalletRow = {
  currency: string;
  balance: number;
  spent: number;
  withdrawn: number;
  pending_withdraw: number;
  min_withdraw: number;
};

type WithdrawalRow = {
  id: string;
  amount: number;
  currency: string;
  method: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

const money = (n: number) => new Intl.NumberFormat("en-US").format(Number(n || 0));

function ReferralsPage() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [wdCurrency, setWdCurrency] = useState<"SAR" | "YER">("YER");
  const [wdAmount, setWdAmount] = useState("");
  const [wdMethod, setWdMethod] = useState("");
  const [wdAccount, setWdAccount] = useState("");


  const { data: stats, isLoading } = useQuery({
    queryKey: ["my-referral-stats"],
    queryFn: async () => {
      await supabase.rpc("get_my_referral_code");
      const { data, error } = await supabase.rpc("get_my_referral_stats");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      return row ?? null;
    },
  });

  const { data: rewards } = useQuery({
    queryKey: ["my-referral-rewards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_rewards")
        .select("id, kind, amount, currency, free_days, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["my-wallet-summary"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_my_wallet_summary");
      if (error) return [];
      return (data ?? []) as WalletRow[];
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["my-withdrawals"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("referral_withdrawals")
        .select("id, amount, currency, method, status, admin_notes, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return (data ?? []) as WithdrawalRow[];
    },
  });

  const submitWithdrawal = async () => {
    const amount = Number(wdAmount);
    if (!amount || amount <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    setSaving(true);
    const { error } = await (supabase.rpc as any)("request_withdrawal", {
      _currency: wdCurrency,
      _amount: amount,
      _method: wdMethod.trim() || null,
      _account_details: wdAccount.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message || "تعذّر إرسال طلب السحب");
    toast.success("تم إرسال طلب السحب للمراجعة");
    setWdAmount("");
    qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["my-wallet-summary"] });
  };


  const code = stats?.code ?? "";
  const link = typeof window !== "undefined" && code ? `${window.location.origin}/auth?ref=${code}` : "";

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`تم نسخ ${label}`);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const chooseReward = async (type: RewardType) => {
    setSaving(true);
    const { error } = await supabase.rpc("set_my_reward_type", { _type: type });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("disabled") ? "تغيير نوع المكافأة معطّل من الإدارة" : "تعذّر تحديث نوع المكافأة");
      return;
    }
    toast.success("تم تحديد نوع المكافأة");
    qc.invalidateQueries({ queryKey: ["my-referral-stats"] });
  };

  const rewardLabel = (kind: string) =>
    kind === "wallet_credit" ? "رصيد" : kind === "commission" ? "عمولة" : "اشتراك مجاني";
  const statusLabel = (s: string) =>
    s === "paid" ? "مصروفة" : s === "granted" ? "مُمنوح" : s === "approved" ? "معتمدة" : "قيد المراجعة";

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">برنامج الإحالات</h1>
        </div>

        <Card className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">رمز الإحالة</div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border bg-muted px-3 py-2 font-mono text-lg font-bold" dir="ltr">
                  {isLoading ? "…" : code || "—"}
                </span>
                <Button variant="outline" size="sm" onClick={() => copy(code, "الرمز")} disabled={!code}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">رابط الإحالة</div>
              <div className="flex items-center gap-2">
                <span className="truncate rounded-md border bg-muted px-3 py-2 text-xs" dir="ltr">
                  {link || "—"}
                </span>
                <Button variant="outline" size="sm" onClick={() => copy(link, "الرابط")} disabled={!link}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            يحصل العميل على خصم {money(stats?.discount_percent ?? 10)}٪ عند استخدام رمزك، ولا تُحتسب أي مكافأة إلا بعد
            نجاح عملية الدفع.
          </p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <Users className="h-5 w-5 text-primary" />
            <div className="mt-3 text-2xl font-bold">{stats?.uses_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">عدد مرات استخدام الرمز</div>
          </Card>
          <Card className="p-5">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div className="mt-3 text-2xl font-bold">{stats?.converted_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">إحالات ناجحة (بعد الدفع)</div>
          </Card>
          <Card className="p-5">
            <Percent className="h-5 w-5 text-primary" />
            <div className="mt-3 text-2xl font-bold">{money(stats?.total_discounts ?? 0)}</div>
            <div className="text-xs text-muted-foreground">إجمالي الخصومات الممنوحة للعملاء</div>
          </Card>
          <Card className="p-5">
            <Wallet className="h-5 w-5 text-primary" />
            <div className="mt-3 text-2xl font-bold">{money(stats?.total_sales ?? 0)}</div>
            <div className="text-xs text-muted-foreground">إجمالي المبيعات الناتجة عن الرمز</div>
          </Card>
        </div>

        <Card className="p-6 space-y-3">
          <h2 className="font-bold">نوع المكافأة</h2>
          <p className="text-xs text-muted-foreground">
            اختر نوعاً واحداً فقط. لا يمكن الجمع بين أكثر من نوع في الوقت نفسه.
            {stats && !stats.allow_change ? " (تغيير النوع معطّل حالياً من الإدارة)" : ""}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {REWARDS.map((r) => {
              const active = stats?.reward_type === r.value;
              return (
                <Card
                  key={r.value}
                  className={`p-4 space-y-2 ${active ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm">{r.title}</h3>
                    {active ? <Badge>مختار</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "default"}
                    className="w-full"
                    disabled={saving || active || (stats ? !stats.allow_change && !!stats.reward_chosen_at : false)}
                    onClick={() => chooseReward(r.value)}
                  >
                    {active ? "النوع الحالي" : "اختيار"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="text-xs text-muted-foreground">رصيد المحفظة (SAR)</div>
            <div className="mt-2 text-2xl font-bold">{money(stats?.wallet_sar ?? 0)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs text-muted-foreground">رصيد المحفظة (YER)</div>
            <div className="mt-2 text-2xl font-bold">{money(stats?.wallet_yer ?? 0)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs text-muted-foreground">عمولات قيد الصرف / مصروفة</div>
            <div className="mt-2 text-2xl font-bold">
              {money(stats?.commission_pending ?? 0)} / {money(stats?.commission_paid ?? 0)}
            </div>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="font-bold">المحفظة وسحب الأرصدة</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(wallet ?? []).map((w) => (
              <div key={w.currency} className="rounded-lg border p-4 text-sm space-y-1">
                <div className="font-bold" dir="ltr">{w.currency}</div>
                <div>الرصيد المتاح: <b>{money(w.balance)}</b></div>
                <div className="text-xs text-muted-foreground">مستخدم في الاشتراكات: {money(w.spent)}</div>
                <div className="text-xs text-muted-foreground">مسحوب: {money(w.withdrawn)}</div>
                <div className="text-xs text-muted-foreground">قيد السحب: {money(w.pending_withdraw)}</div>
                <div className="text-xs text-muted-foreground">الحد الأدنى للسحب: {money(w.min_withdraw)}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">العملة</label>
              <select
                value={wdCurrency}
                onChange={(e) => setWdCurrency(e.target.value as "SAR" | "YER")}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="YER">YER</option>
                <option value="SAR">SAR</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">المبلغ</label>
              <input
                dir="ltr"
                inputMode="decimal"
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">وسيلة الاستلام</label>
              <input
                value={wdMethod}
                onChange={(e) => setWdMethod(e.target.value)}
                maxLength={60}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">بيانات الحساب</label>
              <input
                value={wdAccount}
                onChange={(e) => setWdAccount(e.target.value)}
                maxLength={160}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
          </div>
          <Button size="sm" onClick={submitWithdrawal} disabled={saving}>
            إرسال طلب سحب
          </Button>

          {withdrawals?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">المبلغ</th>
                    <th className="p-2 text-start">الحالة</th>
                    <th className="p-2 text-start">ملاحظات</th>
                    <th className="p-2 text-start">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="border-t">
                      <td className="p-2" dir="ltr">{money(w.amount)} {w.currency}</td>
                      <td className="p-2">
                        <Badge variant={w.status === "paid" ? "default" : "secondary"}>
                          {w.status === "paid" ? "مصروف" : w.status === "approved" ? "معتمد" : w.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{w.admin_notes ?? "—"}</td>
                      <td className="p-2" dir="ltr">{new Date(w.created_at).toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">لا توجد طلبات سحب بعد.</p>
          )}
        </Card>



        <Card className="p-6">
          <h2 className="font-bold mb-3">سجل المكافآت</h2>
          {!rewards?.length ? (
            <p className="text-sm text-muted-foreground">لا توجد مكافآت بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">النوع</th>
                    <th className="p-2 text-start">القيمة</th>
                    <th className="p-2 text-start">الحالة</th>
                    <th className="p-2 text-start">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{rewardLabel(r.kind)}</td>
                      <td className="p-2">
                        {r.kind === "free_subscription"
                          ? `${r.free_days ?? 0} يوم`
                          : `${money(Number(r.amount ?? 0))} ${r.currency ?? ""}`}
                      </td>
                      <td className="p-2">{statusLabel(r.status)}</td>
                      <td className="p-2" dir="ltr">
                        {new Date(r.created_at).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
