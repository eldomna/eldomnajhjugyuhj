// PART 1N — محرك الحساب القانوني النهائي (Calculation Engine)
// ثمانية محركات متتابعة ومستقلة. لا توجد قواعد قانونية ثابتة داخل الكود:
// كل القواعد والمعادلات والنسب والاستثناءات تُحمّل من محرك القوانين
// (sa_regulatory_settings.calculation_engine) ومن سياسات الوحدات السابقة.

import {
  buildComputedRights,
  round2,
  type CaseRightsSources,
  type ComputedRight,
  type FinalSettlementPolicy,
} from "./finalSettlement";

/* ============================ أنواع السياسة ============================ */

export type EngineDef = { code: string; label: string; order: number };

export type PipelineStep = {
  code: string;
  label: string;
  order: number;
  source: string;
  formula: string;
  legal_ref: string;
};

export type SeverityDef = { code: string; label: string; blocking: boolean };

export type ValidationRuleDef = {
  code: string;
  label: string;
  severity: string;
  module: string;
};

export type ExceptionRuleDef = {
  code: string;
  label: string;
  severity: string;
  effect: string;
};

export type ConflictRuleDef = {
  code: string;
  label: string;
  severity: string;
  action: string;
};

export type ConfidenceBand = { min: number; label: string; tone: string };

export type ConfidenceConfig = {
  base: number;
  penalty_error: number;
  penalty_warning: number;
  penalty_conflict: number;
  penalty_missing_document: number;
  penalty_missing_module: number;
  min: number;
  bands: ConfidenceBand[];
};

export type CalcEnginePolicy = {
  version: string;
  effective_from: string;
  legal_basis: string;
  system_version: string;
  block_on_error: boolean;
  block_on_conflict: boolean;
  engines: EngineDef[];
  pipeline: PipelineStep[];
  severities: SeverityDef[];
  validation_rules: ValidationRuleDef[];
  exception_rules: ExceptionRuleDef[];
  conflict_rules: ConflictRuleDef[];
  confidence: ConfidenceConfig;
  notes: string;
};

const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

export const DEFAULT_CALC_ENGINE_POLICY: CalcEnginePolicy = {
  version: "SA-CALC-default",
  effective_from: "2015-01-01",
  legal_basis: "نظام العمل السعودي ولوائحه التنفيذية",
  system_version: "1.0.0",
  block_on_error: true,
  block_on_conflict: false,
  engines: [
    { code: "validation", label: "التحقق من البيانات", order: 1 },
    { code: "rules", label: "تحميل القواعد القانونية", order: 2 },
    { code: "eligibility", label: "تحديد الأهلية", order: 3 },
    { code: "formula", label: "تنفيذ المعادلات", order: 4 },
    { code: "exceptions", label: "الحالات الاستثنائية", order: 5 },
    { code: "conflicts", label: "حل التعارضات", order: 6 },
    { code: "core", label: "الحساب النهائي", order: 7 },
    { code: "report", label: "بناء بيانات التقرير", order: 8 },
  ],
  pipeline: [],
  severities: [
    { code: "error", label: "خطأ يمنع الحساب", blocking: true },
    { code: "warning", label: "تحذير", blocking: false },
    { code: "info", label: "معلومة", blocking: false },
  ],
  validation_rules: [],
  exception_rules: [],
  conflict_rules: [],
  confidence: {
    base: 100,
    penalty_error: 25,
    penalty_warning: 5,
    penalty_conflict: 10,
    penalty_missing_document: 5,
    penalty_missing_module: 4,
    min: 20,
    bands: [
      { min: 95, label: "بيانات مكتملة", tone: "success" },
      { min: 85, label: "بعض المستندات مفقودة", tone: "info" },
      { min: 70, label: "توجد تعارضات", tone: "warning" },
      { min: 0, label: "بيانات ناقصة", tone: "danger" },
    ],
  },
  notes: "درجة اكتمال البيانات مؤشر داخلي لجودة المدخلات ولا تُعد حكماً قانونياً.",
};

