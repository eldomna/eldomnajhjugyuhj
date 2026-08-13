// ============================================================================
// Legal Rules Engine — declarative rule resolution, conditions, formulas
// No legal constant or formula lives in application code: everything is data.
// ============================================================================

export type RuleType =
  | "calculation"
  | "validation"
  | "eligibility"
  | "exception"
  | "notification"
  | "warning"
  | "hide"
  | "show";

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  calculation: "قاعدة احتساب",
  validation: "قاعدة تحقق",
  eligibility: "قاعدة استحقاق",
  exception: "قاعدة استثناء",
  notification: "قاعدة إشعار",
  warning: "قاعدة تحذير",
  hide: "قاعدة إخفاء",
  show: "قاعدة عرض",
};

export const RULE_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمدة",
  scheduled: "مجدولة",
  published: "منشورة",
  archived: "مؤرشفة",
  suspended: "موقوفة",
};

export const APPROVAL_STAGES = [
  { stage: "legal_review", label: "مراجعة قانونية", order: 1 },
  { stage: "technical_review", label: "مراجعة تقنية", order: 2 },
  { stage: "final_approval", label: "اعتماد نهائي", order: 3 },
] as const;

export interface LegalRuleRow {
  id: string;
  country_code: string;
  system_id: string | null;
  rule_code: string;
  rule_name: string;
  rule_type: string;
  claim_type: string | null;
  sector: string | null;
  worker_type: string | null;
  contract_type: string | null;
  priority: number;
  specificity: number;
  formula_id: string | null;
  article_id: string | null;
  value: unknown;
  description: string | null;
  version: string;
  effective_date: string;
  expiry_date: string | null;
  status: string;
  supersedes_id?: string | null;
  published_at?: string | null;
  scheduled_at?: string | null;
}

export interface FormulaRow {
  id: string;
  formula_code: string;
  formula_name: string;
  formula_expression: string;
  variables: unknown;
  return_type: string;
  version: string;
  status: string;
}

export interface RuleConditionRow {
  id: string;
  rule_id: string;
  condition_expression: unknown;
  logic_operator: string;
  execution_order: number;
  description: string | null;
}

export interface RuleContext {
  country?: string;
  as_of?: string;
  sector?: string | null;
  worker_type?: string | null;
  contract_type?: string | null;
  claim_type?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Rule Conditions — composable AND / OR / NOT / nested expressions
// ---------------------------------------------------------------------------

export type ConditionNode =
  | { and: ConditionNode[] }
  | { or: ConditionNode[] }
  | { not: ConditionNode }
  | { field: string; op: ConditionOp; value?: unknown };

export type ConditionOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "exists"
  | "contains";

export const CONDITION_OP_LABELS: Record<ConditionOp, string> = {
  eq: "يساوي",
  neq: "لا يساوي",
  gt: "أكبر من",
  gte: "أكبر أو يساوي",
  lt: "أصغر من",
  lte: "أصغر أو يساوي",
  in: "ضمن قائمة",
  nin: "خارج قائمة",
  exists: "موجود",
  contains: "يحتوي",
};

function pick(ctx: RuleContext, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, ctx);
}

export function evaluateCondition(node: ConditionNode | null | undefined, ctx: RuleContext): boolean {
  if (!node || typeof node !== "object") return true;
  if ("and" in node) return (node.and ?? []).every((n) => evaluateCondition(n, ctx));
  if ("or" in node) return (node.or ?? []).some((n) => evaluateCondition(n, ctx));
  if ("not" in node) return !evaluateCondition(node.not, ctx);
  if (!("field" in node)) return true;

  const actual = pick(ctx, node.field);
  const expected = node.value;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

  switch (node.op) {
    case "eq":
      return actual === expected || String(actual) === String(expected);
    case "neq":
      return String(actual) !== String(expected);
    case "gt":
      return num(actual) > num(expected);
    case "gte":
      return num(actual) >= num(expected);
    case "lt":
      return num(actual) < num(expected);
    case "lte":
      return num(actual) <= num(expected);
    case "in":
      return Array.isArray(expected) && expected.some((v) => String(v) === String(actual));
    case "nin":
      return Array.isArray(expected) && !expected.some((v) => String(v) === String(actual));
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "contains":
      return String(actual ?? "").includes(String(expected ?? ""));
    default:
      return true;
  }
}

