// PART 1M — المخالصة النهائية والحقوق المسددة
// محرك مستقل: لا يمس محركات الحساب القائمة، وجميع القواعد تُحمّل من محرك القوانين
// (sa_regulatory_settings.final_settlement).

/* ============================ السياسة ============================ */

export type SettleOption = { code: string; label: string };

export type SettleRightType = {
  code: string;
  label: string;
  module: string;
  waivable: boolean;
  legal_ref: string;
};

export type SettleEffectRule = {
  code: string;
  label: string;
  /** info | warning | critical */
  severity: string;
};

export type FinalSettlementPolicy = {
  version: string;
  effective_from: string;
  legal_basis: string;
  settlement_types: SettleOption[];
  signature_statuses: SettleOption[];
  languages: SettleOption[];
  payment_methods: SettleOption[];
  right_types: SettleRightType[];
  non_waivable_note: string;
  settlement_effect_rules: SettleEffectRule[];
  match_statuses: SettleOption[];
  tolerance_amount: number;
  notes: string;
};

const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const opts = (v: unknown, d: SettleOption[]): SettleOption[] =>
  Array.isArray(v)
    ? (v as Record<string, unknown>[])
        .map((o) => ({ code: str(o.code, ""), label: str(o.label, str(o.code, "")) }))
        .filter((o) => o.code)
    : d;

export const DEFAULT_FINAL_SETTLEMENT_POLICY: FinalSettlementPolicy = {
  version: "SA-SETTLE-default",
  effective_from: "2015-01-01",
  legal_basis: "نظام العمل — أحكام الوفاء بالحقوق العمالية والمخالصات",
  settlement_types: [
    { code: "final_release", label: "مخالصة نهائية" },
    { code: "amicable_settlement", label: "تسوية ودية" },
    { code: "termination_agreement", label: "اتفاق إنهاء" },
    { code: "receipt_acknowledgement", label: "إقرار استلام مستحقات" },
    { code: "other", label: "مستند آخر" },
  ],
  signature_statuses: [
    { code: "signed", label: "نعم — موقعة" },
    { code: "not_signed", label: "لا" },
    { code: "digital", label: "توقيع إلكتروني" },
    { code: "unclear", label: "غير واضح" },
  ],
  languages: [
    { code: "ar", label: "العربية" },
    { code: "en", label: "الإنجليزية" },
    { code: "bilingual", label: "ثنائية اللغة" },
    { code: "other", label: "لغة أخرى" },
  ],
  payment_methods: [
    { code: "bank_transfer", label: "تحويل بنكي" },
    { code: "cheque", label: "شيك" },
    { code: "cash", label: "نقداً" },
    { code: "receipt_voucher", label: "سند قبض" },
    { code: "remittance", label: "حوالة" },
    { code: "settlement", label: "مخالصة" },
    { code: "wps", label: "منصة حماية الأجور" },
    { code: "other", label: "مستند آخر" },
  ],
  right_types: [
    {
      code: "other",
      label: "حقوق مالية أخرى",
      module: "manual",
      waivable: true,
      legal_ref: "—",
    },
  ],
  non_waivable_note:
    "الحقوق المقررة بنص آمر لا يسقطها مجرد التوقيع على المخالصة ما لم يثبت الوفاء الفعلي بها.",
  settlement_effect_rules: [],
  match_statuses: [
    { code: "matched", label: "مطابق" },
    { code: "difference", label: "يوجد فرق" },
    { code: "no_proof", label: "لا يوجد إثبات" },
    { code: "needs_review", label: "يحتاج مراجعة" },
  ],
  tolerance_amount: 1,
  notes: "التحليل استرشادي ولا يُعد حكماً بصحة أو بطلان المخالصة.",
};

