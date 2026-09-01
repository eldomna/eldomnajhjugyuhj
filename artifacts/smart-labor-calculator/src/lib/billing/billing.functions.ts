import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
