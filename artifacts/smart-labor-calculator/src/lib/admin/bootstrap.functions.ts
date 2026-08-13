import { createServerFn } from "@tanstack/react-start";
import { TEMP_ADMIN_PASSWORD } from "./tempAdmin";

/**
 * Idempotent, safe bootstrap of the temporary admin account.
 *
 * It only acts while the project has no *initialised* admin, so it can never be
 * used to escalate privileges once a real admin has set their own password.
 *
 * NOTE: the temp password must not appear in known-breach lists — Supabase
 * leaked-password protection (HIBP) rejects such passwords with
 * `weak_password/pwned`, which previously left the account without a usable
 * password and made every sign-in return 400 invalid credentials.
 */
export const ensureTempAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const email = "admin@example.com";

  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  let userId = existing?.id ?? null;

  // An account created by direct SQL inserts has no row in auth.identities, so
  // GoTrue's password grant can never match it → permanent 400 invalid_credentials.
  // Drop such a broken record so it gets recreated through the Auth Admin API.
  if (existing && (existing.identities?.length ?? 0) === 0) {
    await supabaseAdmin.auth.admin.deleteUser(existing.id);
    userId = null;
  }


  const { data: admins, error: adminsErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (adminsErr) return { created: false as const, reason: "error" as const };

  const otherAdmins = (admins ?? []).filter((r) => r.user_id !== userId);
  if (otherAdmins.length > 0) return { created: false as const, reason: "admin_exists" as const };

  if (userId) {
    // Temp account exists. Only re-arm its password while first-run setup is
    // still pending (must_change_password = true); never touch an initialised admin.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("must_change_password")
      .eq("id", userId)
      .maybeSingle();
    if ((profile as { must_change_password?: boolean } | null)?.must_change_password !== true) {
      return { created: false as const, reason: "admin_exists" as const };
    }
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: TEMP_ADMIN_PASSWORD,
      email_confirm: true,
    });
  } else {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: TEMP_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "System Administrator" },
    });
    userId = created?.user?.id ?? null;
    if (createErr || !userId) return { created: false as const, reason: "error" as const };
  }

  await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, must_change_password: true } as never, { onConflict: "id" });

  return { created: true as const, reason: "bootstrapped" as const };
});

