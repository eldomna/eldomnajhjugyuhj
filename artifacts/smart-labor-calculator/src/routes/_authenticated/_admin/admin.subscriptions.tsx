import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CreditCard, Check, X, FileImage, Plus } from "lucide-react";
import { ReceiptPreview } from "@/components/ReceiptPreview";


export const Route = createFileRoute("/_authenticated/_admin/admin/subscriptions")({
  component: AdminSubscriptions,
});

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

function AdminSubscriptions() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin", "subscription-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_requests")
        .select("*, subscription_plans(name, price, currency, duration_days)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: subs } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(name)")
        .order("expires_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("approve_subscription_request", { _request_id: id });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تفعيل الاشتراك");
    qc.invalidateQueries({ queryKey: ["admin", "subscription-requests"] });
    qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
  };

  const reject = async (id: string) => {
    setBusy(id);
    const { error } = await supabase
      .from("subscription_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم رفض الطلب");
    qc.invalidateQueries({ queryKey: ["admin", "subscription-requests"] });
  };




  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">الاشتراكات وطلبات التفعيل</h1>
        </div>

        <PlansManager />

        <Card className="p-5 mb-8">

          <h2 className="font-bold mb-4">طلبات التفعيل</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
          ) : (requests ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد طلبات.</p>
          ) : (
            <div className="space-y-3">
              {(requests ?? []).map((r) => (
                <div key={r.id} className="border rounded-lg p-4 grid gap-2 sm:grid-cols-[1fr_auto] items-start">
                  <div className="text-sm space-y-1">
                    <div className="font-semibold">
                      {r.full_name || "—"}{" "}
                      <span className="text-muted-foreground" dir="ltr">{r.mobile_number || ""}</span>
                    </div>
                    <div className="text-muted-foreground">
                      الباقة: {r.subscription_plans?.name ?? "—"} •{" "}
                      <span dir="ltr">{r.amount ? `${fmt(Number(r.amount))} ${r.currency}` : "—"}</span>
                    </div>
                    {r.transfer_reference && (
                      <div className="text-muted-foreground">مرجع التحويل: <span dir="ltr">{r.transfer_reference}</span></div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      تاريخ الطلب: <span dir="ltr">{new Date(r.created_at).toLocaleString("en-GB")}</span>
                    </div>
                    {r.receipt_url ? (
                      <ReceiptPreview path={r.receipt_url} />
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileImage className="h-3.5 w-3.5" /> لم يُرفق إيصال تحويل.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                      {r.status === "approved" ? "مفعّل" : r.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                    </Badge>
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" className="gap-1" disabled={busy === r.id} onClick={() => approve(r.id)}>
                          <Check className="h-3.5 w-3.5" /> تفعيل
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" disabled={busy === r.id} onClick={() => reject(r.id)}>
                          <X className="h-3.5 w-3.5" /> رفض
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-bold mb-4">الاشتراكات الحالية</h2>
          {(subs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد اشتراكات.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-right">
                    <th className="py-2">الباقة</th>
                    <th className="py-2">البداية</th>
                    <th className="py-2">الانتهاء</th>
                    <th className="py-2">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {(subs ?? []).map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2">{s.subscription_plans?.name ?? "—"}</td>
                      <td className="py-2" dir="ltr">{new Date(s.starts_at).toLocaleDateString("en-GB")}</td>
                      <td className="py-2" dir="ltr">{new Date(s.expires_at).toLocaleDateString("en-GB")}</td>
                      <td className="py-2">
                        <Badge variant={new Date(s.expires_at) > new Date() && s.status === "active" ? "default" : "secondary"}>
                          {new Date(s.expires_at) > new Date() && s.status === "active" ? "فعّال" : "منتهٍ"}
                        </Badge>
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

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  period: string;
  duration_days: number;
  is_active: boolean;
  sort_order: number;
  country: string;
};

const COUNTRY_LABEL: Record<string, string> = { SA: "🇸🇦 المملكة العربية السعودية", YE: "🇾🇪 الجمهورية اليمنية" };

type NewPlanForm = {
  code: string;
  name: string;
  country: string;
  period: string;
  price: string;
  currency: string;
  duration_days: string;
  description: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_NEW_PLAN: NewPlanForm = {
  code: "",
  name: "",
  country: "YE",
  period: "monthly",
  price: "",
  currency: "YER",
  duration_days: "30",
  description: "",
  sort_order: "0",
  is_active: true,
};

/** إدارة الأسعار حسب الدولة — المصدر المركزي الوحيد لأسعار الاشتراكات. */
function PlansManager() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, { price: string; currency: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlan, setNewPlan] = useState<NewPlanForm>(EMPTY_NEW_PLAN);
  const [addingPlan, setAddingPlan] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin", "subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("country")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as PlanRow[];
    },
  });

  const save = async (p: PlanRow) => {
    const d = draft[p.id];
    const price = Number(d?.price ?? p.price);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("سعر غير صالح");
      return;
    }
    setBusy(p.id);
    const { error } = await supabase
      .from("subscription_plans")
      .update({ price, currency: (d?.currency ?? p.currency).toUpperCase() })
      .eq("id", p.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث السعر");
    qc.invalidateQueries({ queryKey: ["admin", "subscription-plans"] });
  };

  const toggle = async (p: PlanRow) => {
    setBusy(p.id);
    const { error } = await supabase
      .from("subscription_plans")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin", "subscription-plans"] });
  };

  const addPlan = async () => {
    const code = newPlan.code.trim();
    const name = newPlan.name.trim();
    const price = Number(newPlan.price);
    const durationDays = Number(newPlan.duration_days);
    const sortOrder = Number(newPlan.sort_order || 0);

    if (!code) {
      toast.error("اكتب كود الباقة");
      return;
    }
    if (!name) {
      toast.error("اكتب اسم الباقة");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("سعر غير صالح");
      return;
    }
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      toast.error("مدة الاشتراك (بالأيام) غير صالحة");
      return;
    }

    setAddingPlan(true);
    const { error } = await supabase.from("subscription_plans").insert({
      code,
      name,
      country: newPlan.country,
      period: newPlan.period,
      price,
      currency: newPlan.currency.toUpperCase(),
      duration_days: durationDays,
      description: newPlan.description.trim() || null,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: newPlan.is_active,
    });
    setAddingPlan(false);
    if (error) {
      toast.error(error.code === "23505" ? "كود الباقة مستخدم بالفعل، اختر كودًا آخر" : error.message);
      return;
    }
    toast.success("تمت إضافة الباقة بنجاح");
    setNewPlan(EMPTY_NEW_PLAN);
    setShowAddForm(false);
    qc.invalidateQueries({ queryKey: ["admin", "subscription-plans"] });
  };

  const groups = (plans ?? []).reduce<Record<string, PlanRow[]>>((acc, p) => {
    (acc[p.country] ??= []).push(p);
    return acc;
  }, {});

  return (
    <Card className="p-5 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-bold">أسعار الاشتراكات حسب الدولة</h2>
        <Button
          size="sm"
          variant={showAddForm ? "outline" : "default"}
          className="gap-1"
          onClick={() => setShowAddForm((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" /> {showAddForm ? "إلغاء" : "إضافة باقة جديدة"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        كل مستخدم يرى باقات دولته المحفوظة في حسابه فقط، والسعر يُتحقق منه في الخادم عند إنشاء الطلب.
      </p>

      {showAddForm && (
        <div className="mb-6 rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>كود الباقة (فريد)</Label>
              <Input
                dir="ltr"
                placeholder="monthly_sa_2"
                value={newPlan.code}
                onChange={(e) => setNewPlan((p) => ({ ...p, code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>اسم الباقة</Label>
              <Input
                value={newPlan.name}
                onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>الدولة</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={newPlan.country}
                onChange={(e) => setNewPlan((p) => ({ ...p, country: e.target.value }))}
              >
                <option value="YE">🇾🇪 اليمن</option>
                <option value="SA">🇸🇦 السعودية</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>الدورة</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={newPlan.period}
                onChange={(e) => setNewPlan((p) => ({ ...p, period: e.target.value }))}
              >
                <option value="monthly">شهري</option>
                <option value="yearly">سنوي</option>
                <option value="one_time">لمرة واحدة</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>السعر</Label>
              <Input
                dir="ltr"
                inputMode="decimal"
                value={newPlan.price}
                onChange={(e) => setNewPlan((p) => ({ ...p, price: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>العملة</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                dir="ltr"
                value={newPlan.currency}
                onChange={(e) => setNewPlan((p) => ({ ...p, currency: e.target.value }))}
              >
                <option value="YER">YER</option>
                <option value="SAR">SAR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>مدة الاشتراك (أيام)</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={newPlan.duration_days}
                onChange={(e) => setNewPlan((p) => ({ ...p, duration_days: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ترتيب العرض</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={newPlan.sort_order}
                onChange={(e) => setNewPlan((p) => ({ ...p, sort_order: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label>الوصف (اختياري)</Label>
              <Textarea
                rows={2}
                value={newPlan.description}
                onChange={(e) => setNewPlan((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newPlan.is_active}
                onChange={(e) => setNewPlan((p) => ({ ...p, is_active: e.target.checked }))}
              />
              تفعيل الباقة فور الإضافة
            </label>
            <Button size="sm" className="gap-1" disabled={addingPlan} onClick={addPlan}>
              <Plus className="h-3.5 w-3.5" /> حفظ الباقة
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([country, rows]) => (
            <div key={country}>
              <div className="mb-2 text-sm font-semibold">{COUNTRY_LABEL[country] ?? country}</div>
              <div className="space-y-2">
                {rows.map((p) => (
                  <div key={p.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                    <div className="text-sm">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {p.code} • {p.period} • {p.duration_days}d
                      </div>
                    </div>
                    <Input
                      className="w-28"
                      dir="ltr"
                      inputMode="decimal"
                      value={draft[p.id]?.price ?? String(p.price)}
                      onChange={(e) => setDraft((d) => ({ ...d, [p.id]: { price: e.target.value, currency: d[p.id]?.currency ?? p.currency } }))}
                    />
                    <Input
                      className="w-20"
                      dir="ltr"
                      maxLength={3}
                      value={draft[p.id]?.currency ?? p.currency}
                      onChange={(e) => setDraft((d) => ({ ...d, [p.id]: { price: d[p.id]?.price ?? String(p.price), currency: e.target.value } }))}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" disabled={busy === p.id} onClick={() => save(p)}>حفظ</Button>
                      <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => toggle(p)}>
                        {p.is_active ? "تعطيل" : "تنشيط"}
                      </Button>
                      <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "مفعّلة" : "معطّلة"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
