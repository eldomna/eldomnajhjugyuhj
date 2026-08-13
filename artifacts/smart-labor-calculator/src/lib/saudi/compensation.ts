// PART 1L — التعويضات (المادة 77، بدل الإشعار، العقود المحددة وغير المحددة)
// محرك مستقل: لا يمس محركات الحساب القائمة، وجميع القواعد تُحمّل من محرك القوانين (sa_regulatory_settings.compensation).

/* ============================ السياسة ============================ */

export type CompOption = { code: string; label: string };

export type CompTypeRule = {
  code: string;
  label: string;
  /** article_77 | article_77_indefinite | remaining_term | notice | agreement | court | manual | none */
  formula: string;
  legal_ref: string;
};

export type CompNoticeRules = {
  indefinite_days: number;
  indefinite_days_monthly_wage: number;
  fixed_days: number;
  part_time_days: number;
  seasonal_days: number;
  trial_days: number;
  legal_ref: string;
};

export type CompArticle77 = {
  indefinite_per_year_wages: number;
  indefinite_min_wages: number;
  fixed_remaining_months: boolean;
  fixed_min_wages: number;
  allow_better_contract_clause: boolean;
  legal_ref: string;
};

export type CompOverlapRule = {
  group: string;
  codes: string[];
  /** exclusive | combinable */
  mode: string;
  priority: string[];
  note: string;
};

export type CompensationPolicy = {
  version: string;
  effective_from: string;
  legal_basis: string;
  wage_rule: string;
  types: CompTypeRule[];
  legal_bases: CompOption[];
  notice_rules: CompNoticeRules;
  article_77: CompArticle77;
  overlap_rules: CompOverlapRule[];
  payment_methods: CompOption[];
  notes: string;
};

const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? (v as unknown[]).map((x) => String(x)).filter(Boolean) : [];
const opts = (v: unknown, d: CompOption[]): CompOption[] =>
  Array.isArray(v)
    ? (v as Record<string, unknown>[])
        .map((o) => ({ code: str(o.code, ""), label: str(o.label, str(o.code, "")) }))
        .filter((o) => o.code)
    : d;

export const DEFAULT_COMPENSATION_POLICY: CompensationPolicy = {
  version: "SA-COMP-default",
  effective_from: "2015-01-01",
  legal_basis: "نظام العمل — أحكام التعويض عن إنهاء العلاقة العمالية",
  wage_rule: "last_wage",
  types: [
    { code: "notice_allowance", label: "بدل الإشعار", formula: "notice", legal_ref: "—" },
    { code: "other", label: "تعويض آخر", formula: "manual", legal_ref: "—" },
  ],
  legal_bases: [
    { code: "statute", label: "نص قانوني محدد" },
    { code: "contract_clause", label: "بند في عقد العمل" },
    { code: "collective_agreement", label: "اتفاقية جماعية" },
    { code: "court_judgment", label: "حكم قضائي" },
    { code: "internal_regulation", label: "لائحة داخلية" },
    { code: "other", label: "سبب آخر" },
  ],
  notice_rules: {
    indefinite_days: 30,
    indefinite_days_monthly_wage: 60,
    fixed_days: 30,
    part_time_days: 30,
    seasonal_days: 15,
    trial_days: 0,
    legal_ref: "—",
  },
  article_77: {
    indefinite_per_year_wages: 15,
    indefinite_min_wages: 2,
    fixed_remaining_months: true,
    fixed_min_wages: 2,
    allow_better_contract_clause: true,
    legal_ref: "—",
  },
  overlap_rules: [],
  payment_methods: [
    { code: "bank_transfer", label: "تحويل بنكي" },
    { code: "cheque", label: "شيك" },
    { code: "cash", label: "نقداً" },
    { code: "settlement", label: "مخالصة" },
    { code: "receipt_voucher", label: "سند قبض" },
    { code: "other", label: "مستند آخر" },
  ],
  notes: "التحليل استرشادي مبني على القواعد المحمّلة ولا يُعد حكماً قضائياً.",
};

