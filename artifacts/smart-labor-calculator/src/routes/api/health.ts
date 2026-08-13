import { createFileRoute } from "@tanstack/react-router";

/**
 * Health probe for load balancers, Docker healthchecks and uptime monitors.
 * Never exposes secrets — only presence/reachability flags.
 *
 *   GET /api/health        -> { status, checks: { app, database, ai } }
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const checks: Record<string, { status: string; detail?: string }> = {
          app: { status: "ok" },
        };

        // Database connectivity (public REST endpoint reachability only).
        const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
        const supabaseKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !supabaseKey) {
          checks["database"] = { status: "not_configured" };
        } else {
          try {
            const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
              headers: { apikey: supabaseKey },
            });
            checks["database"] = res.ok
              ? { status: "ok" }
              : { status: "error", detail: `HTTP ${res.status}` };
          } catch {
            checks["database"] = { status: "error", detail: "unreachable" };
          }
        }

        // AI configuration (presence only, no key material).
        const { isAIConfigured, getAIConfig } = await import("@/lib/ai/provider.server");
        const aiConfig = getAIConfig();
        checks["ai"] = isAIConfigured()
          ? { status: "ok", detail: `${aiConfig.provider}:${aiConfig.model}` }
          : { status: "not_configured" };

        const degraded = Object.values(checks).some((c) => c.status === "error");

        return Response.json(
          { status: degraded ? "degraded" : "ok", checks, timestamp: new Date().toISOString() },
          { status: degraded ? 503 : 200, headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