export function toCalcEnginePolicy(value: unknown): CalcEnginePolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const d = DEFAULT_CALC_ENGINE_POLICY;
  const conf = (v.confidence ?? {}) as Record<string, unknown>;

  const engines = arr(v.engines)
    .map((e, i) => ({
      code: str(e.code, ""),
      label: str(e.label, str(e.code, "")),
      order: num(e.order, i + 1),
    }))
    .filter((e) => e.code);

  const pipeline = arr(v.pipeline)
    .map((p, i) => ({
      code: str(p.code, ""),
      label: str(p.label, str(p.code, "")),
      order: num(p.order, i + 1),
      source: str(p.source, "engine"),
      formula: str(p.formula, "—"),
      legal_ref: str(p.legal_ref, "—"),
    }))
    .filter((p) => p.code)
    .sort((a, b) => a.order - b.order);

  return {
    version: str(v.version, d.version),
    effective_from: str(v.effective_from, d.effective_from),
    legal_basis: str(v.legal_basis, d.legal_basis),
    system_version: str(v.system_version, d.system_version),
    block_on_error: bool(v.block_on_error, d.block_on_error),
    block_on_conflict: bool(v.block_on_conflict, d.block_on_conflict),
    engines: engines.length ? engines.sort((a, b) => a.order - b.order) : d.engines,
    pipeline: pipeline.length ? pipeline : d.pipeline,
    severities: arr(v.severities).length
      ? arr(v.severities)
          .map((s) => ({
            code: str(s.code, ""),
            label: str(s.label, str(s.code, "")),
            blocking: bool(s.blocking, false),
          }))
          .filter((s) => s.code)
      : d.severities,
    validation_rules: arr(v.validation_rules)
      .map((r) => ({
        code: str(r.code, ""),
        label: str(r.label, str(r.code, "")),
        severity: str(r.severity, "warning"),
        module: str(r.module, "all"),
      }))
      .filter((r) => r.code),
    exception_rules: arr(v.exception_rules)
      .map((r) => ({
        code: str(r.code, ""),
        label: str(r.label, str(r.code, "")),
        severity: str(r.severity, "info"),
        effect: str(r.effect, "—"),
      }))
      .filter((r) => r.code),
    conflict_rules: arr(v.conflict_rules)
      .map((r) => ({
        code: str(r.code, ""),
        label: str(r.label, str(r.code, "")),
        severity: str(r.severity, "warning"),
        action: str(r.action, "review"),
      }))
      .filter((r) => r.code),
    confidence: {
      base: num(conf.base, d.confidence.base),
      penalty_error: num(conf.penalty_error, d.confidence.penalty_error),
      penalty_warning: num(conf.penalty_warning, d.confidence.penalty_warning),
      penalty_conflict: num(conf.penalty_conflict, d.confidence.penalty_conflict),
      penalty_missing_document: num(
        conf.penalty_missing_document,
        d.confidence.penalty_missing_document,
      ),
      penalty_missing_module: num(conf.penalty_missing_module, d.confidence.penalty_missing_module),
      min: num(conf.min, d.confidence.min),
      bands: arr(conf.bands).length
        ? arr(conf.bands)
            .map((b) => ({
              min: num(b.min, 0),
              label: str(b.label, ""),
              tone: str(b.tone, "info"),
            }))
            .sort((a, b) => b.min - a.min)
        : d.confidence.bands,
    },
    notes: str(v.notes, d.notes),
  };
}

/* ============================ المدخلات ============================ */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CalcSources = CaseRightsSources & {
  caseInfo: Record<string, unknown> | null;
  contracts: any[];
  trialPeriods: any[];
  salary: any | null;
  workingHours: any | null;
  termination: any | null;
  settlements: any[];
  payments: any[];
};

export type RuleVersions = Record<string, string>;

/* ============================ 1) Data Validation Engine ============================ */

export type ValidationIssue = {
  code: string;
  severity: string;
  message: string;
  module: string;
};

const ruleMeta = (policy: CalcEnginePolicy, code: string) =>
  policy.validation_rules.find((r) => r.code === code) ?? {
    code,
    label: code,
    severity: "warning",
    module: "all",
  };

const isBlocking = (policy: CalcEnginePolicy, severity: string) =>
  policy.severities.find((s) => s.code === severity)?.blocking ?? severity === "error";

const dateOk = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const t = (v: unknown) => (dateOk(v) ? new Date(String(v)).getTime() : NaN);

