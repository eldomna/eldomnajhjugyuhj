// PART 1K — مكافأة نهاية الخدمة
// محرك مستقل: لا يمس محركات الحساب القائمة (engine.server.ts)، وجميع القواعد تُحمّل من محرك القوانين.

/* ============================ السياسة ============================ */

export type EosbPaymentMethod = { code: string; label: string };

export type EosbScaleBand = { from: number; to: number | null; rate: number };

export type EosbReasonEffect = {
  match: string[];
  rate?: number;
  scale?: EosbScaleBand[];
  label: string;
  legal_ref: string;
};

export type EosbPolicy = {
  version: string;
  effective_from: string;
  legal_basis: string;
  /** last_wage | average_wage */
  wage_rule: string;
  wage_included: string[];
  wage_excluded: string[];
  first_years: number;
  first_rate: number;
  after_rate: number;
  /** prorata | ignore | full_year */
  fraction_rule: string;
  merge_continuous_contracts: boolean;
  entity_transfer_counts: boolean;
  allow_better_agreement: boolean;
  reason_effects: EosbReasonEffect[];
  exclusions: string[];
  beneficiary_notes: Record<string, string>;
  payment_methods: EosbPaymentMethod[];
  notes: string;
};

const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const strArr = (v: unknown, d: string[]) =>
  Array.isArray(v) ? (v as unknown[]).map((x) => String(x)).filter(Boolean) : d;

export const DEFAULT_EOSB_POLICY: EosbPolicy = {
  version: "SA-EOSB-default",
  effective_from: "2015-01-01",
  legal_basis: "نظام العمل السعودي — المواد 84 إلى 88",
  wage_rule: "last_wage",
  wage_included: [
    "basic_salary",
    "housing_allowance",
    "transport_allowance",
    "communication_allowance",
    "work_nature_allowance",
    "risk_allowance",
    "delegation_allowance",
    "other_allowances",
    "fixed_commission",
    "fixed_bonus",
    "other_benefits",
  ],
  wage_excluded: ["العمولات المتغيرة", "الأجر الإضافي", "المزايا العينية"],
  first_years: 5,
  first_rate: 0.5,
  after_rate: 1,
  fraction_rule: "prorata",
  merge_continuous_contracts: true,
  entity_transfer_counts: true,
  allow_better_agreement: true,
  reason_effects: [],
  exclusions: [],
  beneficiary_notes: {},
  payment_methods: [
    { code: "bank_transfer", label: "تحويل بنكي" },
    { code: "cheque", label: "شيك" },
    { code: "cash", label: "نقداً" },
    { code: "receipt_voucher", label: "سند قبض" },
    { code: "final_settlement", label: "مخالصة نهائية" },
    { code: "other", label: "مستند آخر" },
  ],
  notes: "التحليل استرشادي مبني على القواعد المحمّلة ولا يُعد حكماً قضائياً.",
};