export function toFinalSettlementPolicy(value: unknown): FinalSettlementPolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const d = DEFAULT_FINAL_SETTLEMENT_POLICY;

  const rights: SettleRightType[] = Array.isArray(v.right_types)
    ? (v.right_types as Record<string, unknown>[])
        .map((r) => ({
          code: str(r.code, ""),
          label: str(r.label, str(r.code, "")),
          module: str(r.module, "manual"),
          waivable: bool(r.waivable, true),
          legal_ref: str(r.legal_ref, "—"),
        }))
        .filter((r) => r.code)
    : d.right_types;

  const effects: SettleEffectRule[] = Array.isArray(v.settlement_effect_rules)
    ? (v.settlement_effect_rules as Record<string, unknown>[])
        .map((r) => ({
          code: str(r.code, ""),
          label: str(r.label, str(r.code, "")),
          severity: str(r.severity, "info"),
        }))
        .filter((r) => r.code)
    : d.settlement_effect_rules;

  return {
    version: str(v.version, d.version),
    effective_from: str(v.effective_from, d.effective_from),
    legal_basis: str(v.legal_basis, d.legal_basis),
    settlement_types: opts(v.settlement_types, d.settlement_types),
    signature_statuses: opts(v.signature_statuses, d.signature_statuses),
    languages: opts(v.languages, d.languages),
    payment_methods: opts(v.payment_methods, d.payment_methods),
    right_types: rights.length ? rights : d.right_types,
    non_waivable_note: str(v.non_waivable_note, d.non_waivable_note),
    settlement_effect_rules: effects,
    match_statuses: opts(v.match_statuses, d.match_statuses),
    tolerance_amount: num(v.tolerance_amount, d.tolerance_amount),
    notes: str(v.notes, d.notes),
  };
}

/* ============================ المدخلات ============================ */

export type SettlementInput = {
  id?: string;
  hasSettlement: "yes" | "no" | "unknown";
  settlementNumber: string;
  settlementType: string;
  settlementDate: string;
  signingDate: string;
  signingPlace: string;
  settlementLanguage: string;
  signatureStatus: string;
  digitalSignatureType: string;
  digitalSignatureProvider: string;
  digitalSignatureReference: string;
  digitalSignatureDate: string;
  settlementFile: string;
  settlementFileType: string;
  totalSettlementAmount: number | "";
  coversAllRights: boolean;
  underDispute: boolean;
  courtRulingAfter: boolean;
  courtRulingReference: string;
  /** أكواد الحقوق المذكورة في المخالصة */
  mentionedRights: string[];
  /** أكواد الحقوق المتنازل عنها بنص المخالصة */
  waivedRights: string[];
  aiAnalysisStatus: string;
  aiAnalysis: SettlementAiResult | null;
  notes: string;
};

export type PaymentInput = {
  id?: string;
  settlementRowId: string | null;
  rightType: string;
  amountPaid: number | "";
  paymentDate: string;
  paymentMethod: string;
  proofFile: string;
  currency: string;
  exchangeRate: number | "";
  notes: string;
};

export type SettlementAiResult = {
  mentionedRights: string[];
  amounts: { label: string; amount: number }[];
  waivedRights: string[];
  paidRights: string[];
  specialClauses: string[];
  exceptions: string[];
  reviewFlags: string[];
  summary: string;
};

export const emptySettlement = (): SettlementInput => ({
  hasSettlement: "yes",
  settlementNumber: "",
  settlementType: "final_release",
  settlementDate: "",
  signingDate: "",
  signingPlace: "",
  settlementLanguage: "ar",
  signatureStatus: "signed",
  digitalSignatureType: "",
  digitalSignatureProvider: "",
  digitalSignatureReference: "",
  digitalSignatureDate: "",
  settlementFile: "",
  settlementFileType: "",
  totalSettlementAmount: "",
  coversAllRights: false,
  underDispute: false,
  courtRulingAfter: false,
  courtRulingReference: "",
  mentionedRights: [],
  waivedRights: [],
  aiAnalysisStatus: "not_run",
  aiAnalysis: null,
  notes: "",
});

export const emptyPayment = (rightType = "other", currency = "SAR"): PaymentInput => ({
  settlementRowId: null,
  rightType,
  amountPaid: "",
  paymentDate: "",
  paymentMethod: "bank_transfer",
  proofFile: "",
  currency,
  exchangeRate: "",
  notes: "",
});

/* ============================ الحقوق المحتسبة ============================ */

export type ComputedRight = {
  code: string;
  label: string;
  module: string;
  legalRef: string;
  waivable: boolean;
  /** المستحق المحتسب من الخطوات السابقة */
  due: number;
  /** ما سُجل مسدداً داخل الخطوة المصدر */
  paidInModule: number;
  currency: string;
  /** هل يوجد إثبات سداد داخل الخطوة المصدر */
  hasModuleProof: boolean;
};

const sum = (rows: unknown[], f: (r: any) => unknown) =>
  (rows ?? []).reduce((t: number, r) => t + (Number(f(r)) || 0), 0);