export function runValidationEngine(src: CalcSources, policy: CalcEnginePolicy): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const push = (code: string, message: string, severityOverride?: string) => {
    const m = ruleMeta(policy, code);
    out.push({ code, severity: severityOverride ?? m.severity, message, module: m.module });
  };

  // بيانات القضية
  const info = (src.caseInfo ?? {}) as Record<string, unknown>;
  const requiredInfo: [string, string][] = [
    ["employeeName", "اسم العامل"],
    ["employerName", "جهة العمل"],
    ["jobTitle", "المسمى الوظيفي"],
  ];
  const missingInfo = requiredInfo.filter(([k]) => !String(info[k] ?? "").trim());
  if (missingInfo.length)
    push("required_case", `بيانات القضية ناقصة: ${missingInfo.map((m) => m[1]).join("، ")}`);

  // العقود
  const contracts = (src.contracts ?? []).filter((c) => !c.deleted_at);
  if (!contracts.length) push("contracts_exist", "لا يوجد عقد عمل مسجل في الخطوة الثانية");

  contracts.forEach((c, i) => {
    const label = c.contract_name || c.contract_number || `العقد ${i + 1}`;
    if (!dateOk(c.start_date)) push("dates_valid", `${label}: تاريخ البداية غير صحيح`);
    const end = c.actual_end_date || c.end_date;
    if (end && dateOk(c.start_date) && dateOk(end) && t(end) < t(c.start_date))
      push("dates_valid", `${label}: تاريخ النهاية يسبق تاريخ البداية`);
  });

  // تداخل زمني وتكرار
  const sorted = contracts
    .filter((c) => dateOk(c.start_date))
    .slice()
    .sort((a, b) => t(a.start_date) - t(b.start_date));
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].actual_end_date || sorted[i - 1].end_date;
    if (dateOk(prevEnd) && t(sorted[i].start_date) < t(prevEnd))
      push("no_overlap", `تداخل زمني بين العقود قبل ${sorted[i].start_date}`);
  }
  const numbers = contracts.map((c) => String(c.contract_number ?? "").trim()).filter(Boolean);
  if (new Set(numbers).size !== numbers.length)
    push("no_duplicates", "توجد أرقام عقود مكررة");

  // الأجر
  const sal = src.salary;
  if (!sal || !Number(sal.actual_salary)) push("wage_required", "لم يتم إدخال بيانات الأجر (الخطوة 4)");
  else if (Number(sal.actual_salary) <= 0) push("no_negative", "الأجر الفعلي يجب أن يكون أكبر من صفر");

  // سبب الإنهاء
  const term = src.termination;
  if (!term || !term.termination_reason)
    push("termination_required", "لم يتم تحديد سبب انتهاء العلاقة العمالية (الخطوة 11)");
  else {
    const endFromContract = sorted.length
      ? sorted[sorted.length - 1].actual_end_date || sorted[sorted.length - 1].end_date
      : null;
    const termEnd = term.effective_termination_date || term.termination_date;
    if (dateOk(endFromContract) && dateOk(termEnd) && endFromContract !== termEnd)
      push(
        "service_end_match",
        `تاريخ انتهاء الخدمة (${termEnd}) لا يطابق تاريخ نهاية آخر عقد (${endFromContract})`,
      );
    if (dateOk(termEnd) && sorted.length && dateOk(sorted[0].start_date) && t(termEnd) < t(sorted[0].start_date))
      push("dates_valid", "تاريخ انتهاء الخدمة يسبق بداية الخدمة");
  }

  // بداية الخدمة
  const eosbStart = src.eosb?.service_start_date;
  if (dateOk(eosbStart) && sorted.length && dateOk(sorted[0].start_date) && eosbStart !== sorted[0].start_date)
    push(
      "service_start_match",
      `بداية الخدمة في مكافأة نهاية الخدمة (${eosbStart}) لا تطابق بداية أول عقد (${sorted[0].start_date})`,
    );

  // قيم سالبة
  const negChecks: [any[], string, string][] = [
    [src.unpaidSalaries ?? [], "amount", "المبالغ غير المسددة"],
    [src.overtime ?? [], "amount", "العمل الإضافي"],
    [src.compensation ?? [], "final_compensation", "التعويضات"],
    [src.payments ?? [], "amount_paid", "الدفعات"],
  ];
  negChecks.forEach(([rows, field, label]) => {
    if (rows.some((r) => Number(r?.[field]) < 0)) push("no_negative", `${label}: توجد قيم سالبة`);
  });

  // العملات
  const currencies = new Set<string>();
  [src.unpaidSalaries, src.compensation, src.payments].forEach((rows) =>
    (rows ?? []).forEach((r: any) => r?.currency && currencies.add(String(r.currency))),
  );
  if (sal?.currency) currencies.add(String(sal.currency));
  if (currencies.size > 1)
    push("currency_consistency", `تم استخدام أكثر من عملة: ${[...currencies].join("، ")}`);

  // المستندات
  const missingDocs: string[] = [];
  if ((src.unpaidSalaries ?? []).length && !(src.unpaidSalaries ?? []).some((r: any) => r.proof_file))
    missingDocs.push("إثبات سداد الرواتب");
  if (src.eosb && !src.eosb.proof_file && Number(src.eosb.paid_amount) > 0)
    missingDocs.push("إثبات صرف مكافأة نهاية الخدمة");
  if ((src.settlements ?? []).some((s: any) => s.has_settlement === "yes" && !s.settlement_file))
    missingDocs.push("نسخة المخالصة");
  if (term && term.has_document === false) missingDocs.push("مستند إنهاء العلاقة");
  if (missingDocs.length) push("documents_required", `مستندات مفقودة: ${missingDocs.join("، ")}`);

  return out;
}

/* ============================ 2) Legal Rules Loader ============================ */

export type LoadedRules = {
  country: string;
  engineVersion: string;
  effectiveFrom: string;
  legalBasis: string;
  systemVersion: string;
  moduleVersions: RuleVersions;
  lockedAt: string;
};

export function runRulesLoader(
  policy: CalcEnginePolicy,
  moduleVersions: RuleVersions,
  country = "SA",
): LoadedRules {
  return {
    country,
    engineVersion: policy.version,
    effectiveFrom: policy.effective_from,
    legalBasis: policy.legal_basis,
    systemVersion: policy.system_version,
    moduleVersions,
    lockedAt: new Date().toISOString(),
  };
}

/* ============================ 3) Eligibility Engine ============================ */

export type EligibilityRow = {
  code: string;
  label: string;
  eligible: boolean;
  reason: string;
  legalRef: string;
  source: string;
};

