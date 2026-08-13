import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Save, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/referrals")({
  component: AdminReferrals,
});

type Settings = {
  discount_percent: number;
  credit_per_referral_sar: number;
  credit_per_referral_yer: number;
  commission_percent: number;
  min_withdraw_sar: number;
  min_withdraw_yer: number;
  free_tier_1_count: number;
  free_tier_1_days: number;
  free_tier_2_count: number;
  free_tier_2_days: number;
  free_tier_3_count: number;
  free_tier_3_days: number;
  allow_user_change_reward: boolean;
  is_active: boolean;
};

type Withdrawal = {
  id: string;
  full_name: string | null;
  email: string | null;
  amount: number;
  currency: string;
  method: string | null;
  account_details: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};


const REWARD_LABEL: Record<string, string> = {
  wallet_credit: "رصيد محفظة",
  free_subscription: "اشتراكات مجانية",
  commission: "عمولة مالية",
};

const money = (n: unknown) => new Intl.NumberFormat("en-US").format(Number(n ?? 0));

function AdminReferrals() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["admin", "referral-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("referral_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) setForm(settings as unknown as Settings);
  }, [settings]);

  const { data: rows } = useQuery({
    queryKey: ["admin", "referral-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_referral_overview");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rewards } = useQuery({
    queryKey: ["admin", "referral-rewards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_rewards")
        .select("id, referrer_id, kind, amount, currency, free_days, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_withdrawals");
      if (error) return [];
      return (data ?? []) as Withdrawal[];
    },
  });

  const reviewWithdrawal = async (id: string, status: "approved" | "rejected" | "paid") => {
    const notes = status === "rejected" ? window.prompt("سبب الرفض (اختياري)") ?? undefined : undefined;
    const { error } = await (supabase.rpc as any)("admin_review_withdrawal", { _id: id, _status: status, _notes: notes ?? null });
    if (error) return toast.error(error.message || "تعذّر تحديث الطلب");
    toast.success("تم تحديث طلب السحب");
    qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
    qc.invalidateQueries({ queryKey: ["admin", "referral-overview"] });
  };

  const cancelReward = async (rewardId: string) => {
    const notes = window.prompt("سبب الإلغاء (اختياري)") ?? undefined;
    const { error } = await (supabase.rpc as any)("admin_adjust_reward", {
      _reward_id: rewardId,
      _amount: null,
      _status: "cancelled",
      _notes: notes ?? null,
    });
    if (error) return toast.error(error.message || "تعذّر إلغاء المكافأة");
    toast.success("تم إلغاء المكافأة");
    qc.invalidateQueries({ queryKey: ["admin", "referral-rewards"] });
  };

  const editRewardAmount = async (rewardId: string, current: unknown) => {
    const input = window.prompt("القيمة الجديدة للعمولة", String(Number(current ?? 0)));
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount < 0) return toast.error("قيمة غير صحيحة");
    const { error } = await (supabase.rpc as any)("admin_adjust_reward", {
      _reward_id: rewardId,
      _amount: amount,
      _status: null,
      _notes: null,
    });
    if (error) return toast.error(error.message || "تعذّر تعديل القيمة");
    toast.success("تم تعديل قيمة المكافأة");
    qc.invalidateQueries({ queryKey: ["admin", "referral-rewards"] });
  };


  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase.from("referral_settings").update(form).eq("id", 1);
    setSaving(false);
    if (error) return toast.error("تعذّر حفظ الإعدادات");
    toast.success("تم حفظ إعدادات برنامج الإحالات");
    qc.invalidateQueries({ queryKey: ["admin", "referral-settings"] });
  };

  const setRewardType = async (userId: string, type: string) => {
    const { error } = await supabase.rpc("admin_set_reward_type", { _user_id: userId, _type: type });
    if (error) return toast.error("تعذّر تغيير نوع المكافأة");
    toast.success("تم تغيير نوع المكافأة");
    qc.invalidateQueries({ queryKey: ["admin", "referral-overview"] });
  };

  const toggleCode = async (codeId: string, active: boolean) => {
    const { error } = await supabase.rpc("admin_toggle_referral_code", { _code_id: codeId, _active: active });
    if (error) return toast.error("تعذّر تحديث حالة الرمز");
    toast.success(active ? "تم تفعيل الرمز" : "تم إيقاف الرمز");
    qc.invalidateQueries({ queryKey: ["admin", "referral-overview"] });
  };

  const markPaid = async (rewardId: string) => {
    const { error } = await supabase.rpc("admin_mark_reward_paid", { _reward_id: rewardId, _notes: undefined });
    if (error) return toast.error("تعذّر اعتماد الصرف");
    toast.success("تم اعتماد المكافأة");
    qc.invalidateQueries({ queryKey: ["admin", "referral-rewards"] });
  };

  const exportCsv = () => {
    const header = ["code", "user", "email", "reward_type", "active", "uses", "converted", "sales", "discounts", "wallet_sar", "wallet_yer", "commission_pending"];
    const lines = (rows ?? []).map((r: Record<string, unknown>) =>
      [r.code, r.full_name, r.email, r.reward_type, r.is_active, r.uses_count, r.converted_count, r.total_sales, r.total_discounts, r.wallet_sar, r.wallet_yer, r.commission_pending]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `referrals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const num = (key: keyof Settings) => (
    <Input
      type="number"
      dir="ltr"
      value={String(form?.[key] ?? 0)}
      onChange={(e) => setForm((f) => (f ? { ...f, [key]: Number(e.target.value) } : f))}
    />
  );

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">برنامج الإحالات</h1>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" /> تصدير Excel/CSV
          </Button>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="font-bold">إعدادات البرنامج</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5"><Label>نسبة خصم العميل (٪)</Label>{num("discount_percent")}</div>
            <div className="space-y-1.5"><Label>نسبة العمولة (٪)</Label>{num("commission_percent")}</div>
            <div className="space-y-1.5"><Label>رصيد لكل إحالة (SAR)</Label>{num("credit_per_referral_sar")}</div>
            <div className="space-y-1.5"><Label>رصيد لكل إحالة (YER)</Label>{num("credit_per_referral_yer")}</div>
            <div className="space-y-1.5"><Label>الحد الأدنى للسحب (SAR)</Label>{num("min_withdraw_sar")}</div>
            <div className="space-y-1.5"><Label>الحد الأدنى للسحب (YER)</Label>{num("min_withdraw_yer")}</div>

            <div className="space-y-1.5"><Label>إحالات المستوى 1</Label>{num("free_tier_1_count")}</div>
            <div className="space-y-1.5"><Label>أيام المستوى 1</Label>{num("free_tier_1_days")}</div>
            <div className="space-y-1.5"><Label>إحالات المستوى 2</Label>{num("free_tier_2_count")}</div>
            <div className="space-y-1.5"><Label>أيام المستوى 2</Label>{num("free_tier_2_days")}</div>
            <div className="space-y-1.5"><Label>إحالات المستوى 3</Label>{num("free_tier_3_count")}</div>
            <div className="space-y-1.5"><Label>أيام المستوى 3</Label>{num("free_tier_3_days")}</div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!form?.allow_user_change_reward}
                onChange={(e) => setForm((f) => (f ? { ...f, allow_user_change_reward: e.target.checked } : f))}
              />
              السماح للمستخدم بتغيير نوع المكافأة
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!form?.is_active}
                onChange={(e) => setForm((f) => (f ? { ...f, is_active: e.target.checked } : f))}
              />
              برنامج الإحالات مُفعّل
            </label>
            <Button size="sm" className="gap-2" onClick={save} disabled={saving || !form}>
              <Save className="h-4 w-4" /> حفظ
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold mb-3">رموز الإحالة</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">الرمز</th>
                  <th className="p-2 text-start">المستخدم</th>
                  <th className="p-2 text-start">نوع المكافأة</th>
                  <th className="p-2 text-start">الاستخدامات</th>
                  <th className="p-2 text-start">الناجحة</th>
                  <th className="p-2 text-start">المبيعات</th>
                  <th className="p-2 text-start">الخصومات</th>
                  <th className="p-2 text-start">المحفظة</th>
                  <th className="p-2 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r: Record<string, string | number | boolean>) => (
                  <tr key={String(r.code_id)} className="border-t">
                    <td className="p-2 font-mono" dir="ltr">{String(r.code)}</td>
                    <td className="p-2">
                      <div>{String(r.full_name ?? "—")}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{String(r.email ?? "")}</div>
                    </td>
                    <td className="p-2">
                      <select
                        value={String(r.reward_type)}
                        onChange={(e) => setRewardType(String(r.user_id), e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {Object.keys(REWARD_LABEL).map((k) => (
                          <option key={k} value={k}>{REWARD_LABEL[k]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">{money(r.uses_count)}</td>
                    <td className="p-2">{money(r.converted_count)}</td>
                    <td className="p-2">{money(r.total_sales)}</td>
                    <td className="p-2">{money(r.total_discounts)}</td>
                    <td className="p-2 text-xs">
                      {money(r.wallet_sar)} SAR / {money(r.wallet_yer)} YER
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant={r.is_active ? "outline" : "default"} onClick={() => toggleCode(String(r.code_id), !r.is_active)}>
                        {r.is_active ? "إيقاف" : "تفعيل"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!rows?.length ? (
                  <tr><td colSpan={9} className="p-3 text-center text-muted-foreground">لا توجد رموز إحالة بعد.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold mb-3">المكافآت والعمولات</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">النوع</th>
                  <th className="p-2 text-start">القيمة</th>
                  <th className="p-2 text-start">الحالة</th>
                  <th className="p-2 text-start">التاريخ</th>
                  <th className="p-2 text-start">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {(rewards ?? []).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{REWARD_LABEL[r.kind] ?? r.kind}</td>
                    <td className="p-2">
                      {r.kind === "free_subscription" ? `${r.free_days ?? 0} يوم` : `${money(r.amount)} ${r.currency ?? ""}`}
                    </td>
                    <td className="p-2">
                      <Badge variant={r.status === "paid" || r.status === "granted" ? "default" : "secondary"}>
                        {r.status === "paid" ? "مصروفة" : r.status === "granted" ? "مُمنوح" : r.status === "approved" ? "معتمدة" : "قيد المراجعة"}
                      </Badge>
                    </td>
                    <td className="p-2" dir="ltr">{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                    <td className="p-2 space-x-1 space-x-reverse">

                      {r.status === "pending" || r.status === "approved" ? (
                        <>
                          <Button size="sm" onClick={() => markPaid(r.id)}>اعتماد/صرف</Button>
                          {r.kind === "commission" ? (
                            <Button size="sm" variant="outline" onClick={() => editRewardAmount(r.id, r.amount)}>تعديل</Button>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => cancelReward(r.id)}>إلغاء</Button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!rewards?.length ? (
                  <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">لا توجد مكافآت بعد.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold mb-3">طلبات سحب الأرصدة</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">المستخدم</th>
                  <th className="p-2 text-start">المبلغ</th>
                  <th className="p-2 text-start">وسيلة الاستلام</th>
                  <th className="p-2 text-start">الحالة</th>
                  <th className="p-2 text-start">التاريخ</th>
                  <th className="p-2 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(withdrawals ?? []).map((w) => (
                  <tr key={w.id} className="border-t">
                    <td className="p-2">
                      <div>{w.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{w.email ?? ""}</div>
                    </td>
                    <td className="p-2" dir="ltr">{money(w.amount)} {w.currency}</td>
                    <td className="p-2 text-xs">
                      <div>{w.method ?? "—"}</div>
                      <div className="text-muted-foreground" dir="ltr">{w.account_details ?? ""}</div>
                    </td>
                    <td className="p-2">
                      <Badge variant={w.status === "paid" ? "default" : "secondary"}>
                        {w.status === "paid" ? "مصروف" : w.status === "approved" ? "معتمد" : w.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                      </Badge>
                    </td>
                    <td className="p-2" dir="ltr">{new Date(w.created_at).toLocaleDateString("en-GB")}</td>
                    <td className="p-2 space-x-1 space-x-reverse">
                      {w.status === "pending" ? (
                        <>
                          <Button size="sm" onClick={() => reviewWithdrawal(w.id, "approved")}>اعتماد</Button>
                          <Button size="sm" variant="outline" onClick={() => reviewWithdrawal(w.id, "rejected")}>رفض</Button>
                        </>
                      ) : null}
                      {w.status === "approved" ? (
                        <Button size="sm" onClick={() => reviewWithdrawal(w.id, "paid")}>تم الصرف</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!withdrawals?.length ? (
                  <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">لا توجد طلبات سحب.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );

}
