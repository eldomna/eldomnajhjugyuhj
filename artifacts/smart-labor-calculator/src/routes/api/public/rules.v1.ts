import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  resolveRule,
  evaluateConditionSet,
  applicableExceptions,
  mergedExceptionEffect,
  type LegalRuleRow,
  type RuleConditionRow,
  type RuleExceptionRow,
} from "@/lib/legal/rulesEngine";

// Versioned, read-only Rule API Service (v1) — consumed by internal modules
// and external integrations. Publishes legal rules only; never any PII.
const querySchema = z.object({
  country: z.string().min(2).max(2).default("SA"),
  rule_code: z.string().min(1).max(80).optional(),
  claim_type: z.string().max(80).optional(),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sector: z.string().max(40).optional(),
  worker_type: z.string().max(40).optional(),
  contract_type: z.string().max(40).optional(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/rules/v1")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return Response.json({ error: "invalid_query", details: parsed.error.flatten() }, { status: 400, headers: CORS });
        }
        const q = parsed.data;
        const asOf = q.as_of ?? new Date().toISOString().slice(0, 10);

        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        let rulesQuery = supabase
          .from("legal_rules")
          .select(
            "id, country_code, system_id, rule_code, rule_name, rule_type, claim_type, sector, worker_type, contract_type, priority, specificity, formula_id, article_id, value, description, version, effective_date, expiry_date, status, supersedes_id, published_at, scheduled_at",
          )
          .eq("country_code", q.country.toUpperCase())
          .eq("status", "published");
        if (q.claim_type) rulesQuery = rulesQuery.eq("claim_type", q.claim_type);

        const [{ data: rules, error }, { data: conditions }, { data: exceptions }, { data: formulas }, { data: articles }] =
          await Promise.all([
            rulesQuery,
            supabase.from("rule_conditions").select("id, rule_id, condition_expression, logic_operator, execution_order, description"),
            supabase
              .from("rule_exceptions")
              .select("id, country_code, rule_id, exception_code, exception_name, category, applies_to, effect, priority, status, description")
              .eq("country_code", q.country.toUpperCase()),
            supabase.from("rule_formulas").select("id, formula_code, formula_name, formula_expression, variables, return_type, version, status"),
            supabase.from("legal_articles").select("id, article_number, article_title, article_text, version, effective_date, status"),
          ]);

        if (error) {
          return Response.json({ error: "rules_unavailable" }, { status: 503, headers: CORS });
        }

        const allRules = (rules ?? []) as unknown as LegalRuleRow[];
        const allConditions = (conditions ?? []) as unknown as RuleConditionRow[];
        const allExceptions = (exceptions ?? []) as unknown as RuleExceptionRow[];
        const ctx = {
          country: q.country.toUpperCase(),
          as_of: asOf,
          sector: q.sector ?? null,
          worker_type: q.worker_type ?? null,
          contract_type: q.contract_type ?? null,
        };

        const activeExceptions = applicableExceptions(allExceptions, ctx);

        if (q.rule_code) {
          const res = resolveRule(allRules, q.rule_code, ctx);
          const rule = res.rule;
          const conds = rule ? allConditions.filter((c) => c.rule_id === rule.id) : [];
          return Response.json(
            {
              api_version: "v1",
              as_of: asOf,
              resolved: rule
                ? {
                    ...rule,
                    formula: (formulas ?? []).find((f) => f.id === rule.formula_id) ?? null,
                    article: (articles ?? []).find((a) => a.id === rule.article_id) ?? null,
                    conditions: conds,
                    conditions_result: evaluateConditionSet(conds, ctx),
                  }
                : null,
              conflict: res.conflict,
              reason: res.reason,
              candidate_versions: res.candidates.map((c) => ({ id: c.id, version: c.version, priority: c.priority })),
              exceptions: activeExceptions,
              exception_effect: mergedExceptionEffect(activeExceptions),
            },
            { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
          );
        }

        return Response.json(
          {
            api_version: "v1",
            as_of: asOf,
            count: allRules.length,
            rules: allRules,
            formulas: formulas ?? [],
            articles: articles ?? [],
            exceptions: allExceptions,
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