const rightForStep = (rights: ComputedRight[], code: string) =>
  rights.find((r) => r.code === code) ?? null;

export function runEligibilityEngine(
  src: CalcSources,
  rights: ComputedRight[],
  policy: CalcEnginePolicy,
): EligibilityRow[] {
  return policy.pipeline
    .filter((s) => !["paid_rights", "excluded_rights", "final_balance"].includes(s.code))
    .map((step) => {
      const r = rightForStep(rights, step.code);
      let eligible = !!r && (r.due > 0 || r.paidInModule > 0);
      let reason = eligible ? "تحقق الاستحقاق وفق بيانات الوحدة المصدر" : "لا توجد مبالغ محتسبة في الوحدة المصدر";

      if (step.code === "eosb" && src.eosb) {
        eligible = !!src.eosb.eligible && Number(src.eosb.final_gratuity_amount ?? 0) > 0;
        reason = src.eosb.eligible
          ? "العامل مستحق للمكافأة وفق نتيجة الخطوة 12"
          : String(src.eosb.ineligibility_reason ?? "غير مستحق وفق نتيجة الخطوة 12");
      }
      if (step.code === "compensation") {
        const active = (src.compensation ?? []).filter((c: any) => !c.excluded_from_claim);
        eligible = active.length > 0 && active.some((c: any) => Number(c.final_compensation) > 0);
        reason = eligible
          ? "تحققت شروط التعويض في الخطوة 13"
          : "لم تتحقق شروط استحقاق التعويض أو تم استبعاده";
      }
      if (step.code === "social_insurance" && src.socialInsurance) {
        eligible = Number(src.socialInsurance.total_difference ?? 0) > 0;
        reason = eligible ? "توجد فروق اشتراكات محتسبة" : "لا توجد فروق اشتراكات";
      }

      return {
        code: step.code,
        label: step.label,
        eligible,
        reason,
        legalRef: step.legal_ref,
        source: step.source,
      };
    });
}

/* ============================ 4) Formula Engine ============================ */

export type FormulaResult = {
  code: string;
  label: string;
  order: number;
  formula: string;
  legalRef: string;
  source: string;
  amount: number;
  paidInModule: number;
  currency: string;
  eligible: boolean;
  note: string;
};

export function runFormulaEngine(
  rights: ComputedRight[],
  eligibility: EligibilityRow[],
  policy: CalcEnginePolicy,
  currency: string,
): FormulaResult[] {
  return policy.pipeline
    .filter((s) => !["paid_rights", "excluded_rights", "final_balance"].includes(s.code))
    .map((step) => {
      const r = rightForStep(rights, step.code);
      const e = eligibility.find((x) => x.code === step.code);
      const eligible = !!e?.eligible;
      return {
        code: step.code,
        label: step.label,
        order: step.order,
        formula: step.formula,
        legalRef: step.legal_ref,
        source: step.source,
        amount: eligible ? round2(r?.due ?? 0) : 0,
        paidInModule: round2(r?.paidInModule ?? 0),
        currency: r?.currency ?? currency,
        eligible,
        note: e?.reason ?? "",
      };
    });
}

/* ============================ 5) Exception Engine ============================ */

export type ExceptionHit = {
  code: string;
  label: string;
  severity: string;
  effect: string;
  detail: string;
};

export function runExceptionEngine(src: CalcSources, policy: CalcEnginePolicy): ExceptionHit[] {
  const hits: ExceptionHit[] = [];
  const add = (code: string, detail: string) => {
    const rule = policy.exception_rules.find((r) => r.code === code);
    if (!rule) return;
    hits.push({ code, label: rule.label, severity: rule.severity, effect: rule.effect, detail });
  };

  const contracts = (src.contracts ?? []).filter((c) => !c.deleted_at);
  if (contracts.length > 1) add("multiple_contracts", `عدد العقود المسجلة: ${contracts.length}`);

  const sorted = contracts
    .filter((c) => dateOk(c.start_date))
    .slice()
    .sort((a, b) => t(a.start_date) - t(b.start_date));
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].actual_end_date || sorted[i - 1].end_date;
    if (dateOk(prevEnd)) {
      const gapDays = Math.round((t(sorted[i].start_date) - t(prevEnd)) / 86400000);
      if (gapDays > 1) add("service_gaps", `انقطاع ${gapDays} يوماً قبل ${sorted[i].start_date}`);
    }
  }

  const term = src.termination;
  if (term) {
    const reason = String(term.termination_reason ?? "");
    if (reason.includes("death")) add("employee_death", "سبب الإنهاء مسجل كوفاة العامل");
    if (reason.includes("force_majeure")) add("force_majeure", "سبب الإنهاء مرتبط بقوة قاهرة");
    if (reason.includes("transfer")) add("establishment_transfer", "يوجد انتقال/تغيير في المنشأة");
  }

  if ((src.settlements ?? []).some((s: any) => s.court_ruling_after))
    add("court_ruling", "توجد إشارة إلى حكم قضائي بعد المخالصة");

  const sal = src.salary;
  if (sal && src.eosb && Number(src.eosb.last_approved_wage ?? 0) > 0) {
    const diff = Math.abs(Number(src.eosb.last_approved_wage) - Number(sal.actual_salary ?? 0));
    if (diff > 1) add("wage_change", "الأجر المعتمد في المكافأة يختلف عن الأجر المسجل في الخطوة 4");
  }

  const activeSettlements = (src.settlements ?? []).filter((s: any) => s.has_settlement === "yes");
  if (activeSettlements.length > 1)
    add("multi_settlement", `عدد المخالصات المسجلة: ${activeSettlements.length}`);

  const currencies = new Set<string>();
  (src.payments ?? []).forEach((p: any) => p?.currency && currencies.add(String(p.currency)));
  if (sal?.currency) currencies.add(String(sal.currency));
  if (currencies.size > 1) add("multi_currency", `العملات المستخدمة: ${[...currencies].join("، ")}`);

  return hits;
}