export function evaluateConditionSet(rows: RuleConditionRow[], ctx: RuleContext): { passed: boolean; trace: { order: number; passed: boolean; description: string | null }[] } {
  const sorted = [...rows].sort((a, b) => a.execution_order - b.execution_order);
  const trace = sorted.map((r) => ({
    order: r.execution_order,
    passed: evaluateCondition(r.condition_expression as ConditionNode, ctx),
    description: r.description,
  }));
  if (!trace.length) return { passed: true, trace };
  const anyOr = sorted.some((r) => r.logic_operator === "OR");
  const passed = anyOr ? trace.some((t) => t.passed) : trace.every((t) => t.passed);
  return { passed, trace };
}

// ---------------------------------------------------------------------------
// Formula Repository — safe declarative expression evaluation
// ---------------------------------------------------------------------------

const FORMULA_FUNCS: Record<string, (...args: number[]) => number> = {
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  round: (v, d = 0) => Number(Math.round(Number(`${v}e${d}`)) + `e-${d}`),
  floor: (v) => Math.floor(v),
  ceil: (v) => Math.ceil(v),
  abs: (v) => Math.abs(v),
};

const TOKEN_RE = /([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|([+\-*/(),])|\s+/g;

/** Validates a formula expression is composed only of allowed tokens. */
export function validateFormulaExpression(expr: string, variables: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!expr.trim()) errors.push("التعبير الحسابي فارغ");
  let depth = 0;
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) errors.push("أقواس غير متوازنة");
  }
  if (depth !== 0) errors.push("أقواس غير متوازنة");

  const cleaned = expr.replace(TOKEN_RE, (m, ident) => {
    if (ident) {
      if (!variables.includes(ident) && !(ident in FORMULA_FUNCS)) {
        errors.push(`متغير أو دالة غير معروفة: ${ident}`);
      }
    }
    return "";
  });
  if (cleaned.trim().length > 0) errors.push(`رموز غير مسموحة: ${cleaned.trim()}`);
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

