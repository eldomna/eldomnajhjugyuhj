import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BACKUP_TABLES = [
  "profiles",
  "user_roles",
  "calculations",
  "documents",
  "platform_settings",
  "pdf_templates",
  "legal_content",
  "audit_logs",
] as const;

const RETENTION_DAYS = 30;

export const createBackupSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: { table: string; rows: number }[] = [];

    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabaseAdmin.from(table).select("*");
      if (error) throw error;
      const rows = data ?? [];
      const { error: insErr } = await supabaseAdmin.from("backups").insert({
        table_name: table,
        snapshot: rows as never,
        row_count: rows.length,
      });
      if (insErr) throw insErr;
      results.push({ table, rows: rows.length });
    }

    // Retention cleanup
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
    await supabaseAdmin.from("backups").delete().lt("created_at", cutoff);

    return { ok: true, results };
  });

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const start = Date.now();
    const ping = await context.supabase.from("profiles").select("id", { count: "exact", head: true });
    const dbLatency = Date.now() - start;

    const sinceISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [users, calcs, docs, views24h, errors24h, backups] = await Promise.all([
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("calculations").select("id", { count: "exact", head: true }),
      context.supabase.from("documents").select("id", { count: "exact", head: true }),
      context.supabase.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", sinceISO),
      context.supabase.from("audit_logs").select("id", { count: "exact", head: true }).like("action", "error.%").gte("created_at", sinceISO),
      context.supabase.from("backups").select("id", { count: "exact", head: true }).gte("created_at", sinceISO),
    ]);

    return {
      dbOk: !ping.error,
      dbLatency,
      counts: {
        users: users.count ?? 0,
        calcs: calcs.count ?? 0,
        docs: docs.count ?? 0,
        views24h: views24h.count ?? 0,
        errors24h: errors24h.count ?? 0,
        backups24h: backups.count ?? 0,
      },
      timestamp: new Date().toISOString(),
    };
  });