/* ============================ 6) Conflict Resolution Engine ============================ */

export type ConflictHit = {
  code: string;
  label: string;
  severity: string;
  action: string;
  detail: string;
};

export function runConflictEngine(
  src: CalcSources,
  rights: ComputedRight[],
  policy: CalcEnginePolicy,
): ConflictHit[] {
  const hits: ConflictHit[] = [];
  const add = (code: string, detail: string) => {
    const rule = policy.conflict_rules.find((r) => r.code === code);
    if (!rule) return;
    hits.push({ code, label: rule.label, severity: rule.severity, action: rule.action, detail });
  };

  const term = src.termination;
  if (term && term.has_document === false && String(term.termination_reason ?? ""))
    add("termination_vs_documents", "سبب الإنهاء مسجل دون مستند مؤيد");

  const contracts = (src.contracts ?? []).filter((c) => !c.deleted_at && dateOk(c.start_date));
  const firstStart = contracts.length
    ? contracts.map((c) => t(c.start_date)).sort((a, b) => a - b)[0]
    : NaN;
  (src.unpaidSalaries ?? []).forEach((r: any) => {
    if (dateOk(r.due_date) && Number.isFinite(firstStart) && t(r.due_date) < firstStart)
      add("contract_vs_salary", `مبلغ مستحق بتاريخ ${r.due_date} يسبق بداية أول عقد`);
  });

  rights.forEach((r) => {
    const paidInSettlement = (src.payments ?? [])
      .filter((p: any) => p.right_type === r.code)
      .reduce((s: number, p: any) => s + (Number(p.amount_paid) || 0), 0);
    const total = r.paidInModule + paidInSettlement;
    if (total - r.due > 1)
      add(
        "paid_exceeds_due",
        `${r.label}: المسدد (${round2(total)}) يتجاوز المستحق المحتسب (${round2(r.due)})`,
      );
  });

  const declared = (src.settlements ?? [])
    .filter((s: any) => s.has_settlement === "yes")
    .reduce((sum: number, s: any) => sum + (Number(s.total_settlement_amount) || 0), 0);
  const paidTotal = (src.payments ?? []).reduce(
    (sum: number, p: any) => sum + (Number(p.amount_paid) || 0),
    0,
  );
  if (declared > 0 && Math.abs(declared - paidTotal) > 1)
    add(
      "settlement_vs_data",
      `قيمة المخالصة المعلنة (${round2(declared)}) تختلف عن مجموع الدفعات (${round2(paidTotal)})`,
    );

  if (term && term.notice_given === false) {
    const hasNotice = (src.compensation ?? []).some((c: any) =>
      String(c.claim_type ?? "").includes("notice"),
    );
    if (!hasNotice && String(term.initiated_by ?? "") === "employer")
      add("notice_vs_reason", "الإنهاء من صاحب العمل دون إشعار ولم تُحتسب مطالبة ببدل الإشعار");
  }

  return hits;
}

/* ============================ 7) Calculation Engine Core ============================ */

export type CalcTotals = {
  totalSalary: number;
  totalLeave: number;
  totalSickLeave: number;
  totalMaternity: number;
  totalInsurance: number;
  totalGratuity: number;
  totalCompensation: number;
  totalOther: number;
  totalRights: number;
  totalPaidRights: number;
  totalExcludedRights: number;
  finalClaimAmount: number;
};

const GROUPS: Record<string, keyof CalcTotals> = {
  unpaid_salaries: "totalSalary",
  salaries: "totalSalary",
  overtime: "totalSalary",
  annual_leave: "totalLeave",
  sick_leave: "totalSickLeave",
  maternity: "totalMaternity",
  social_insurance: "totalInsurance",
  eosb: "totalGratuity",
  compensation: "totalCompensation",
};