/** Evaluates an expression against variable values using a small recursive parser. */
export function evaluateFormula(expr: string, vars: Record<string, number>): number {
  let i = 0;
  const src = expr;

  const ws = () => { while (i < src.length && /\s/.test(src[i]!)) i++; };

  function parseExpr(): number {
    let left = parseTerm();
    ws();
    while (i < src.length && (src[i] === "+" || src[i] === "-")) {
      const op = src[i++]!;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
      ws();
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    ws();
    while (i < src.length && (src[i] === "*" || src[i] === "/")) {
      const op = src[i++]!;
      const right = parseFactor();
      left = op === "*" ? left * right : right === 0 ? 0 : left / right;
      ws();
    }
    return left;
  }

  function parseFactor(): number {
    ws();
    if (src[i] === "-") { i++; return -parseFactor(); }
    if (src[i] === "+") { i++; return parseFactor(); }
    if (src[i] === "(") {
      i++;
      const v = parseExpr();
      ws();
      if (src[i] === ")") i++;
      return v;
    }
    const numMatch = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (numMatch) { i += numMatch[0].length; return Number(numMatch[0]); }
    const identMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (identMatch) {
      const name = identMatch[0];
      i += name.length;
      ws();
      if (src[i] === "(") {
        i++;
        const args: number[] = [];
        ws();
        if (src[i] !== ")") {
          args.push(parseExpr());
          ws();
          while (src[i] === ",") { i++; args.push(parseExpr()); ws(); }
        }
        if (src[i] === ")") i++;
        const fn = FORMULA_FUNCS[name];
        if (!fn) throw new Error(`دالة غير معروفة: ${name}`);
        return fn(...args);
      }
      const val = vars[name];
      if (val === undefined) throw new Error(`متغير غير مُمرَّر: ${name}`);
      return Number(val);
    }
    throw new Error(`رمز غير متوقع عند الموضع ${i}`);
  }

  const result = parseExpr();
  if (!Number.isFinite(result)) throw new Error("نتيجة غير صالحة");
  return result;
}

// ---------------------------------------------------------------------------
// Rule Priority Engine — effective dating + scope matching (fail-safe)
// ---------------------------------------------------------------------------

export interface ResolutionResult {
  rule: LegalRuleRow | null;
  candidates: LegalRuleRow[];
  conflict: boolean;
  reason: string;
}

function inWindow(rule: LegalRuleRow, asOf: string) {
  if (rule.effective_date > asOf) return false;
  if (rule.expiry_date && rule.expiry_date < asOf) return false;
  return true;
}

function matchesScope(rule: LegalRuleRow, ctx: RuleContext) {
  const scoped = (ruleVal: string | null, ctxVal: unknown) =>
    !ruleVal || ctxVal === undefined || ctxVal === null || String(ctxVal) === ruleVal;
  return (
    scoped(rule.sector, ctx.sector) &&
    scoped(rule.worker_type, ctx.worker_type) &&
    scoped(rule.contract_type, ctx.contract_type)
  );
}

export function resolveRule(
  rules: LegalRuleRow[],
  ruleCode: string,
  ctx: RuleContext = {},
): ResolutionResult {
  const asOf = ctx.as_of ?? new Date().toISOString().slice(0, 10);
  const country = (ctx.country ?? "SA").toUpperCase();

  const candidates = rules.filter(
    (r) =>
      r.rule_code === ruleCode &&
      r.country_code.toUpperCase() === country &&
      r.status === "published" &&
      inWindow(r, asOf) &&
      matchesScope(r, ctx),
  );

  if (!candidates.length) {
    return { rule: null, candidates, conflict: false, reason: "لا توجد قاعدة سارية مطابقة للسياق" };
  }
  if (candidates.length === 1) {
    return { rule: candidates[0]!, candidates, conflict: false, reason: "قاعدة واحدة مطابقة" };
  }

  // فشل آمن: عند تطابق أكثر من قاعدة لا يُنتج المحرك أي نتيجة، وتُطلب مراجعة قانونية.
  return {
    rule: null,
    candidates,
    conflict: true,
    reason: `تعارض بين ${candidates.length} قواعد — يتطلب مراجعة قانونية قبل إصدار أي نتيجة`,
  };
}

// ---------------------------------------------------------------------------
// Exceptions Engine
// ---------------------------------------------------------------------------

export interface RuleExceptionRow {
  id: string;
  country_code: string;
  rule_id: string | null;
  exception_code: string;
  exception_name: string;
  category: string;
  applies_to: unknown;
  effect: unknown;
  priority: number;
  status: string;
  description: string | null;
}

export function applicableExceptions(all: RuleExceptionRow[], ctx: RuleContext): RuleExceptionRow[] {
  return all
    .filter((e) => e.status === "active" && e.country_code.toUpperCase() === (ctx.country ?? "SA").toUpperCase())
    .filter((e) => {
      const applies = (e.applies_to ?? {}) as Record<string, unknown>;
      return Object.entries(applies).every(([k, v]) => {
        const actual = pick(ctx, k);
        if (actual === undefined || actual === null) return false;
        return String(actual) === String(v);
      });
    })
    .sort((a, b) => b.priority - a.priority);
}

export function mergedExceptionEffect(exceptions: RuleExceptionRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of [...exceptions].sort((a, b) => a.priority - b.priority)) {
    Object.assign(out, (e.effect ?? {}) as Record<string, unknown>);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rule Validation Engine + dependency graph
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export function validateRule(
  rule: LegalRuleRow,
  deps: { formula?: FormulaRow | null; hasArticle: boolean; conditions: RuleConditionRow[]; siblings: LegalRuleRow[] },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!rule.rule_code?.trim()) issues.push({ severity: "error", message: "رمز القاعدة مطلوب" });
  if (!rule.rule_name?.trim()) issues.push({ severity: "error", message: "اسم القاعدة مطلوب" });
  if (!rule.version?.trim()) issues.push({ severity: "error", message: "الإصدار مطلوب" });
  if (!rule.effective_date) issues.push({ severity: "error", message: "تاريخ السريان مطلوب" });
  if (rule.expiry_date && rule.expiry_date < rule.effective_date) {
    issues.push({ severity: "error", message: "تاريخ الانتهاء أسبق من تاريخ السريان" });
  }
  if (!deps.hasArticle) issues.push({ severity: "error", message: "لا توجد مادة قانونية مرتبطة بالقاعدة" });

  if (rule.formula_id && !deps.formula) {
    issues.push({ severity: "error", message: "المعادلة المرتبطة غير موجودة (تعارض في شجرة الاعتماديات)" });
  }
  if (deps.formula) {
    if (deps.formula.status !== "published") {
      issues.push({ severity: "error", message: `المعادلة «${deps.formula.formula_code}» غير منشورة` });
    }
    const vars = Array.isArray(deps.formula.variables) ? (deps.formula.variables as string[]) : [];
    const check = validateFormulaExpression(deps.formula.formula_expression, vars);
    for (const e of check.errors) issues.push({ severity: "error", message: `المعادلة: ${e}` });
  }
  if (rule.rule_type === "calculation" && !rule.formula_id && !hasNumericValue(rule.value)) {
    issues.push({ severity: "warning", message: "قاعدة احتساب بدون معادلة أو قيم رقمية" });
  }

  // Logical loop detection over supersedes chain
  const seen = new Set<string>();
  let cur: LegalRuleRow | undefined = rule;
  while (cur?.supersedes_id) {
    if (seen.has(cur.supersedes_id)) {
      issues.push({ severity: "error", message: "حلقة منطقية في سلسلة الإصدارات" });
      break;
    }
    seen.add(cur.supersedes_id);
    cur = deps.siblings.find((s) => s.id === cur!.supersedes_id);
  }

  // Overlapping published windows with identical scope
  const overlapping = deps.siblings.filter(
    (s) =>
      s.id !== rule.id &&
      s.rule_code === rule.rule_code &&
      s.status === "published" &&
      s.sector === rule.sector &&
      s.worker_type === rule.worker_type &&
      s.contract_type === rule.contract_type &&
      (!s.expiry_date || s.expiry_date >= rule.effective_date) &&
      (!rule.expiry_date || rule.expiry_date >= s.effective_date),
  );
  if (overlapping.length) {
    issues.push({
      severity: "warning",
      message: `تداخل فترات السريان مع ${overlapping.length} إصدار منشور بنفس النطاق`,
    });
  }

  for (const c of deps.conditions) {
    if (!c.condition_expression || Object.keys(c.condition_expression as object).length === 0) {
      issues.push({ severity: "warning", message: `شرط رقم ${c.execution_order} فارغ` });
    }
  }

  return issues;
}

function hasNumericValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return JSON.stringify(value).match(/\d/) !== null;
}