export type CaseRightsSources = {
  unpaidSalaries: any[];
  overtime: any[];
  holidayWork: any[];
  leaveSettlement: any | null;
  sickLeave: any | null;
  maternity: any | null;
  eosb: any | null;
  compensation: any[];
  socialInsurance: any | null;
};

/** يجلب جميع الحقوق المحتسبة من الخطوات السابقة ويوحّدها في جدول واحد. */
export function buildComputedRights(
  src: CaseRightsSources,
  policy: FinalSettlementPolicy,
  currency = "SAR",
): ComputedRight[] {
  const meta = (code: string) =>
    policy.right_types.find((r) => r.code === code) ?? {
      code,
      label: code,
      module: "manual",
      waivable: true,
      legal_ref: "—",
    };

  const mk = (
    code: string,
    due: number,
    paid: number,
    hasProof: boolean,
    cur = currency,
  ): ComputedRight => {
    const m = meta(code);
    return {
      code,
      label: m.label,
      module: m.module,
      legalRef: m.legal_ref,
      waivable: m.waivable,
      due: round2(due),
      paidInModule: round2(paid),
      currency: cur,
      hasModuleProof: hasProof,
    };
  };

  const out: ComputedRight[] = [];

  // الرواتب والمبالغ غير المسددة
  const us = src.unpaidSalaries ?? [];
  if (us.length) {
    out.push(
      mk(
        "unpaid_salaries",
        sum(us, (r) => r.amount),
        sum(us, (r) => r.paid_amount),
        us.some((r: any) => !!r.proof_file),
        String(us[0]?.currency ?? currency),
      ),
    );
  }

  // العمل الإضافي والعمل في الإجازات
  const otTotal =
    sum(src.overtime ?? [], (r) => r.amount) + sum(src.holidayWork ?? [], (r) => r.amount);
  if (otTotal > 0) out.push(mk("overtime", otTotal, 0, false));

  // تعويض رصيد الإجازات
  const ls = src.leaveSettlement;
  if (ls) {
    out.push(
      mk(
        "annual_leave",
        Number(ls.compensation_amount ?? 0),
        Number(ls.paid_amount ?? 0),
        !!ls.proof_file,
        String(ls.currency ?? currency),
      ),
    );
  }

  // الإجازة المرضية
  const sl = src.sickLeave;
  if (sl) {
    out.push(
      mk(
        "sick_leave",
        Number(sl.total_due ?? 0),
        Number(sl.total_paid ?? 0),
        false,
        String(sl.currency ?? currency),
      ),
    );
  }

  // الأمومة وساعة الرضاعة
  const mt = src.maternity;
  if (mt) {
    out.push(
      mk(
        "maternity",
        Number(mt.total_due ?? 0),
        Number(mt.total_paid ?? 0),
        !!mt.medical_report_file,
        String(mt.currency ?? currency),
      ),
    );
  }

  // مكافأة نهاية الخدمة
  const eo = src.eosb;
  if (eo) {
    out.push(
      mk(
        "eosb",
        Number(eo.final_gratuity_amount ?? 0),
        Number(eo.paid_amount ?? 0),
        !!eo.proof_file,
      ),
    );
  }

  // التعويضات وبدل الإشعار
  const comp = (src.compensation ?? []).filter((c: any) => !c.excluded_from_claim);
  if (comp.length) {
    out.push(
      mk(
        "compensation",
        sum(comp, (r) => r.final_compensation),
        sum(comp, (r) => r.paid_amount),
        comp.some((c: any) => !!c.proof_file),
      ),
    );
  }

  // فروق التأمينات الاجتماعية
  const si = src.socialInsurance;
  if (si && Number(si.total_difference ?? 0) > 0) {
    out.push(
      mk(
        "social_insurance",
        Number(si.total_difference ?? 0),
        Number(si.total_paid ?? 0),
        !!si.payment_proof_file,
        String(si.currency ?? currency),
      ),
    );
  }

  return out.filter((r) => r.due > 0 || r.paidInModule > 0);
}