export function runCalculationCore(
  formulas: FormulaResult[],
  src: CalcSources,
  rights: ComputedRight[],
): CalcTotals {
  const totals: CalcTotals = {
    totalSalary: 0,
    totalLeave: 0,
    totalSickLeave: 0,
    totalMaternity: 0,
    totalInsurance: 0,
    totalGratuity: 0,
    totalCompensation: 0,
    totalOther: 0,
    totalRights: 0,
    totalPaidRights: 0,
    totalExcludedRights: 0,
    finalClaimAmount: 0,
  };

  formulas.forEach((f) => {
    const key = GROUPS[f.code] ?? "totalOther";
    (totals[key] as number) = round2((totals[key] as number) + f.amount);
  });

  totals.totalRights = round2(
    totals.totalSalary +
      totals.totalLeave +
      totals.totalSickLeave +
      totals.totalMaternity +
      totals.totalInsurance +
      totals.totalGratuity +
      totals.totalCompensation +
      totals.totalOther,
  );

  // الحقوق المسددة: ما سُجل داخل الوحدات + دفعات المخالصة
  const paidInModules = rights.reduce((s, r) => s + Math.max(r.paidInModule, 0), 0);
  const paidInSettlement = (src.payments ?? []).reduce(
    (s: number, p: any) => s + (Number(p.amount_paid) || 0),
    0,
  );
  totals.totalPaidRights = round2(Math.min(paidInModules + paidInSettlement, totals.totalRights));

  // الحقوق المستبعدة: ما ثبت سداده بالكامل بإثبات ضمن حق قابل للتنازل
  totals.totalExcludedRights = round2(
    rights.reduce((s, r) => {
      const settled = (src.payments ?? [])
        .filter((p: any) => p.right_type === r.code)
        .reduce((x: number, p: any) => x + (Number(p.amount_paid) || 0), 0);
      const paid = r.paidInModule + settled;
      const proved =
        r.hasModuleProof ||
        (src.payments ?? []).some((p: any) => p.right_type === r.code && p.proof_file);
      return proved && paid + 1 >= r.due && r.due > 0 ? s + r.due : s;
    }, 0),
  );

  totals.finalClaimAmount = round2(
    Math.max(totals.totalRights - totals.totalPaidRights - Math.max(totals.totalExcludedRights - totals.totalPaidRights, 0), 0),
  );

  return totals;
}

/* ============================ 9) Confidence Score ============================ */

export type ConfidenceResult = { score: number; label: string; tone: string; reasons: string[] };

export function computeConfidence(
  validations: ValidationIssue[],
  conflicts: ConflictHit[],
  eligibility: EligibilityRow[],
  policy: CalcEnginePolicy,
): ConfidenceResult {
  const c = policy.confidence;
  const reasons: string[] = [];
  let score = c.base;

  const errors = validations.filter((v) => v.severity === "error");
  const warnings = validations.filter((v) => v.severity === "warning");
  const docIssues = validations.filter((v) => v.code === "documents_required");

  if (errors.length) {
    score -= errors.length * c.penalty_error;
    reasons.push(`${errors.length} خطأ في البيانات`);
  }
  if (warnings.length) {
    score -= warnings.length * c.penalty_warning;
    reasons.push(`${warnings.length} تحذير`);
  }
  if (docIssues.length) {
    score -= docIssues.length * c.penalty_missing_document;
    reasons.push("مستندات مفقودة");
  }
  if (conflicts.length) {
    score -= conflicts.length * c.penalty_conflict;
    reasons.push(`${conflicts.length} تعارض`);
  }
  const missingModules = eligibility.filter((e) => !e.eligible).length;
  if (missingModules) {
    score -= missingModules * c.penalty_missing_module;
    reasons.push(`${missingModules} وحدة بدون بيانات محتسبة`);
  }

  score = Math.max(c.min, Math.min(100, Math.round(score)));
  const band = c.bands.find((b) => score >= b.min) ?? c.bands[c.bands.length - 1];
  return { score, label: band?.label ?? "", tone: band?.tone ?? "info", reasons };
}

/* ============================ سجلات ومخرجات ============================ */

export type EngineStatus = {
  code: string;
  label: string;
  order: number;
  status: "success" | "warning" | "failed" | "skipped";
  message: string;
  durationMs: number;
};

export type CalcLogRow = {
  moduleName: string;
  stepNumber: number;
  ruleApplied: string;
  formulaUsed: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  executionTimeMs: number;
  status: string;
  errorMessage: string | null;
};

export type CalculationRun = {
  status: "completed" | "blocked" | "failed";
  blockedReason: string | null;
  rules: LoadedRules;
  engines: EngineStatus[];
  validations: ValidationIssue[];
  eligibility: EligibilityRow[];
  formulas: FormulaResult[];
  exceptions: ExceptionHit[];
  conflicts: ConflictHit[];
  totals: CalcTotals;
  confidence: ConfidenceResult;
  rights: ComputedRight[];
  logs: CalcLogRow[];
  reportData: ReportData;
  snapshot: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
  currency: string;
};

/* ============================ 8) Report Data Builder ============================ */

export type ReportData = {
  country: string;
  ruleVersion: string;
  systemVersion: string;
  currency: string;
  lines: { code: string; label: string; amount: number; legalRef: string; formula: string }[];
  totals: CalcTotals;
  confidence: ConfidenceResult;
  warnings: string[];
  errors: string[];
  exceptions: ExceptionHit[];
  conflicts: ConflictHit[];
  generatedAt: string;
};