export function canPublish(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => i.severity === "error");
}

// ---------------------------------------------------------------------------
// Rule Dependency Graph
// ---------------------------------------------------------------------------

export interface DependencyNode {
  ruleId: string;
  ruleCode: string;
  formula: string | null;
  article: string | null;
  conditions: number;
  exceptions: number;
  blocked: string[];
}

export function buildDependencyGraph(input: {
  rules: LegalRuleRow[];
  formulas: FormulaRow[];
  articles: { id: string; article_number: string; status: string }[];
  conditions: RuleConditionRow[];
  exceptions: RuleExceptionRow[];
}): DependencyNode[] {
  return input.rules.map((r) => {
    const formula = input.formulas.find((f) => f.id === r.formula_id) ?? null;
    const article = input.articles.find((a) => a.id === r.article_id) ?? null;
    const blocked: string[] = [];
    if (r.formula_id && !formula) blocked.push("معادلة مفقودة");
    if (formula && formula.status !== "published") blocked.push("معادلة غير منشورة");
    if (!article) blocked.push("مادة قانونية مفقودة");
    if (article && article.status !== "active") blocked.push("مادة غير سارية");
    return {
      ruleId: r.id,
      ruleCode: r.rule_code,
      formula: formula?.formula_code ?? null,
      article: article?.article_number ?? null,
      conditions: input.conditions.filter((c) => c.rule_id === r.id).length,
      exceptions: input.exceptions.filter((e) => e.rule_id === r.id).length,
      blocked,
    };
  });
}