export function toEosbPolicy(value: unknown): EosbPolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const effects: EosbReasonEffect[] = Array.isArray(v.reason_effects)
    ? (v.reason_effects as Record<string, unknown>[]).map((e) => ({
        match: strArr(e.match, []),
        rate: typeof e.rate === "number" ? e.rate : undefined,
        scale: Array.isArray(e.scale)
          ? (e.scale as Record<string, unknown>[]).map((b) => ({
              from: num(b.from, 0),
              to: typeof b.to === "number" ? b.to : null,
              rate: num(b.rate, 0),
            }))
          : undefined,
        label: str(e.label, "قاعدة استحقاق"),
        legal_ref: str(e.legal_ref, "—"),
      }))
    : [];
  const methods: EosbPaymentMethod[] = Array.isArray(v.payment_methods)
    ? (v.payment_methods as Record<string, unknown>[])
        .map((m) => ({ code: str(m.code, ""), label: str(m.label, str(m.code, "")) }))
        .filter((m) => m.code)
    : [];
  return {
    version: str(v.version, DEFAULT_EOSB_POLICY.version),
    effective_from: str(v.effective_from, DEFAULT_EOSB_POLICY.effective_from),
    legal_basis: str(v.legal_basis, DEFAULT_EOSB_POLICY.legal_basis),
    wage_rule: str(v.wage_rule, DEFAULT_EOSB_POLICY.wage_rule),
    wage_included: strArr(v.wage_included, DEFAULT_EOSB_POLICY.wage_included),
    wage_excluded: strArr(v.wage_excluded, DEFAULT_EOSB_POLICY.wage_excluded),
    first_years: num(v.first_years, DEFAULT_EOSB_POLICY.first_years),
    first_rate: num(v.first_rate, DEFAULT_EOSB_POLICY.first_rate),
    after_rate: num(v.after_rate, DEFAULT_EOSB_POLICY.after_rate),
    fraction_rule: str(v.fraction_rule, DEFAULT_EOSB_POLICY.fraction_rule),
    merge_continuous_contracts: bool(v.merge_continuous_contracts, true),
    entity_transfer_counts: bool(v.entity_transfer_counts, true),
    allow_better_agreement: bool(v.allow_better_agreement, true),
    reason_effects: effects,
    exclusions: strArr(v.exclusions, []),
    beneficiary_notes:
      v.beneficiary_notes && typeof v.beneficiary_notes === "object"
        ? Object.fromEntries(
            Object.entries(v.beneficiary_notes as Record<string, unknown>).map(([k, val]) => [
              k,
              String(val),
            ]),
          )
        : {},
    payment_methods: methods.length ? methods : DEFAULT_EOSB_POLICY.payment_methods,
    notes: str(v.notes, DEFAULT_EOSB_POLICY.notes),
  };
}

/* ============================ الإدخال ============================ */

export type EosbWageLine = { key: string; label: string; amount: number; included: boolean };

export type EosbContext = {
  /** حالة العلاقة من الخطوة 11 */
  employmentStatus: string;
  terminationReasonCode: string;
  terminationReasonLabel: string;
  terminationLegalRef: string;
  /** أثر السبب على المكافأة من الخطوة 11: full | resignation_scale | none | review */
  terminationEosbEffect: string;
  endedDuringTrial: boolean;
  serviceStart: string | null;
  serviceEnd: string | null;
  contractTypes: string[];
  contractsCount: number;
  continuousService: boolean;
  entityTransfer: boolean;
  wageLines: EosbWageLine[];
  currency: string;
};

export type EosbPaymentInput = {
  /** not_paid | paid | partial */
  paymentStatus: string;
  paidAmount: number | "";
  paymentDate: string;
  paymentMethod: string;
  proofFile: string;
};

export type EosbExceptionsInput = {
  hasSettlement: boolean;
  hasCourtRuling: boolean;
  hasBetterAgreement: boolean;
  agreementAmount: number | "";
  exceptionsNotes: string;
};

export type EosbInput = {
  context: EosbContext;
  payment: EosbPaymentInput;
  exceptions: EosbExceptionsInput;
  notes: string;
  policy: EosbPolicy | undefined;
};

/* ============================ أدوات ============================ */

const D = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const r2 = (v: number) => Math.round(v * 100) / 100;

