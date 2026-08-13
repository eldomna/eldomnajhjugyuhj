import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** الباقات المتاحة — قراءة عامة. */
export const listBillingPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await client
    .from("billing_plans")
    .select("code,name,description,price,currency,period,duration_days,calc_credits,engines,show_details,show_legal_refs,allow_pdf,auto_renew,sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
});

/** وسائل الدفع المفعّلة — قراءة عامة. */
export const listPaymentProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await client
    .from("payment_providers")
    .select("code,name,kind,logo_url,instructions,is_active,sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
});

export type Entitlements = {
  planCode: string;
  status: string;
  expiresAt: string | null;
  creditsRemaining: number | null;
  autoRenew: boolean;
  showDetails: boolean;
  showLegalRefs: boolean;
  allowPdf: boolean;
  engines: string[];
};

/** صلاحيات المستخدم الحالية — تُحسب على الخادم فقط. */
export const getEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlements> => {
    const { data } = await context.supabase.rpc("get_platform_entitlements");
    const row: any = Array.isArray(data) ? data[0] : null;
    if (!row) {
      return {
        planCode: "free", status: "free", expiresAt: null, creditsRemaining: null,
        autoRenew: false, showDetails: false, showLegalRefs: false, allowPdf: false, engines: ["sa"],
      };
    }
    return {
      planCode: row.plan_code,
      status: row.status,
      expiresAt: row.expires_at ?? null,
      creditsRemaining: row.credits_remaining ?? null,
      autoRenew: !!row.auto_renew,
      showDetails: !!row.show_details,
      showLegalRefs: !!row.show_legal_refs,
      allowPdf: !!row.allow_pdf,
      engines: row.engines ?? [],
    };
  });

/** إيقاف أو تفعيل التجديد التلقائي للاشتراك الحالي. */
export const setAutoRenew = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("billing_subscriptions")
      .update({ auto_renew: data.enabled })
      .eq("user_id", context.userId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** إنشاء عملية دفع عبر طبقة المزوّدين. المزوّد اليدوي ينشئ عملية معلّقة للمراجعة. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planCode: z.enum(["single", "monthly", "yearly"]),
        providerCode: z.string().trim().min(2).max(50),
        receiptUrl: z.string().trim().max(500).optional().nullable(),
        reference: z.string().trim().max(120).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: plan } = await context.supabase
      .from("billing_plans")
      .select("code,price,currency,is_active")
      .eq("code", data.planCode)
      .maybeSingle();
    if (!plan || !plan.is_active) throw new Error("الباقة غير متاحة");

    const { data: provider } = await context.supabase
      .from("payment_providers")
      .select("code,kind,is_active")
      .eq("code", data.providerCode)
      .maybeSingle();
    if (!provider || !provider.is_active) throw new Error("وسيلة الدفع غير مفعّلة حالياً");

    const { data: txn, error } = await context.supabase
      .from("billing_transactions")
      .insert({
        user_id: context.userId,
        plan_code: plan.code,
        amount: plan.price,
        currency: plan.currency,
        provider_code: provider.code,
        status: "pending",
        receipt_url: data.receiptUrl ?? null,
        metadata: { reference: data.reference ?? null, kind: provider.kind },
      })
      .select("id,status")
      .single();
    if (error) throw new Error(error.message);

    return {
      transactionId: txn.id,
      status: txn.status,
      requiresManualReview: provider.kind === "manual",
      redirectUrl: null as string | null,
    };
  });