function buildReportData(run: Omit<CalculationRun, "reportData" | "snapshot">): ReportData {
  return {
    country: run.rules.country,
    ruleVersion: run.rules.engineVersion,
    systemVersion: run.rules.systemVersion,
    currency: run.currency,
    lines: run.formulas
      .filter((f) => f.amount > 0)
      .map((f) => ({
        code: f.code,
        label: f.label,
        amount: f.amount,
        legalRef: f.legalRef,
        formula: f.formula,
      })),
    totals: run.totals,
    confidence: run.confidence,
    warnings: [
      ...run.validations.filter((v) => v.severity === "warning").map((v) => v.message),
      ...run.conflicts.map((c) => `${c.label}: ${c.detail}`),
    ],
    errors: run.validations.filter((v) => v.severity === "error").map((v) => v.message),
    exceptions: run.exceptions,
    conflicts: run.conflicts,
    generatedAt: new Date().toISOString(),
  };
}

/* ============================ المنسّق (Orchestrator) ============================ */

export function runCalculationEngine(
  src: CalcSources,
  policy: CalcEnginePolicy,
  settlementPolicy: FinalSettlementPolicy,
  opts: { country?: string; currency?: string; moduleVersions?: RuleVersions } = {},
): CalculationRun {
  const country = opts.country ?? "SA";
  const currency = opts.currency ?? String(src.salary?.currency ?? "SAR");
  const startedAt = new Date().toISOString();
  const engines: EngineStatus[] = [];
  const logs: CalcLogRow[] = [];

  const engineDef = (code: string) =>
    policy.engines.find((e) => e.code === code) ?? { code, label: code, order: 0 };

  const mark = (
    code: string,
    status: EngineStatus["status"],
    message: string,
    durationMs: number,
  ) => {
    const d = engineDef(code);
    engines.push({ code, label: d.label, order: d.order, status, message, durationMs });
  };

  const timed = <T,>(code: string, fn: () => T): { value: T; ms: number } => {
    const s = performance.now();
    const value = fn();
    return { value, ms: Math.round(performance.now() - s) };
  };

  // 1) التحقق
  const v = timed("validation", () => runValidationEngine(src, policy));
  const validations = v.value;
  const blockingIssues = validations.filter((i) => isBlocking(policy, i.severity));
  mark(
    "validation",
    blockingIssues.length ? "failed" : validations.length ? "warning" : "success",
    blockingIssues.length
      ? `${blockingIssues.length} خطأ يمنع الحساب`
      : `${validations.length} ملاحظة`,
    v.ms,
  );
  logs.push({
    moduleName: "validation",
    stepNumber: 1,
    ruleApplied: policy.version,
    formulaUsed: "validation_rules",
    inputData: { rules: policy.validation_rules.length },
    outputData: { issues: validations.length, blocking: blockingIssues.length },
    executionTimeMs: v.ms,
    status: blockingIssues.length ? "failed" : "success",
    errorMessage: blockingIssues.length ? blockingIssues.map((i) => i.message).join(" | ") : null,
  });

  // 2) تحميل القواعد
  const r = timed("rules", () =>
    runRulesLoader(policy, opts.moduleVersions ?? {}, country),
  );
  const rules = r.value;
  mark("rules", "success", "تم تطبيق القواعد القانونية", r.ms);
  logs.push({
    moduleName: "rules",
    stepNumber: 2,
    ruleApplied: rules.engineVersion,
    formulaUsed: "—",
    inputData: { country },
    outputData: { ...rules.moduleVersions },
    executionTimeMs: r.ms,
    status: "success",
    errorMessage: null,
  });

  // الحقوق المحتسبة من الوحدات السابقة
  const rights = buildComputedRights(src, settlementPolicy, currency);

  const emptyTotals = runCalculationCore([], src, []);
  const baseRun = (
    status: CalculationRun["status"],
    blockedReason: string | null,
    partial: Partial<CalculationRun>,
  ): CalculationRun => {
    const core = {
      status,
      blockedReason,
      rules,
      engines,
      validations,
      eligibility: partial.eligibility ?? [],
      formulas: partial.formulas ?? [],
      exceptions: partial.exceptions ?? [],
      conflicts: partial.conflicts ?? [],
      totals: partial.totals ?? emptyTotals,
      confidence:
        partial.confidence ??
        computeConfidence(validations, partial.conflicts ?? [], partial.eligibility ?? [], policy),
      rights,
      logs,
      startedAt,
      completedAt: new Date().toISOString(),
      currency,
    };
    const reportData = buildReportData(core);
    return {
      ...core,
      reportData,
      snapshot: {
        engineVersion: policy.version,
        systemVersion: policy.system_version,
        country,
        currency,
        startedAt,
        completedAt: core.completedAt,
        inputs: {
          caseInfo: src.caseInfo,
          contracts: src.contracts,
          salary: src.salary,
          termination: src.termination,
          settlements: src.settlements,
          payments: src.payments,
        },
        rights,
        formulas: core.formulas,
        eligibility: core.eligibility,
        exceptions: core.exceptions,
        conflicts: core.conflicts,
        validations,
        totals: core.totals,
        confidence: core.confidence,
        rules,
      },
    };
  };

  // Atomic: لا نعتمد نتائج جزئية عند وجود خطأ مانع
  if (blockingIssues.length && policy.block_on_error) {
    ["eligibility", "formula", "exceptions", "conflicts", "core", "report"].forEach((c) =>
      mark(c, "skipped", "تم الإيقاف بسبب أخطاء في البيانات", 0),
    );
    return baseRun("blocked", blockingIssues.map((i) => i.message).join(" | "), {});
  }

  // 3) الأهلية
  const el = timed("eligibility", () => runEligibilityEngine(src, rights, policy));
  const eligibility = el.value;
  mark(
    "eligibility",
    "success",
    `${eligibility.filter((e) => e.eligible).length} حق مستحق من ${eligibility.length}`,
    el.ms,
  );
  eligibility.forEach((e, i) =>
    logs.push({
      moduleName: `eligibility:${e.code}`,
      stepNumber: 3,
      ruleApplied: e.legalRef,
      formulaUsed: "eligibility_rules",
      inputData: { source: e.source },
      outputData: { eligible: e.eligible, reason: e.reason, index: i },
      executionTimeMs: 0,
      status: e.eligible ? "success" : "skipped",
      errorMessage: null,
    }),
  );

  // 4) المعادلات
  const fo = timed("formula", () => runFormulaEngine(rights, eligibility, policy, currency));
  const formulas = fo.value;
  mark("formula", "success", `تم تنفيذ ${formulas.length} معادلة`, fo.ms);
  formulas.forEach((f) =>
    logs.push({
      moduleName: f.code,
      stepNumber: 4,
      ruleApplied: f.legalRef,
      formulaUsed: f.formula,
      inputData: { source: f.source, eligible: f.eligible },
      outputData: { amount: f.amount, paidInModule: f.paidInModule, currency: f.currency },
      executionTimeMs: 0,
      status: f.eligible ? "success" : "skipped",
      errorMessage: null,
    }),
  );

  // 5) الاستثناءات
  const ex = timed("exceptions", () => runExceptionEngine(src, policy));
  const exceptions = ex.value;
  mark(
    "exceptions",
    exceptions.some((e) => e.severity === "warning") ? "warning" : "success",
    exceptions.length ? `${exceptions.length} حالة استثنائية` : "لا توجد حالات استثنائية",
    ex.ms,
  );

  // 6) التعارضات
  const cf = timed("conflicts", () => runConflictEngine(src, rights, policy));
  const conflicts = cf.value;
  mark(
    "conflicts",
    conflicts.length ? "warning" : "success",
    conflicts.length ? `${conflicts.length} تعارض يحتاج مراجعة` : "لا توجد تعارضات",
    cf.ms,
  );
  logs.push({
    moduleName: "conflicts",
    stepNumber: 6,
    ruleApplied: policy.version,
    formulaUsed: "conflict_rules",
    inputData: { rules: policy.conflict_rules.length },
    outputData: { conflicts: conflicts.map((c) => c.code) },
    executionTimeMs: cf.ms,
    status: conflicts.length ? "warning" : "success",
    errorMessage: null,
  });

  if (conflicts.length && policy.block_on_conflict) {
    ["core", "report"].forEach((c) => mark(c, "skipped", "تم الإيقاف بسبب تعارضات", 0));
    return baseRun("blocked", conflicts.map((c) => `${c.label}: ${c.detail}`).join(" | "), {
      eligibility,
      formulas,
      exceptions,
      conflicts,
    });
  }

  // 7) الحساب النهائي
  const co = timed("core", () => runCalculationCore(formulas, src, rights));
  const totals = co.value;
  mark("core", "success", `الرصيد النهائي ${round2(totals.finalClaimAmount)}`, co.ms);
  logs.push({
    moduleName: "final_balance",
    stepNumber: 7,
    ruleApplied: policy.version,
    formulaUsed: "total_rights - paid - excluded",
    inputData: { totalRights: totals.totalRights },
    outputData: { ...totals },
    executionTimeMs: co.ms,
    status: "success",
    errorMessage: null,
  });

  const confidence = computeConfidence(validations, conflicts, eligibility, policy);

  // 8) بناء بيانات التقرير + لقطة التدقيق
  const built = baseRun("completed", null, {
    eligibility,
    formulas,
    exceptions,
    conflicts,
    totals,
    confidence,
  });
  mark("report", "success", `درجة اكتمال البيانات ${confidence.score}%`, 0);
  return built;
}

/* ============================ أدوات العرض ============================ */

export const calcMoney = (n: number, currency = "SAR") =>
  `${round2(n).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export const severityLabel = (code: string, policy: CalcEnginePolicy) =>
  policy.severities.find((s) => s.code === code)?.label ?? code;