export const eosbMoney = (v: number, currency = "SAR") =>
  `${(Number.isFinite(v) ? v : 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

export type ServiceDuration = {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  fractionYears: number;
  decimalYears: number;
};

export function computeServiceDuration(
  start?: string | null,
  end?: string | null,
): ServiceDuration {
  const s = D(start);
  const e = D(end);
  if (!s || !e || e.getTime() <= s.getTime())
    return { years: 0, months: 0, days: 0, totalDays: 0, fractionYears: 0, decimalYears: 0 };

  let years = e.getFullYear() - s.getFullYear();
  let months = e.getMonth() - s.getMonth();
  let days = e.getDate() - s.getDate();
  if (days < 0) {
    months -= 1;
    const prev = new Date(e.getFullYear(), e.getMonth(), 0).getDate();
    days += prev;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalDays = Math.round((e.getTime() - s.getTime()) / 86400000);
  const fractionYears = r2((months * 30 + days) / 365);
  return {
    years,
    months,
    days,
    totalDays,
    fractionYears,
    decimalYears: Math.round((totalDays / 365) * 10000) / 10000,
  };
}

/* ============================ التحليل ============================ */

export type EosbStep = { title: string; detail: string; value?: string };
export type EosbWarning = { level: "error" | "warning" | "info"; message: string };

export type EosbAnalysis = {
  eligible: boolean;
  ineligibilityReason: string | null;
  duration: ServiceDuration;
  wage: { included: EosbWageLine[]; excluded: EosbWageLine[]; approved: number; rule: string };
  contractType: string;
  reasonCode: string;
  reasonLabel: string;
  legalRef: string;
  countedYears: number;
  baseAmount: number;
  eligibilityPercentage: number;
  eligibilityLabel: string;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  excludedFromClaim: boolean;
  steps: EosbStep[];
  warnings: EosbWarning[];
  legalRuleVersion: string;
  beneficiaryNote: string | null;
  handoff: Record<string, unknown>;
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  fixed: "محدد المدة",
  fixed_term: "محدد المدة",
  indefinite: "غير محدد المدة",
  seasonal: "موسمي",
  part_time: "جزئي",
  special: "عقد خاص",
  other: "عقد آخر",
};

export const contractTypeLabel = (code: string) => CONTRACT_TYPE_LABELS[code] ?? code ?? "—";

function rateFromScale(scale: EosbScaleBand[], years: number): number {
  for (const b of scale) {
    const to = b.to == null ? Infinity : b.to;
    if (years >= b.from && years < to) return b.rate;
  }
  return scale.length ? scale[scale.length - 1].rate : 1;
}

export function analyzeEosb(input: EosbInput): EosbAnalysis {
  const policy = input.policy ?? DEFAULT_EOSB_POLICY;
  const ctx = input.context;
  const warnings: EosbWarning[] = [];
  const steps: EosbStep[] = [];
  const push = (level: EosbWarning["level"], message: string) => warnings.push({ level, message });

  const duration = computeServiceDuration(ctx.serviceStart, ctx.serviceEnd);
  const included = ctx.wageLines.filter((l) => l.included && l.amount > 0);
  const excluded = ctx.wageLines.filter((l) => !l.included);
  const approvedWage = r2(included.reduce((s, l) => s + l.amount, 0));
  const contractType = ctx.contractTypes[ctx.contractTypes.length - 1] ?? "";

  const base = {
    duration,
    wage: { included, excluded, approved: approvedWage, rule: policy.wage_rule },
    contractType,
    reasonCode: ctx.terminationReasonCode,
    reasonLabel: ctx.terminationReasonLabel || "—",
    legalRuleVersion: policy.version,
  };

  /* --- الخطوة الأولى: أهلية الاستحقاق --- */
  const notEligible = (reason: string): EosbAnalysis => ({
    ...base,
    eligible: false,
    ineligibilityReason: reason,
    legalRef: ctx.terminationLegalRef || policy.legal_basis,
    countedYears: duration.decimalYears,
    baseAmount: 0,
    eligibilityPercentage: 0,
    eligibilityLabel: "لا استحقاق",
    finalAmount: 0,
    paidAmount: 0,
    remainingAmount: 0,
    excludedFromClaim: true,
    steps: [{ title: "التحقق من أهلية الاستحقاق", detail: reason }],
    warnings: [{ level: "warning", message: reason }],
    beneficiaryNote: null,
    handoff: { eligible: false, final_gratuity: 0, reason },
  });

  if (ctx.employmentStatus === "active")
    return notEligible(
      "العلاقة العمالية ما زالت قائمة، ولا تُحتسب مكافأة نهاية الخدمة قبل انتهائها.",
    );
  if (ctx.employmentStatus === "suspended")
    return notEligible(
      "العلاقة العمالية معلقة ولم تنته بعد، لذلك يتوقف احتساب مكافأة نهاية الخدمة على تحديد وضع التعليق.",
    );
  if (!ctx.terminationReasonCode)
    return notEligible(
      "لم يتم تحديد سبب انتهاء العلاقة العمالية في الخطوة 11، وهو شرط لاحتساب المكافأة.",
    );
  if (ctx.endedDuringTrial && policy.exclusions.includes("trial_period_termination"))
    return notEligible(
      "انتهت العلاقة العمالية خلال فترة التجربة النظامية، ولا تُستحق مكافأة نهاية الخدمة وفق القاعدة المطبقة.",
    );
  if (policy.exclusions.includes(ctx.terminationReasonCode))
    return notEligible(
      `سبب انتهاء العلاقة (${ctx.terminationReasonLabel || ctx.terminationReasonCode}) مُستثنى من استحقاق المكافأة وفق القاعدة المطبقة.`,
    );
  if (!ctx.serviceStart || !ctx.serviceEnd)
    return notEligible(
      "لا يمكن تحديد مدة الخدمة المحتسبة من العقود المسجلة في الخطوة الثانية.",
    );
  if (approvedWage <= 0)
    return notEligible("لم يتم إدخال الأجر في الخطوة الرابعة، ولا يمكن احتساب المكافأة بدونه.");

  steps.push({
    title: "1) التحقق من أهلية الاستحقاق",
    detail: "انتهت العلاقة العمالية والسبب المسجل لا يُسقط الاستحقاق وفق القواعد المحمّلة.",
  });

  /* --- الخطوة الثانية: مدة الخدمة --- */
  steps.push({
    title: "2) مدة الخدمة المحتسبة",
    detail: `من ${ctx.serviceStart} إلى ${ctx.serviceEnd} (تُحسب تلقائياً من العقود ولا تُعدّل يدوياً)`,
    value: `${duration.years} سنة و${duration.months} شهر و${duration.days} يوم`,
  });
  if (ctx.contractsCount > 1) {
    if (ctx.continuousService && policy.merge_continuous_contracts) {
      push("info", `تم ضم ${ctx.contractsCount} عقود متصلة واحتسابها كخدمة واحدة وفق القاعدة المطبقة.`);
    } else if (!ctx.continuousService) {
      push(
        "warning",
        "توجد انقطاعات بين العقود، وقد تؤثر على مدة الخدمة المحتسبة — يلزم مراجعة قانونية.",
      );
    }
  }
  if (ctx.entityTransfer && policy.entity_transfer_counts) {
    push("info", "تم ضم مدة الخدمة السابقة عند انتقال المنشأة وفق القاعدة المطبقة.");
  }

  /* --- الخطوة الثالثة: الأجر المعتمد --- */
  steps.push({
    title: "3) الأجر المعتمد",
    detail:
      policy.wage_rule === "average_wage"
        ? "متوسط الأجر وفق قاعدة الدولة المختارة"
        : "الأجر الأخير الشامل للبدلات الداخلة في الأجر وفق قاعدة الدولة المختارة",
    value: eosbMoney(approvedWage, ctx.currency),
  });

  /* --- الخطوة الرابعة والخامسة: نوع العقد وسبب الإنهاء --- */
  steps.push({
    title: "4) نوع العقد",
    detail: "يُجلب تلقائياً من الخطوة الثانية",
    value: contractTypeLabel(contractType),
  });
  steps.push({
    title: "5) سبب انتهاء العلاقة",
    detail: `يُجلب تلقائياً من الخطوة 11 — ${ctx.terminationLegalRef || policy.legal_basis}`,
    value: ctx.terminationReasonLabel || ctx.terminationReasonCode,
  });

  /* --- الخطوة السادسة والسابعة: القواعد والمكافأة الأساسية --- */
  const yearsAll =
    policy.fraction_rule === "ignore"
      ? duration.years
      : policy.fraction_rule === "full_year"
        ? duration.years + (duration.months > 0 || duration.days > 0 ? 1 : 0)
        : duration.decimalYears;

  const y1 = Math.min(yearsAll, policy.first_years);
  const y2 = Math.max(0, yearsAll - policy.first_years);
  const baseAmount = r2((y1 * policy.first_rate + y2 * policy.after_rate) * approvedWage);

  steps.push({
    title: "6) قواعد الدولة المطبقة",
    detail: `${policy.legal_basis} (سارية من ${policy.effective_from}) • معاملة كسور السنة: ${
      policy.fraction_rule === "prorata"
        ? "بنسبة مدتها"
        : policy.fraction_rule === "full_year"
          ? "تُجبر إلى سنة كاملة"
          : "لا تُحتسب"
    }`,
  });
  steps.push({
    title: "7) المكافأة الأساسية",
    detail: `(${r2(y1)} سنة × ${policy.first_rate} + ${r2(y2)} سنة × ${policy.after_rate}) × ${eosbMoney(approvedWage, ctx.currency)}`,
    value: eosbMoney(baseAmount, ctx.currency),
  });

  /* --- الخطوة الثامنة: أثر سبب الإنهاء --- */
  const effect =
    policy.reason_effects.find((e) => e.match.includes(ctx.terminationReasonCode)) ?? null;
  let rate = 1;
  let rateLabel = "استحقاق كامل";
  let legalRef = ctx.terminationLegalRef || policy.legal_basis;

  if (effect) {
    legalRef = effect.legal_ref || legalRef;
    if (effect.scale?.length) {
      rate = rateFromScale(effect.scale, yearsAll);
      rateLabel = `${effect.label} — ${Math.round(rate * 100)}%`;
    } else {
      rate = typeof effect.rate === "number" ? effect.rate : 1;
      rateLabel = `${effect.label} — ${Math.round(rate * 100)}%`;
    }
  } else if (ctx.terminationEosbEffect === "resignation_scale") {
    const resign = policy.reason_effects.find((e) => e.scale?.length);
    rate = resign?.scale ? rateFromScale(resign.scale, yearsAll) : 1;
    rateLabel = `نسب الاستقالة — ${Math.round(rate * 100)}%`;
  } else if (ctx.terminationEosbEffect === "none") {
    rate = 0;
    rateLabel = "لا استحقاق وفق أثر سبب الإنهاء";
  } else if (ctx.terminationEosbEffect === "review") {
    rate = 1;
    rateLabel = "يحتاج مراجعة قانونية — احتُسب الاستحقاق كاملاً مبدئياً";
    push(
      "warning",
      "أثر سبب انتهاء العلاقة على المكافأة يحتاج مراجعة قانونية، والنسبة المطبقة مبدئية.",
    );
  } else {
    push(
      "warning",
      "لا توجد قاعدة صريحة لأثر سبب الإنهاء في محرك القوانين، وطُبق الاستحقاق الكامل مبدئياً.",
    );
  }

  let finalAmount = r2(baseAmount * rate);
  steps.push({
    title: "8) أثر سبب انتهاء العلاقة",
    detail: `${rateLabel} • ${legalRef}`,
    value: `${eosbMoney(baseAmount, ctx.currency)} × ${rate} = ${eosbMoney(finalAmount, ctx.currency)}`,
  });
  if (rate === 0)
    push("info", "لا تُحتسب مكافأة نهاية خدمة وفق نسبة الاستحقاق المقررة لسبب الإنهاء.");

  /* --- الخطوة العاشرة: الاستثناءات (تُطبق قبل مقارنة السداد) --- */
  const ex = input.exceptions;
  if (ex.hasBetterAgreement && policy.allow_better_agreement) {
    const agreed = typeof ex.agreementAmount === "number" ? ex.agreementAmount : 0;
    if (agreed > finalAmount) {
      steps.push({
        title: "10) اتفاق تعاقدي أفضل",
        detail: "يُعتد بالاتفاق الأفضل للعامل دون الانتقاص من الحد الأدنى النظامي.",
        value: eosbMoney(agreed, ctx.currency),
      });
      finalAmount = r2(agreed);
    } else if (agreed > 0) {
      push(
        "info",
        "قيمة الاتفاق التعاقدي أقل من المستحق النظامي، ولا يجوز الانتقاص من الحد الأدنى النظامي.",
      );
    }
  }
  if (ex.hasSettlement)
    push(
      "warning",
      "توجد مخالصة نهائية مسجلة، وقد تؤثر على المطالبة — يُترك التقييم النهائي للجهة المختصة.",
    );
  if (ex.hasCourtRuling)
    push("warning", "يوجد حكم قضائي مسجل، وتُطبق نتيجته على الاستحقاق بعد مراجعة الجهة المختصة.");

  /* --- الخطوة التاسعة: ما سبق صرفه --- */
  const pay = input.payment;
  const paidAmount =
    pay.paymentStatus === "not_paid"
      ? 0
      : typeof pay.paidAmount === "number"
        ? r2(pay.paidAmount)
        : 0;
  let remaining = r2(Math.max(0, finalAmount - paidAmount));
  let excludedFromClaim = false;

  if (pay.paymentStatus === "paid") {
    if (!pay.proofFile) {
      push(
        "warning",
        "تم تسجيل صرف مكافأة نهاية الخدمة دون مستند مؤيد، وقد يتطلب ذلك مراجعة قانونية.",
      );
      remaining = finalAmount;
    } else if (paidAmount + 0.01 >= finalAmount) {
      excludedFromClaim = true;
      remaining = 0;
      push("info", "تم استبعاد مكافأة نهاية الخدمة من المطالبة لوجود إثبات صرف بقيمة كافية.");
    } else {
      push(
        "warning",
        "قيمة المبلغ المصروف أقل من المستحق، وتم ترحيل الفرق إلى المطالبة النهائية.",
      );
    }
    if (paidAmount > finalAmount + 0.01)
      push("info", "قيمة الصرف تتجاوز المستحق المحتسب، ويُترك تقييم الفرق للجهة المختصة.");
  } else if (pay.paymentStatus === "partial") {
    if (!pay.proofFile)
      push("warning", "تم تسجيل صرف جزئي دون مستند مؤيد، وقد يتطلب ذلك مراجعة قانونية.");
    push("info", `المتبقي = المستحق − المصروف = ${eosbMoney(remaining, ctx.currency)}`);
  }

  steps.push({
    title: "9) ما سبق صرفه",
    detail:
      pay.paymentStatus === "not_paid"
        ? "لم يسبق صرف مكافأة نهاية الخدمة"
        : `${pay.paymentStatus === "paid" ? "صرف كامل" : "صرف جزئي"} بتاريخ ${pay.paymentDate || "—"} — ${
            policy.payment_methods.find((m) => m.code === pay.paymentMethod)?.label ?? "طريقة غير محددة"
          }${pay.proofFile ? " (مع إثبات)" : " (بدون إثبات)"}`,
    value: `المصروف ${eosbMoney(paidAmount, ctx.currency)} • المتبقي ${eosbMoney(remaining, ctx.currency)}`,
  });

  const beneficiaryNote = policy.beneficiary_notes[ctx.terminationReasonCode] ?? null;
  if (beneficiaryNote) push("info", beneficiaryNote);

  return {
    ...base,
    eligible: true,
    ineligibilityReason: null,
    legalRef,
    countedYears: r2(yearsAll),
    baseAmount,
    eligibilityPercentage: rate,
    eligibilityLabel: rateLabel,
    finalAmount,
    paidAmount,
    remainingAmount: remaining,
    excludedFromClaim,
    steps,
    warnings,
    beneficiaryNote,
    handoff: {
      eligible: true,
      service_years: r2(yearsAll),
      approved_wage: approvedWage,
      base_gratuity: baseAmount,
      eligibility_percentage: rate,
      final_gratuity: finalAmount,
      paid_amount: paidAmount,
      remaining_amount: remaining,
      excluded_from_claim: excludedFromClaim,
      legal_rule_version: policy.version,
    },
  };
}

/* ============================ التحقق ============================ */

export function validateEosb(input: EosbInput): string[] {
  const errors: string[] = [];
  const pay = input.payment;
  const ctx = input.context;

  if (pay.paymentStatus !== "not_paid") {
    if (pay.paidAmount === "" || Number(pay.paidAmount) <= 0)
      errors.push("يرجى إدخال قيمة المبلغ المصروف.");
    if (!pay.paymentDate) errors.push("تاريخ الصرف مطلوب عند تسجيل صرف المكافأة.");
    if (!pay.paymentMethod) errors.push("طريقة السداد مطلوبة عند تسجيل صرف المكافأة.");
    if (pay.paymentDate && ctx.serviceStart && pay.paymentDate < ctx.serviceStart)
      errors.push("تاريخ الصرف يسبق تاريخ بداية الخدمة.");
  }
  if (input.exceptions.hasBetterAgreement && input.exceptions.agreementAmount === "")
    errors.push("يرجى إدخال قيمة الاتفاق التعاقدي الأفضل أو إلغاء تحديده.");

  return errors;
}