export function toCompensationPolicy(value: unknown): CompensationPolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const d = DEFAULT_COMPENSATION_POLICY;

  const types: CompTypeRule[] = Array.isArray(v.types)
    ? (v.types as Record<string, unknown>[])
        .map((t) => ({
          code: str(t.code, ""),
          label: str(t.label, str(t.code, "")),
          formula: str(t.formula, "manual"),
          legal_ref: str(t.legal_ref, "—"),
        }))
        .filter((t) => t.code)
    : [];

  const nr = (v.notice_rules ?? {}) as Record<string, unknown>;
  const a77 = (v.article_77 ?? {}) as Record<string, unknown>;

  const overlaps: CompOverlapRule[] = Array.isArray(v.overlap_rules)
    ? (v.overlap_rules as Record<string, unknown>[]).map((o) => ({
        group: str(o.group, "group"),
        codes: strArr(o.codes),
        mode: str(o.mode, "combinable"),
        priority: strArr(o.priority),
        note: str(o.note, ""),
      }))
    : [];

  return {
    version: str(v.version, d.version),
    effective_from: str(v.effective_from, d.effective_from),
    legal_basis: str(v.legal_basis, d.legal_basis),
    wage_rule: str(v.wage_rule, d.wage_rule),
    types: types.length ? types : d.types,
    legal_bases: opts(v.legal_bases, d.legal_bases),
    notice_rules: {
      indefinite_days: num(nr.indefinite_days, d.notice_rules.indefinite_days),
      indefinite_days_monthly_wage: num(
        nr.indefinite_days_monthly_wage,
        d.notice_rules.indefinite_days_monthly_wage,
      ),
      fixed_days: num(nr.fixed_days, d.notice_rules.fixed_days),
      part_time_days: num(nr.part_time_days, d.notice_rules.part_time_days),
      seasonal_days: num(nr.seasonal_days, d.notice_rules.seasonal_days),
      trial_days: num(nr.trial_days, d.notice_rules.trial_days),
      legal_ref: str(nr.legal_ref, d.notice_rules.legal_ref),
    },
    article_77: {
      indefinite_per_year_wages: num(
        a77.indefinite_per_year_wages,
        d.article_77.indefinite_per_year_wages,
      ),
      indefinite_min_wages: num(a77.indefinite_min_wages, d.article_77.indefinite_min_wages),
      fixed_remaining_months: bool(a77.fixed_remaining_months, d.article_77.fixed_remaining_months),
      fixed_min_wages: num(a77.fixed_min_wages, d.article_77.fixed_min_wages),
      allow_better_contract_clause: bool(
        a77.allow_better_contract_clause,
        d.article_77.allow_better_contract_clause,
      ),
      legal_ref: str(a77.legal_ref, d.article_77.legal_ref),
    },
    overlap_rules: overlaps,
    payment_methods: opts(v.payment_methods, d.payment_methods),
    notes: str(v.notes, d.notes),
  };
}

/* ============================ الإدخال ============================ */

/** سياق يُجلب تلقائياً من الخطوات 2، 3، 4، 11، 12 ولا يُعاد إدخاله */
export type CompensationContext = {
  employmentStatus: string;
  terminationReasonCode: string;
  terminationReasonLabel: string;
  terminationLegalRef: string;
  /** none | notice_only | unlawful_compensation | review */
  compensationEffect: string;
  terminationNoticeRequired: boolean;
  initiatedBy: string;
  terminationDate: string | null;
  noticeGivenFromStep11: boolean;
  noticeDateFromStep11: string | null;
  noticePeriodDaysFromStep11: number | null;
  contractType: string;
  contractEndDate: string | null;
  endedDuringTrial: boolean;
  protectedLeave: boolean;
  serviceStart: string | null;
  serviceEnd: string | null;
  serviceYears: number;
  approvedWage: number;
  hasCourtRulingFromStep12: boolean;
  documentsCount: number;
  currency: string;
};

