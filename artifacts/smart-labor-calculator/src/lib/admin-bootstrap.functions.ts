import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Promotes the current user to admin IF no admin exists yet.
 * Safe bootstrap: only ever succeeds for the very first claimer.
 */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) {
      return { ok: false, reason: "admin_exists" as const };
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "claim_first_admin",
      target_type: "user",
      target_id: context.userId,
    });

    return { ok: true as const };
  });
