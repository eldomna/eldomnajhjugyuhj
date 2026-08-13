// Client-side accessor used by Calculation Engine / Legal AI / UI modules to
// load declarative rules instead of hardcoding legal constants.
import { supabase } from "@/integrations/supabase/client";
import {
  resolveRule,
  applicableExceptions,
  mergedExceptionEffect,
  evaluateConditionSet,
  evaluateFormula,
  type LegalRuleRow,
  type FormulaRow,
  type RuleConditionRow,
  type RuleExceptionRow,
  type RuleContext,
} from "./rulesEngine";

export interface RuleBundle {
  rules: LegalRuleRow[];
  formulas: FormulaRow[];
  conditions: RuleConditionRow[];
  exceptions: RuleExceptionRow[];
  articles: { id: string; article_number: string; article_title: string; article_text: string; status: string }[];
}

export async function loadRuleBundle(country = "SA"): Promise<RuleBundle> {
  const cc = country.toUpperCase();
  const [rules, formulas, conditions, exceptions, articles] = await Promise.all([
    supabase.from("legal_rules").select("*").eq("country_code", cc),
    supabase.from("rule_formulas").select("*"),
    supabase.from("rule_conditions").select("*"),
    supabase.from("rule_exceptions").select("*").eq("country_code", cc),
    supabase.from("legal_articles").select("id, article_number, article_title, article_text, status").eq("country_code", cc),
  ]);
  return {
    rules: (rules.data ?? []) as unknown as LegalRuleRow[],
    formulas: (formulas.data ?? []) as unknown as FormulaRow[],
    conditions: (conditions.data ?? []) as unknown as RuleConditionRow[],
    exceptions: (exceptions.data ?? []) as unknown as RuleExceptionRow[],
    articles: (articles.data ?? []) as RuleBundle["articles"],
  };
}

export interface AppliedRule {
  ruleCode: string;
  ruleName: string | null;
  version: string | null;
  value: Record<string, unknown>;
  amount: number | null;
  article: { number: string; title: string } | null;
  exceptions: string[];
  exceptionEffect: Record<string, unknown>;
  conflict: boolean;
  reason: string;
  error: string | null;
}

/** Resolves a rule for the given context and (optionally) runs its formula. */
export function applyRule(
  bundle: RuleBundle,
  ruleCode: string,
  ctx: RuleContext,
  variables: Record<string, number> = {},
): AppliedRule {
  const res = resolveRule(bundle.rules, ruleCode, ctx);
  const rule = res.rule;
  const exc = applicableExceptions(bundle.exceptions, ctx);
  const article = rule ? bundle.articles.find((a) => a.id === rule.article_id) ?? null : null;
  const formula = rule?.formula_id ? bundle.formulas.find((f) => f.id === rule.formula_id) ?? null : null;
  const conds = rule ? bundle.conditions.filter((c) => c.rule_id === rule.id) : [];
  const condResult = evaluateConditionSet(conds, { ...ctx, ...variables });

  let amount: number | null = null;
  let error: string | null = null;
  if (rule && formula && condResult.passed) {
    try {
      amount = evaluateFormula(formula.formula_expression, variables);
    } catch (e) {
      error = e instanceof Error ? e.message : "خطأ في المعادلة";
    }
  }

  return {
    ruleCode,
    ruleName: rule?.rule_name ?? null,
    version: rule?.version ?? null,
    value: (rule?.value ?? {}) as Record<string, unknown>,
    amount,
    article: article ? { number: article.article_number, title: article.article_title } : null,
    exceptions: exc.map((e) => e.exception_name),
    exceptionEffect: mergedExceptionEffect(exc),
    conflict: res.conflict,
    reason: condResult.passed ? res.reason : "لم تتحقق شروط تطبيق القاعدة",
    error,
  };
}
