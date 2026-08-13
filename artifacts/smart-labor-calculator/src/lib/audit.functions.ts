import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LogInput = {
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown>;
};

export const logAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: LogInput) => d)
  .handler(async ({ data, context }) => {
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const ua = getRequestHeader("user-agent") ?? null;
    const { error } = await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.action,
      target_type: data.target_type ?? null,
      target_id: data.target_id ?? null,
      metadata: (data.metadata ?? {}) as never,
      ip_address: ip,
      user_agent: ua,
    });
    if (error) throw error;
    return { ok: true };
  });
