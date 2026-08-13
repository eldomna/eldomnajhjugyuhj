import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CountryPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  period: string;
  duration_days: number;
  sort_order: number;
};

export type MyPricing = {
  country: string | null;
  plans: CountryPlan[];
};

/**
 * الأسعار حسب دولة المستخدم المحفوظة في قاعدة البيانات فقط.
 * الخادم هو من يحدد الدولة — لا يُقبل أي إدخال من المتصفح.
 */
export const getMyPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPricing> => {
    const { supabase } = context;
    const { data: country } = await (supabase.rpc as never as (n: string) => Promise<{ data: string | null }>)(
      "get_my_country",
    );
    if (!country) return { country: null, plans: [] };
    const { data, error } = await (
      supabase.rpc as never as (n: string) => Promise<{ data: CountryPlan[] | null; error: unknown }>
    )("get_my_plans");
    if (error) throw new Error("تعذر تحميل باقات الاشتراك");
    return { country, plans: (data ?? []).map((p) => ({ ...p, price: Number(p.price) })) };
  });

/** حفظ دولة المستخدم في قاعدة البيانات (المصدر الوحيد للأسعار). */
export const setMyCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { country: string }) => {
    if (input?.country !== "SA" && input?.country !== "YE") throw new Error("دولة غير مدعومة");
    return { country: input.country };
  })
  .handler(async ({ data, context }) => {
    const { error } = await (
      supabaseRpc(context.supabase)
    )("set_my_country", { _country: data.country });
    if (error) throw new Error(rpcMessage(error));
    return { country: data.country };
  });

export type CreateRequestInput = {
  planId: string;
  paymentMethodId?: string | null;
  fullName?: string | null;
  mobileNumber?: string | null;
  transferReference?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  useWallet?: boolean;
};

export type CreateRequestResult = {
  requestId: string;
  amount: number;
  currency: string;
  discountAmount: number;
  walletUsed: number;
};

/**
 * إنشاء طلب اشتراك — المبلغ والعملة والخصم تُحسب في الخادم من خطة دولة المستخدم.
 */
export const createSubscriptionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateRequestInput) => {
    if (!input?.planId) throw new Error("اختر باقة الاشتراك");
    return input;
  })
  .handler(async ({ data, context }): Promise<CreateRequestResult> => {
    const { data: rows, error } = await supabaseRpc(context.supabase)("create_subscription_request", {
      _plan_id: data.planId,
      _payment_method_id: data.paymentMethodId ?? null,
      _full_name: data.fullName ?? null,
      _mobile_number: data.mobileNumber ?? null,
      _transfer_reference: data.transferReference ?? null,
      _receipt_url: data.receiptUrl ?? null,
      _notes: data.notes ?? null,
      _use_wallet: data.useWallet !== false,
    });
    if (error) throw new Error(rpcMessage(error));
    const row = (Array.isArray(rows) ? rows[0] : rows) as
      | { request_id: string; amount: number; currency: string; discount_amount: number | null; wallet_used: number | null }
      | undefined;
    if (!row) throw new Error("تعذر إنشاء طلب الاشتراك");
    return {
      requestId: row.request_id,
      amount: Number(row.amount ?? 0),
      currency: row.currency,
      discountAmount: Number(row.discount_amount ?? 0),
      walletUsed: Number(row.wallet_used ?? 0),
    };
  });

type RpcFn = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

function supabaseRpc(client: unknown): RpcFn {
  return (client as { rpc: RpcFn }).rpc.bind(client);
}

function rpcMessage(error: unknown): string {
  const msg = (error as { message?: string })?.message ?? "";
  if (msg.includes("country_required")) return "حدّد دولتك أولاً قبل الاشتراك";
  if (msg.includes("plan_not_available_for_country")) return "الباقة غير متاحة لدولتك";
  if (msg.includes("country locked")) return "لا يمكن تغيير الدولة أثناء وجود اشتراك فعّال أو طلب قيد المراجعة";
  return msg || "تعذر إتمام العملية";
}