export type CompensationClaimInput = {
  id?: string;
  compensationType: string;
  legalBasis: string;
  legalReference: string;
  /** yes | no | partial */
  noticeStatus: string;
  noticeDate: string;
  noticePeriodDays: number | "";
  hasAgreementClause: boolean;
  agreementAmount: number | "";
  agreementMethod: string;
  agreementProof: string;
  manualAmount: number | "";
  courtJudgmentReference: string;
  /** not_paid | paid | partial */
  paymentStatus: string;
  paidAmount: number | "";
  paymentDate: string;
  paymentMethod: string;
  proofFile: string;
  notes: string;
};

export const emptyCompensationClaim = (type = ""): CompensationClaimInput => ({
  compensationType: type,
  legalBasis: "statute",
  legalReference: "",
  noticeStatus: "no",
  noticeDate: "",
  noticePeriodDays: "",
  hasAgreementClause: false,
  agreementAmount: "",
  agreementMethod: "",
  agreementProof: "",
  manualAmount: "",
  courtJudgmentReference: "",
  paymentStatus: "not_paid",
  paidAmount: "",
  paymentDate: "",
  paymentMethod: "",
  proofFile: "",
  notes: "",
});

/* ============================ أدوات ============================ */

const D = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const r2 = (v: number) => Math.round(v * 100) / 100;