/* ============================ التحليل ============================ */

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function settleMoney(n: number, currency = "SAR") {
  return `${round2(n).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export type RightMatchRow = {
  code: string;
  label: string;
  module: string;
  legalRef: string;
  waivable: boolean;
  currency: string;
  /** المستحق المحتسب */
  due: number;
  /** المسدد المسجل في الخطوة المصدر */
  paidInModule: number;
  /** المسدد ضمن دفعات المخالصة */
  paidInSettlement: number;
  /** إجمالي المسدد */
  totalPaid: number;
  remaining: number;
  hasProof: boolean;
  mentionedInSettlement: boolean;
  waivedInSettlement: boolean;
  /** matched | difference | no_proof | needs_review */
  matchStatus: string;
  matchLabel: string;
  /** paid | partially_paid | unpaid | disputed */
  settlementEffect: string;
  excludedFromClaim: boolean;
  claimAmount: number;
  reasons: string[];
  warnings: string[];
  paymentsCount: number;
};

export type SettlementIndicator = {
  code: string;
  label: string;
  severity: string;
  detail: string;
};

export type SettlementAnalysis = {
  legalRuleVersion: string;
  hasSettlement: boolean;
  rows: RightMatchRow[];
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  totalClaim: number;
  totalSettlementDeclared: number;
  declaredVsPaidDifference: number;
  /** الحقوق غير المشمولة بالمخالصة */
  notCoveredRights: RightMatchRow[];
  /** الحقوق المستبعدة من المطالبة لثبوت سدادها */
  excludedRights: RightMatchRow[];
  /** الحقوق المتبقية قيد المطالبة */
  remainingRights: RightMatchRow[];
  indicators: SettlementIndicator[];
  warnings: string[];
  handoff: {
    excluded: { code: string; label: string; amount: number }[];
    claims: { code: string; label: string; amount: number; legalRef: string }[];
    totalClaim: number;
    settlementsCount: number;
    paymentsCount: number;
  };
};

const matchLabel = (code: string, policy: FinalSettlementPolicy) =>
  policy.match_statuses.find((m) => m.code === code)?.label ?? code;

const effectRule = (code: string, policy: FinalSettlementPolicy) =>
  policy.settlement_effect_rules.find((r) => r.code === code) ?? null;

/**
 * يطابق الحقوق المحتسبة مع الدفعات والمخالصات، ويحدد الحقوق المسددة
 * والمستبعدة والمتبقية دون افتراض أن التوقيع وحده يسقط المطالبات.
 */
export function analyzeSettlementSet(
  settlements: (SettlementInput & { rowId: string })[],
  payments: (PaymentInput & { rowId: string })[],
  rights: ComputedRight[],
  policy: FinalSettlementPolicy,
  ctx: { serviceEnd: string | null; currency: string },
): SettlementAnalysis {
  const tol = policy.tolerance_amount;
  const active = settlements.filter((s) => s.hasSettlement === "yes");
  const ordered = active
    .slice()
    .sort((a, b) => String(a.settlementDate).localeCompare(String(b.settlementDate)));

  const mentioned = new Set<string>();
  const waived = new Set<string>();
  let coversAll = false;
  ordered.forEach((s) => {
    s.mentionedRights.forEach((c) => mentioned.add(c));
    s.waivedRights.forEach((c) => waived.add(c));
    if (s.coversAllRights) coversAll = true;
  });

  const rows: RightMatchRow[] = rights.map((r) => {
    const rowPayments = payments.filter((p) => p.rightType === r.code);
    const paidInSettlement = round2(
      rowPayments.reduce((t, p) => t + (Number(p.amountPaid) || 0), 0),
    );
    const totalPaid = round2(Math.max(r.paidInModule, 0) + paidInSettlement);
    const remaining = round2(Math.max(r.due - totalPaid, 0));
    const hasProof = r.hasModuleProof || rowPayments.some((p) => !!p.proofFile);
    const isMentioned = mentioned.has(r.code) || coversAll;
    const isWaived = waived.has(r.code);

    const reasons: string[] = [];
    const warnings: string[] = [];

    // المطابقة
    let matchStatus = "needs_review";
    if (totalPaid <= 0) {
      matchStatus = "no_proof";
      reasons.push("لم تُسجل أي دفعة لهذا الحق");
    } else if (!hasProof) {
      matchStatus = "no_proof";
      warnings.push("توجد مبالغ مسددة بدون مستند مؤيد");
    } else if (Math.abs(r.due - totalPaid) <= tol) {
      matchStatus = "matched";
      reasons.push("المبلغ المسدد يطابق المبلغ المحتسب مع وجود إثبات");
    } else if (totalPaid > r.due + tol) {
      matchStatus = "difference";
      warnings.push("المبلغ المسدد يتجاوز المبلغ المستحق المحتسب");
    } else {
      matchStatus = "difference";
      reasons.push("يوجد فرق بين المحتسب والمسدد");
    }

    // الأثر القانوني للمخالصة على هذا الحق
    let settlementEffect = "unpaid";
    let excluded = false;
    if (matchStatus === "matched") {
      settlementEffect = "paid";
      excluded = true;
      reasons.push("يُستبعد من المطالبة لثبوت الوفاء به");
    } else if (totalPaid > 0 && hasProof) {
      settlementEffect = "partially_paid";
      reasons.push("يُستبعد الجزء المثبت سداده فقط ويبقى الفرق قيد المطالبة");
    }

    if (isWaived && !r.waivable) {
      settlementEffect = "disputed";
      excluded = false;
      const rule = effectRule("non_waivable_waiver", policy);
      warnings.push(
        rule?.label ?? "التنازل عن هذا الحق قد يكون غير قابل للتطبيق لكونه حقاً لا يجوز التنازل عنه",
      );
      reasons.push(`أساس قانوني: ${r.legalRef}`);
    } else if (isWaived && r.waivable && !hasProof) {
      warnings.push("تنازل مذكور في المخالصة دون إثبات سداد — يستوجب المراجعة");
    }

    if (!isMentioned && ordered.length) {
      reasons.push("هذا الحق غير مذكور في المخالصة");
    }

    if (ordered.some((s) => s.underDispute) && remaining > 0) {
      settlementEffect = settlementEffect === "paid" ? settlementEffect : "disputed";
    }

    return {
      code: r.code,
      label: r.label,
      module: r.module,
      legalRef: r.legalRef,
      waivable: r.waivable,
      currency: r.currency || ctx.currency,
      due: r.due,
      paidInModule: r.paidInModule,
      paidInSettlement,
      totalPaid,
      remaining,
      hasProof,
      mentionedInSettlement: isMentioned,
      waivedInSettlement: isWaived,
      matchStatus,
      matchLabel: matchLabel(matchStatus, policy),
      settlementEffect,
      excludedFromClaim: excluded,
      claimAmount: excluded ? 0 : remaining,
      reasons,
      warnings,
      paymentsCount: rowPayments.length,
    };
  });

  const totalDue = round2(rows.reduce((t, r) => t + r.due, 0));
  const totalPaid = round2(rows.reduce((t, r) => t + r.totalPaid, 0));
  const totalRemaining = round2(rows.reduce((t, r) => t + r.remaining, 0));
  const totalClaim = round2(rows.reduce((t, r) => t + r.claimAmount, 0));
  const totalSettlementDeclared = round2(
    ordered.reduce((t, s) => t + (Number(s.totalSettlementAmount) || 0), 0),
  );

  /* ---------- المؤشرات القانونية ---------- */

  const indicators: SettlementIndicator[] = [];
  const warnings: string[] = [];

  const push = (code: string, detail: string, fallback: string, severity = "warning") => {
    const rule = effectRule(code, policy);
    indicators.push({
      code,
      label: rule?.label ?? fallback,
      severity: rule?.severity ?? severity,
      detail,
    });
  };

  if (ordered.length) {
    push(
      "signature_not_conclusive",
      "يُحلل النظام كل حق على حدة وفق قواعد الدولة المختارة، ولا يعتمد التوقيع وحده لإسقاط الحقوق.",
      "توقيع المخالصة وحده لا يُعد دليلاً قاطعاً على سقوط الحقوق",
      "info",
    );

    const missing = rows.filter((r) => !r.mentionedInSettlement);
    if (missing.length) {
      push(
        "partial_settlement",
        `حقوق غير مشمولة بالمخالصة: ${missing.map((m) => m.label).join("، ")}`,
        "المخالصة جزئية — تستبعد الحقوق المثبت سدادها فقط",
        "info",
      );
    }

    const noProof = rows.filter((r) => r.totalPaid > 0 && !r.hasProof);
    if (noProof.length) {
      push(
        "requires_proof",
        `حقوق سُجل سدادها دون مستند: ${noProof.map((m) => m.label).join("، ")}`,
        "يجب وجود إثبات سداد لكل حق يُستبعد من المطالبة",
      );
    }

    const nonWaivable = rows.filter((r) => r.waivedInSettlement && !r.waivable);
    if (nonWaivable.length) {
      push(
        "non_waivable_waiver",
        `${policy.non_waivable_note} (${nonWaivable.map((m) => m.label).join("، ")})`,
        "التنازل عن حق لا يجوز التنازل عنه قد يكون غير قابل للتطبيق",
        "critical",
      );
    }

    ordered.forEach((s, i) => {
      if (ctx.serviceEnd && s.settlementDate && s.settlementDate < ctx.serviceEnd) {
        push(
          "date_mismatch",
          `تاريخ المخالصة ${i + 1} (${s.settlementDate}) سابق لتاريخ انتهاء العلاقة (${ctx.serviceEnd}).`,
          "تاريخ المخالصة السابق لتاريخ انتهاء العلاقة يستوجب المراجعة",
        );
      }
      if (s.signatureStatus === "not_signed" || s.signatureStatus === "unclear") {
        indicators.push({
          code: "signature_status",
          label: "حالة التوقيع غير مكتملة",
          severity: "warning",
          detail: `المخالصة ${i + 1}: حالة التوقيع «${
            policy.signature_statuses.find((x) => x.code === s.signatureStatus)?.label ?? s.signatureStatus
          }» — قد تؤثر على حجية المستند شكلاً.`,
        });
      }
      if (s.signatureStatus === "digital" && !s.digitalSignatureReference) {
        warnings.push(`المخالصة ${i + 1}: توقيع إلكتروني بدون رقم مرجع للتحقق`);
      }
      if (!s.settlementFile) {
        warnings.push(`المخالصة ${i + 1}: لم يُرفع مستند المخالصة`);
      }
      if (s.underDispute) {
        push(
          "duress_indicator",
          `المخالصة ${i + 1} محل نزاع أو يوجد ما يشير إلى عدم الرضا الكامل بها.`,
          "وجود نزاع ظاهر أو مؤشرات إكراه يستوجب المراجعة القانونية",
        );
      }
      if (s.courtRulingAfter) {
        indicators.push({
          code: "court_ruling_after",
          label: "صدور حكم قضائي لاحق للمخالصة",
          severity: "info",
          detail: `المخالصة ${i + 1}: ${s.courtRulingReference || "حكم مسجل"} — يُدرج في التقرير دون تعديل المستند الأصلي.`,
        });
      }
    });

    if (ordered.length > 1) {
      indicators.push({
        code: "multiple_settlements",
        label: "تعدد المخالصات",
        severity: "info",
        detail: `تم ترتيب ${ordered.length} مخالصة زمنياً وتحليل كل واحدة بشكل مستقل ثم دمج نتائجها.`,
      });
    }

    if (
      totalSettlementDeclared > 0 &&
      Math.abs(totalSettlementDeclared - totalPaid) > tol
    ) {
      indicators.push({
        code: "declared_amount_difference",
        label: "فرق بين مبلغ المخالصة والمبالغ المثبتة",
        severity: "warning",
        detail: `المبلغ المذكور في المخالصة ${settleMoney(totalSettlementDeclared, ctx.currency)} مقابل مبالغ مثبتة ${settleMoney(totalPaid, ctx.currency)}.`,
      });
    }
  } else {
    indicators.push({
      code: "no_settlement",
      label: "لا توجد مخالصة نهائية",
      severity: "info",
      detail: "تُراجع الحقوق المسددة فقط، وتبقى الحقوق غير المثبت سدادها قيد المطالبة.",
    });
  }

  // اختلاف العملة
  const diffCurrency = payments.filter((p) => p.currency && p.currency !== ctx.currency);
  if (diffCurrency.length) {
    indicators.push({
      code: "currency_mismatch",
      label: "دفعات بعملة مختلفة",
      severity: "info",
      detail: `${diffCurrency.length} دفعة بعملة مختلفة عن عملة القضية — تُحفظ القيمة الأصلية وسعر الصرف المرجعي.`,
    });
    diffCurrency.filter((p) => !p.exchangeRate).forEach((p) =>
      warnings.push(`دفعة بعملة ${p.currency} بدون سعر صرف مرجعي`),
    );
  }

  const notCovered = rows.filter((r) => !r.mentionedInSettlement && r.remaining > 0);
  const excludedRights = rows.filter((r) => r.excludedFromClaim);
  const remainingRights = rows.filter((r) => !r.excludedFromClaim && r.claimAmount > 0);

  return {
    legalRuleVersion: policy.version,
    hasSettlement: ordered.length > 0,
    rows,
    totalDue,
    totalPaid,
    totalRemaining,
    totalClaim,
    totalSettlementDeclared,
    declaredVsPaidDifference: round2(totalSettlementDeclared - totalPaid),
    notCoveredRights: notCovered,
    excludedRights,
    remainingRights,
    indicators,
    warnings,
    handoff: {
      excluded: excludedRights.map((r) => ({ code: r.code, label: r.label, amount: r.totalPaid })),
      claims: remainingRights.map((r) => ({
        code: r.code,
        label: r.label,
        amount: r.claimAmount,
        legalRef: r.legalRef,
      })),
      totalClaim,
      settlementsCount: ordered.length,
      paymentsCount: payments.length,
    },
  };
}

/* ============================ التحقق من صحة البيانات ============================ */

export function validateSettlement(
  s: SettlementInput,
  ctx: { serviceEnd: string | null },
): string[] {
  const e: string[] = [];
  if (s.hasSettlement !== "yes") return e;
  if (!s.settlementType) e.push("يجب تحديد نوع المخالصة");
  if (!s.settlementDate) e.push("يجب إدخال تاريخ المخالصة");
  if (s.signingDate && s.settlementDate && s.signingDate < s.settlementDate)
    e.push("تاريخ التوقيع لا يمكن أن يكون قبل تاريخ المخالصة");
  if (ctx.serviceEnd && s.settlementDate && s.settlementDate < ctx.serviceEnd)
    e.push("تاريخ المخالصة لا يتوافق مع تاريخ انتهاء العلاقة العمالية — يرجى المراجعة");
  if (s.signatureStatus === "digital" && !s.digitalSignatureReference)
    e.push("يجب إدخال رقم مرجع التوقيع الإلكتروني");
  if (!s.settlementFile) e.push("يجب رفع مستند المخالصة للتحقق من توافق البيانات معه");
  if (s.courtRulingAfter && !s.courtRulingReference)
    e.push("يجب إدخال مرجع الحكم القضائي اللاحق");
  return e;
}

export function validatePayments(
  payments: (PaymentInput & { rowId: string })[],
  rights: ComputedRight[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const seen = new Map<string, string>();

  payments.forEach((p) => {
    const e: string[] = [];
    if (!p.rightType) e.push("يجب تحديد نوع الحق");
    if (p.amountPaid === "" || Number(p.amountPaid) <= 0) e.push("يجب إدخال قيمة الدفعة");
    if (!p.paymentDate) e.push("يجب إدخال تاريخ السداد");
    if (!p.paymentMethod) e.push("يجب تحديد طريقة السداد");
    if (!p.proofFile) e.push("يجب إرفاق المستند المؤيد للسداد");
    if (p.currency && p.currency !== (rights[0]?.currency ?? p.currency) && !p.exchangeRate)
      e.push("يجب إدخال سعر الصرف المرجعي للعملة المختلفة");

    const key = `${p.rightType}|${p.paymentDate}|${Number(p.amountPaid) || 0}|${p.paymentMethod}`;
    if (seen.has(key)) e.push("دفعة مكررة بنفس الحق والتاريخ والقيمة وطريقة السداد");
    else seen.set(key, p.rowId);

    const right = rights.find((r) => r.code === p.rightType);
    if (right) {
      const totalForRight =
        right.paidInModule +
        payments
          .filter((x) => x.rightType === p.rightType)
          .reduce((t, x) => t + (Number(x.amountPaid) || 0), 0);
      if (right.due > 0 && totalForRight > right.due + 1)
        e.push("مجموع المسدد يتجاوز المبلغ المستحق المحتسب لهذا الحق");
    }

    if (e.length) out[p.rowId] = e;
  });

  return out;
}

export const settlementTypeLabel = (code: string, policy: FinalSettlementPolicy) =>
  policy.settlement_types.find((t) => t.code === code)?.label ?? code ?? "—";

export const signatureLabel = (code: string, policy: FinalSettlementPolicy) =>
  policy.signature_statuses.find((t) => t.code === code)?.label ?? code ?? "—";

export const paymentMethodLabel = (code: string, policy: FinalSettlementPolicy) =>
  policy.payment_methods.find((t) => t.code === code)?.label ?? code ?? "—";