export const compMoney = (v: number, currency = "SAR") =>
  `${(Number.isFinite(v) ? v : 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

export const daysBetweenDates = (a?: string | null, b?: string | null): number | null => {
  const x = D(a);
  const y = D(b);
  if (!x || !y) return null;
  return Math.round((y.getTime() - x.getTime()) / 86400000);
};

export const monthsBetweenDates = (a?: string | null, b?: string | null): number | null => {
  const days = daysBetweenDates(a, b);
  return days == null ? null : r2(days / 30.4375);
};

const CONTRACT_LABELS: Record<string, string> = {
  fixed: "محدد المدة",
  fixed_term: "محدد المدة",
  indefinite: "غير محدد المدة",
  seasonal: "موسمي",
  part_time: "جزئي",
  special: "عقد خاص",
  other: "عقد آخر",
};
export const compContractLabel = (code: string) => CONTRACT_LABELS[code] ?? code ?? "—";

const isFixed = (t: string) => t === "fixed" || t === "fixed_term";

export function statutoryNoticeDays(
  policy: CompensationPolicy,
  contractType: string,
  ctx: CompensationContext,
): number {
  const nr = policy.notice_rules;
  if (ctx.endedDuringTrial) return nr.trial_days;
  if (contractType === "seasonal") return nr.seasonal_days;
  if (contractType === "part_time") return nr.part_time_days;
  if (isFixed(contractType)) return nr.fixed_days;
  return nr.indefinite_days;
}

/* ============================ التحليل ============================ */

export type CompStep = { title: string; detail: string; value?: string };
export type CompWarning = { level: "error" | "warning" | "info"; message: string };

export type CompensationClaimAnalysis = {
  typeCode: string;
  typeLabel: string;
  formula: string;
  legalBasisLabel: string;
  legalReference: string;
  contractType: string;
  noticeRequired: boolean;
  statutoryNoticeDays: number;
  noticeActualDays: number | null;
  noticeShortfallDays: number | null;
  noticeCompensation: number;
  remainingContractMonths: number | null;
  baseCompensation: number;
  finalCompensation: number;
  paidAmount: number;
  remainingAmount: number;
  excludedFromClaim: boolean;
  agreementConflictsLaw: boolean;
  steps: CompStep[];
  warnings: CompWarning[];
  legalRuleVersion: string;
};

export function analyzeCompensationClaim(
  claim: CompensationClaimInput,
  ctx: CompensationContext,
  policy: CompensationPolicy = DEFAULT_COMPENSATION_POLICY,
): CompensationClaimAnalysis {
  const steps: CompStep[] = [];
  const warnings: CompWarning[] = [];
  const push = (level: CompWarning["level"], message: string) =>
    warnings.push({ level, message });

  const rule =
    policy.types.find((t) => t.code === claim.compensationType) ??
    ({ code: claim.compensationType, label: claim.compensationType, formula: "manual", legal_ref: "—" } as CompTypeRule);

  const basisLabel =
    policy.legal_bases.find((b) => b.code === claim.legalBasis)?.label ?? claim.legalBasis;
  const contractType = ctx.contractType || "indefinite";
  const wage = ctx.approvedWage;
  const cur = ctx.currency;

  /* --- الخطوة الثالثة: الأساس القانوني --- */
  steps.push({
    title: "1) نوع التعويض والأساس القانوني",
    detail: `${basisLabel} • ${claim.legalReference || rule.legal_ref || policy.legal_basis}`,
    value: rule.label,
  });

  /* --- الخطوة الرابعة والخامسة: البيانات المجلوبة تلقائياً --- */
  steps.push({
    title: "2) بيانات الإنهاء المجلوبة تلقائياً",
    detail: `سبب الإنهاء: ${ctx.terminationReasonLabel || "—"} • جهة الإنهاء: ${ctx.initiatedBy || "—"} • تاريخ الإنهاء: ${ctx.terminationDate ?? "—"} • مدة الخدمة: ${r2(ctx.serviceYears)} سنة`,
    value: `${compContractLabel(contractType)} — الأجر ${compMoney(wage, cur)}`,
  });

  if (wage <= 0)
    push("error", "لم يتم إدخال الأجر في الخطوة الرابعة، ولا يمكن احتساب التعويض بدونه.");
  if (ctx.employmentStatus !== "terminated")
    push(
      "warning",
      "العلاقة العمالية غير منتهية وفق الخطوة 11، وتعويضات الإنهاء لا تُستحق إلا بانتهاء العلاقة.",
    );
  if (ctx.compensationEffect === "none" && rule.formula !== "notice")
    push(
      "warning",
      "سبب الإنهاء المسجل في الخطوة 11 لا يرتب تعويضاً عن الإنهاء وفق القواعد المحمّلة — يلزم مراجعة قانونية قبل الاعتماد.",
    );
  if (ctx.compensationEffect === "review")
    push("warning", "أثر سبب الإنهاء على التعويض يحتاج مراجعة قانونية، والنتيجة مبدئية.");
  if (ctx.endedDuringTrial && rule.formula !== "none" && rule.formula !== "notice")
    push(
      "warning",
      "الإنهاء وقع أثناء فترة التجربة، وتُطبق القواعد الخاصة بها والتي قد تُسقط التعويض.",
    );
  if (ctx.protectedLeave)
    push(
      "info",
      "الحالة مرتبطة بالحمل أو الإجازات المحمية (الخطوة 9)، وتُطبق أحكام الحماية النظامية على التعويض.",
    );

  /* --- الخطوة السادسة: بدل الإشعار --- */
  const stdNotice = statutoryNoticeDays(policy, contractType, ctx);
  const noticeRequired = ctx.terminationNoticeRequired || rule.formula === "notice";
  const noticeStatus = claim.noticeStatus;
  const noticeDate = claim.noticeDate || ctx.noticeDateFromStep11 || "";
  const enteredPeriod =
    claim.noticePeriodDays === ""
      ? (ctx.noticePeriodDaysFromStep11 ?? null)
      : Number(claim.noticePeriodDays);
  const actualDays =
    noticeStatus === "no" ? 0 : daysBetweenDates(noticeDate, ctx.terminationDate ?? undefined);
  let shortfall: number | null = null;
  let noticeCompensation = 0;

  if (noticeRequired) {
    if (noticeStatus === "yes") {
      const served = actualDays ?? enteredPeriod ?? 0;
      shortfall = Math.max(0, stdNotice - served);
      if (shortfall > 0)
        push(
          "warning",
          `مدة الإشعار الفعلية (${served} يوماً) أقل من المدة النظامية (${stdNotice} يوماً)، ويُستحق بدل عن ${shortfall} يوماً.`,
        );
    } else if (noticeStatus === "partial") {
      const served = actualDays ?? enteredPeriod ?? 0;
      shortfall = Math.max(0, stdNotice - served);
      push("info", "تم تسجيل إشعار جزئي، ويُحتسب البدل عن المدة الناقصة فقط.");
    } else {
      shortfall = stdNotice;
      push("info", "لم يُوجَّه إشعار نظامي، ويُحتسب بدل الإشعار كاملاً وفق قواعد الدولة المختارة.");
    }
    noticeCompensation = r2((wage / 30) * (shortfall ?? 0));
    steps.push({
      title: "3) بدل الإشعار",
      detail: `المدة النظامية ${stdNotice} يوماً (${policy.notice_rules.legal_ref}) • المدة المخدومة ${actualDays ?? enteredPeriod ?? 0} يوماً • الأجر اليومي ${compMoney(wage / 30, cur)}`,
      value: `${shortfall ?? 0} يوماً × ${compMoney(wage / 30, cur)} = ${compMoney(noticeCompensation, cur)}`,
    });
  } else {
    steps.push({
      title: "3) بدل الإشعار",
      detail: "سبب الإنهاء المسجل لا يوجب الإشعار وفق القواعد المحمّلة.",
      value: "غير مستحق",
    });
  }

  /* --- الخطوات 7 إلى 9: التعويض الأساسي حسب الصيغة ونوع العقد --- */
  let base = 0;
  let remainingMonths: number | null = null;

  if (rule.formula === "notice") {
    base = noticeCompensation;
    steps.push({
      title: "4) التعويض الأساسي",
      detail: "مطالبة مقصورة على بدل الإشعار.",
      value: compMoney(base, cur),
    });
  } else if (rule.formula === "remaining_term" || (rule.formula === "article_77" && isFixed(contractType))) {
    remainingMonths = monthsBetweenDates(ctx.terminationDate, ctx.contractEndDate);
    const months = Math.max(0, remainingMonths ?? 0);
    const minAmount = r2(policy.article_77.fixed_min_wages * wage);
    const raw = r2(months * wage);
    base = Math.max(raw, minAmount);
    steps.push({
      title: "4) تعويض العقد محدد المدة",
      detail: `المدة المتبقية من العقد ${r2(months)} شهراً حتى ${ctx.contractEndDate ?? "—"} • الحد الأدنى ${policy.article_77.fixed_min_wages} أجر شهري (${policy.article_77.legal_ref})`,
      value: `${compMoney(raw, cur)} → المطبق ${compMoney(base, cur)}`,
    });
    if (!ctx.contractEndDate)
      push(
        "warning",
        "لا يوجد تاريخ نهاية للعقد في الخطوة الثانية، وتعذّر احتساب المدة المتبقية بدقة.",
      );
    if (base === minAmount && raw < minAmount)
      push("info", "طُبق الحد الأدنى النظامي للتعويض لأن المدة المتبقية أقل منه.");
  } else if (rule.formula === "article_77" || rule.formula === "article_77_indefinite") {
    const perYear = policy.article_77.indefinite_per_year_wages; // بالأيام
    const years = Math.max(0, ctx.serviceYears);
    const raw = r2((wage / 30) * perYear * years);
    const minAmount = r2(policy.article_77.indefinite_min_wages * wage);
    base = Math.max(raw, minAmount);
    steps.push({
      title: "4) تعويض العقد غير محدد المدة",
      detail: `${perYear} يوماً عن كل سنة خدمة × ${r2(years)} سنة × أجر يومي ${compMoney(wage / 30, cur)} • الحد الأدنى ${policy.article_77.indefinite_min_wages} أجر شهري (${policy.article_77.legal_ref})`,
      value: `${compMoney(raw, cur)} → المطبق ${compMoney(base, cur)}`,
    });
    if (base === minAmount && raw < minAmount)
      push("info", "طُبق الحد الأدنى النظامي للتعويض لأن الناتج المحتسب أقل منه.");
  } else if (rule.formula === "agreement") {
    base = claim.agreementAmount === "" ? 0 : r2(Number(claim.agreementAmount));
    steps.push({
      title: "4) التعويض الاتفاقي",
      detail: `طريقة الاحتساب: ${claim.agreementMethod || "—"}${claim.agreementProof ? " (مع مستند مؤيد)" : " (بدون مستند مؤيد)"}`,
      value: compMoney(base, cur),
    });
  } else if (rule.formula === "court") {
    base = claim.manualAmount === "" ? 0 : r2(Number(claim.manualAmount));
    steps.push({
      title: "4) التعويض بحكم قضائي",
      detail: `مرجع الحكم: ${claim.courtJudgmentReference || "—"} — لا يُعدّل النظام قيمة الحكم القضائي.`,
      value: compMoney(base, cur),
    });
    if (!claim.courtJudgmentReference)
      push("warning", "لم يتم تسجيل مرجع الحكم القضائي المستند إليه في المطالبة.");
  } else if (rule.formula === "none") {
    base = 0;
    steps.push({
      title: "4) التعويض الأساسي",
      detail: "القواعد المحمّلة لا ترتب تعويضاً لهذه الحالة.",
      value: compMoney(0, cur),
    });
  } else {
    base = claim.manualAmount === "" ? 0 : r2(Number(claim.manualAmount));
    steps.push({
      title: "4) التعويض الأساسي (إدخال يدوي)",
      detail: "نوع تعويض بدون معادلة محمّلة، ويُدخل يدوياً ويحتاج مراجعة قانونية.",
      value: compMoney(base, cur),
    });
    push("warning", "لا توجد معادلة محمّلة لهذا النوع من التعويض في محرك القوانين.");
  }

  /* --- الخطوة العاشرة: التعويض الاتفاقي والمقارنة بالحد الأدنى --- */
  let finalAmount = base;
  let agreementConflictsLaw = false;

  if (claim.hasAgreementClause && rule.formula !== "agreement") {
    const agreed = claim.agreementAmount === "" ? 0 : r2(Number(claim.agreementAmount));
    if (agreed > base && policy.article_77.allow_better_contract_clause) {
      finalAmount = agreed;
      steps.push({
        title: "5) بند تعويض تعاقدي أفضل",
        detail: "يُعتد بالشرط الأفضل للعامل إذا كان جائزاً قانوناً.",
        value: compMoney(agreed, cur),
      });
    } else if (agreed > 0 && agreed < base) {
      agreementConflictsLaw = true;
      push(
        "warning",
        "البند التعاقدي يمنح العامل أقل من الحد الأدنى النظامي، ولم يُطبَّق تلقائياً.",
      );
    }
    if (!claim.agreementProof)
      push("warning", "لم يُرفع المستند المؤيد للبند التعاقدي المطالب به.");
  }

  if (rule.formula !== "notice" && noticeRequired && noticeCompensation > 0) {
    finalAmount = r2(finalAmount + noticeCompensation);
    steps.push({
      title: "6) الجمع مع بدل الإشعار",
      detail: "يجوز الجمع بين تعويض الإنهاء وبدل الإشعار وفق قواعد الجمع المحمّلة.",
      value: `${compMoney(finalAmount - noticeCompensation, cur)} + ${compMoney(noticeCompensation, cur)} = ${compMoney(finalAmount, cur)}`,
    });
  }
  finalAmount = r2(finalAmount);

  /* --- الخطوة الحادية عشرة: ما سبق صرفه --- */
  const paid =
    claim.paymentStatus === "not_paid"
      ? 0
      : claim.paidAmount === ""
        ? 0
        : r2(Number(claim.paidAmount));
  let remaining = r2(Math.max(0, finalAmount - paid));
  let excluded = false;

  if (claim.paymentStatus === "paid") {
    if (!claim.proofFile) {
      push(
        "warning",
        "تم تسجيل صرف تعويض دون وجود مستند مؤيد، وقد يتطلب ذلك مراجعة قانونية.",
      );
      remaining = finalAmount;
    } else if (paid + 0.01 >= finalAmount) {
      excluded = true;
      remaining = 0;
      push("info", "تم استبعاد هذا التعويض من المطالبة لوجود إثبات صرف بقيمة كافية.");
    } else {
      push("warning", "قيمة المبلغ المصروف أقل من المستحق، وتم ترحيل الفرق إلى المطالبة النهائية.");
    }
  } else if (claim.paymentStatus === "partial") {
    if (!claim.proofFile)
      push("warning", "تم تسجيل صرف جزئي دون مستند مؤيد، وقد يتطلب ذلك مراجعة قانونية.");
    push("info", `المتبقي = المستحق − المصروف = ${compMoney(remaining, cur)}`);
  }

  steps.push({
    title: "7) ما سبق صرفه",
    detail:
      claim.paymentStatus === "not_paid"
        ? "لم يسبق صرف هذا التعويض"
        : `${claim.paymentStatus === "paid" ? "صرف كامل" : "صرف جزئي"} بتاريخ ${claim.paymentDate || "—"} — ${
            policy.payment_methods.find((m) => m.code === claim.paymentMethod)?.label ??
            "طريقة غير محددة"
          }${claim.proofFile ? " (مع إثبات)" : " (بدون إثبات)"}`,
    value: `المصروف ${compMoney(paid, cur)} • المتبقي ${compMoney(remaining, cur)}`,
  });

  if (ctx.hasCourtRulingFromStep12 && rule.formula !== "court")
    push(
      "info",
      "يوجد حكم قضائي مسجل في الخطوة 12، ويمكن استخدامه للمقارنة مع التعويض المحتسب.",
    );

  return {
    typeCode: rule.code,
    typeLabel: rule.label,
    formula: rule.formula,
    legalBasisLabel: basisLabel,
    legalReference: claim.legalReference || rule.legal_ref || policy.legal_basis,
    contractType,
    noticeRequired,
    statutoryNoticeDays: stdNotice,
    noticeActualDays: actualDays,
    noticeShortfallDays: shortfall,
    noticeCompensation,
    remainingContractMonths: remainingMonths,
    baseCompensation: base,
    finalCompensation: finalAmount,
    paidAmount: paid,
    remainingAmount: remaining,
    excludedFromClaim: excluded,
    agreementConflictsLaw,
    steps,
    warnings,
    legalRuleVersion: policy.version,
  };
}

/* ============================ تحليل المجموعة والتداخل ============================ */

export type CompensationSetAnalysis = {
  claims: CompensationClaimAnalysis[];
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  suppressedTypes: string[];
  warnings: CompWarning[];
  handoff: Record<string, unknown>;
};

export function analyzeCompensationSet(
  claims: CompensationClaimInput[],
  ctx: CompensationContext,
  policy: CompensationPolicy = DEFAULT_COMPENSATION_POLICY,
): CompensationSetAnalysis {
  const warnings: CompWarning[] = [];
  const analyses = claims.map((c) => analyzeCompensationClaim(c, ctx, policy));
  const suppressed: string[] = [];

  // منع التكرار: نفس نوع التعويض مرتين
  const seen = new Map<string, number>();
  analyses.forEach((a) => seen.set(a.typeCode, (seen.get(a.typeCode) ?? 0) + 1));
  for (const [code, count] of seen) {
    if (count > 1) {
      warnings.push({
        level: "error",
        message: `تم تسجيل التعويض «${analyses.find((a) => a.typeCode === code)?.typeLabel ?? code}» أكثر من مرة، ولا يجوز احتساب التعويض ذاته مرتين.`,
      });
    }
  }

  // قواعد التداخل والأولوية من محرك القوانين
  for (const rule of policy.overlap_rules) {
    if (rule.mode !== "exclusive") continue;
    const present = analyses.filter((a) => rule.codes.includes(a.typeCode));
    if (present.length <= 1) continue;
    const order = rule.priority.length ? rule.priority : rule.codes;
    const winner =
      present
        .slice()
        .sort((a, b) => {
          const ia = order.indexOf(a.typeCode);
          const ib = order.indexOf(b.typeCode);
          const na = ia === -1 ? 999 : ia;
          const nb = ib === -1 ? 999 : ib;
          if (na !== nb) return na - nb;
          return b.finalCompensation - a.finalCompensation;
        })[0] ?? present[0];
    present.forEach((a) => {
      if (a !== winner) suppressed.push(a.typeCode);
    });
    warnings.push({
      level: "warning",
      message: `${rule.note || "لا يجوز الجمع بين هذه التعويضات."} تم اعتماد «${winner.typeLabel}» واستبعاد: ${present
        .filter((a) => a !== winner)
        .map((a) => a.typeLabel)
        .join("، ")}.`,
    });
  }

  const counted = analyses.filter((a) => !suppressed.includes(a.typeCode));
  const totalDue = r2(counted.reduce((s, a) => s + a.finalCompensation, 0));
  const totalPaid = r2(counted.reduce((s, a) => s + a.paidAmount, 0));
  const totalRemaining = r2(counted.reduce((s, a) => s + a.remainingAmount, 0));

  if (!claims.length)
    warnings.push({ level: "info", message: "لم تُضف أي مطالبة تعويض بعد." });

  return {
    claims: analyses,
    totalDue,
    totalPaid,
    totalRemaining,
    suppressedTypes: suppressed,
    warnings,
    handoff: {
      total_due: totalDue,
      total_paid: totalPaid,
      total_remaining: totalRemaining,
      suppressed_types: suppressed,
      legal_rule_version: policy.version,
      claims: counted.map((a) => ({
        type: a.typeCode,
        label: a.typeLabel,
        legal_reference: a.legalReference,
        notice_compensation: a.noticeCompensation,
        base: a.baseCompensation,
        final: a.finalCompensation,
        paid: a.paidAmount,
        remaining: a.remainingAmount,
        excluded: a.excludedFromClaim,
      })),
    },
  };
}

/* ============================ التحقق ============================ */

export function validateCompensationClaim(
  claim: CompensationClaimInput,
  ctx: CompensationContext,
  policy: CompensationPolicy = DEFAULT_COMPENSATION_POLICY,
): string[] {
  const errors: string[] = [];
  const rule = policy.types.find((t) => t.code === claim.compensationType);

  if (!claim.compensationType) errors.push("يرجى تحديد نوع التعويض.");
  if (!claim.legalBasis) errors.push("يرجى تحديد الأساس القانوني للمطالبة.");

  if (claim.noticeStatus !== "no" && !claim.noticeDate && !ctx.noticeDateFromStep11)
    errors.push("تاريخ الإشعار مطلوب عند تسجيل وجود إشعار.");
  if (
    claim.noticeDate &&
    ctx.terminationDate &&
    claim.noticeDate > ctx.terminationDate
  )
    errors.push("تاريخ الإشعار لا يمكن أن يكون بعد تاريخ الإنهاء.");

  if (rule?.formula === "agreement" && (claim.agreementAmount === "" || Number(claim.agreementAmount) <= 0))
    errors.push("يرجى إدخال قيمة التعويض الاتفاقي.");
  if (claim.hasAgreementClause && claim.agreementAmount === "")
    errors.push("يرجى إدخال قيمة البند التعاقدي أو إلغاء تحديده.");
  if (rule?.formula === "court" && !claim.courtJudgmentReference)
    errors.push("مرجع الحكم القضائي مطلوب للتعويض المبني على حكم.");
  if ((rule?.formula === "manual" || rule?.formula === "court") && claim.manualAmount === "")
    errors.push("يرجى إدخال قيمة التعويض المطالب به.");

  if (claim.paymentStatus !== "not_paid") {
    if (claim.paidAmount === "" || Number(claim.paidAmount) <= 0)
      errors.push("يرجى إدخال قيمة المبلغ المصروف.");
    if (!claim.paymentDate) errors.push("تاريخ الصرف مطلوب عند تسجيل صرف التعويض.");
    if (!claim.paymentMethod) errors.push("طريقة السداد مطلوبة عند تسجيل صرف التعويض.");
    if (claim.paymentDate && ctx.serviceStart && claim.paymentDate < ctx.serviceStart)
      errors.push("تاريخ الصرف يسبق تاريخ بداية الخدمة.");
  }

  return errors;
}
