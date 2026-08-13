// PART 1F — الإجازة السنوية وتعويض رصيد الإجازات
// لا يعدّل محركي الحساب — يوفّر مخرجات جاهزة للمحرك القانوني والتقرير النهائي.

const DAY = 86400000;

export type LeavePolicy = {
  base_days: number;
  long_service_days: number;
  long_service_years: number;
  max_carryover_days: number;
  carryover_validity_months: number;
  cash_compensation_allowed: boolean;
  compensation_wage_basis: string;
  compensation_on_active_employment: boolean;
  prorate_partial_year: boolean;
};

export const DEFAULT_LEAVE_POLICY: LeavePolicy = {
  base_days: 21,
  long_service_days: 30,
  long_service_years: 5,
  max_carryover_days: 30,
  carryover_validity_months: 12,
  cash_compensation_allowed: true,
  compensation_wage_basis: "last_actual_wage",
  compensation_on_active_employment: false,
  prorate_partial_year: true,
};

export function toLeavePolicy(value: unknown): LeavePolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const num = (k: keyof LeavePolicy, d: number) =>
    Number.isFinite(Number(v[k])) ? Number(v[k]) : d;
  return {
    base_days: num("base_days", DEFAULT_LEAVE_POLICY.base_days),
    long_service_days: num("long_service_days", DEFAULT_LEAVE_POLICY.long_service_days),
    long_service_years: num("long_service_years", DEFAULT_LEAVE_POLICY.long_service_years),
    max_carryover_days: num("max_carryover_days", DEFAULT_LEAVE_POLICY.max_carryover_days),
    carryover_validity_months: num(
      "carryover_validity_months",
      DEFAULT_LEAVE_POLICY.carryover_validity_months,
    ),
    cash_compensation_allowed:
      v.cash_compensation_allowed == null
        ? DEFAULT_LEAVE_POLICY.cash_compensation_allowed
        : !!v.cash_compensation_allowed,
    compensation_wage_basis:
      typeof v.compensation_wage_basis === "string"
        ? v.compensation_wage_basis
        : DEFAULT_LEAVE_POLICY.compensation_wage_basis,
    compensation_on_active_employment: !!v.compensation_on_active_employment,
    prorate_partial_year:
      v.prorate_partial_year == null ? true : !!v.prorate_partial_year,
  };
}

/* ============================ الأنواع ============================ */

export type LeaveType = "annual" | "carried" | "cash" | "other";

export const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "annual", label: "إجازة سنوية" },
  { value: "carried", label: "إجازة مرحّلة" },
  { value: "cash", label: "إجازة نقدية (بدل)" },
  { value: "other", label: "أخرى" },
];

export type LeavePaymentStatus = "unpaid" | "paid" | "partial";

export const LEAVE_PAYMENT_STATUSES: { value: LeavePaymentStatus; label: string }[] = [
  { value: "unpaid", label: "لا (لم يُصرف)" },
  { value: "paid", label: "نعم (تم الصرف)" },
  { value: "partial", label: "صرف جزئي" },
];

export const LEAVE_PAYMENT_METHODS = [
  "تحويل بنكي",
  "مسير رواتب",
  "سند قبض",
  "شيك",
  "مستند آخر",
] as const;

export const LEAVE_PROOF_TYPES = [
  "تحويل بنكي",
  "مسير رواتب",
  "سند قبض",
  "شيك",
  "مستند آخر",
] as const;

export const WAGE_BASES: { value: string; label: string }[] = [
  { value: "last_actual_wage", label: "آخر أجر فعلي (القاعدة النظامية)" },
  { value: "country_rule", label: "القاعدة القانونية للدولة المختارة" },
];

export type LeaveTakenRow = {
  id?: string;
  start_date: string;
  end_date: string;
  days: number | "";
  leave_type: LeaveType;
  notes: string;
};

export type CarryoverRow = {
  id?: string;
  from_year: number | "";
  days: number | "";
  reason: string;
  is_legal: boolean;
  proof_file: string;
  notes: string;
};

export const emptyLeaveTaken = (): LeaveTakenRow => ({
  start_date: "",
  end_date: "",
  days: "",
  leave_type: "annual",
  notes: "",
});

export const emptyCarryover = (): CarryoverRow => ({
  from_year: new Date().getFullYear() - 1,
  days: "",
  reason: "",
  is_legal: true,
  proof_file: "",
  notes: "",
});

const n = (v: number | "" | null | undefined) => (v === "" || v == null ? 0 : Number(v) || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const toDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function inclusiveDays(start?: string | null, end?: string | null): number {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY) + 1);
}

/* ==================== مدة الخدمة والاستحقاق ==================== */

export type ServiceSpan = {
  start: string | null;
  end: string | null;
  totalDays: number;
  years: number;
  months: number;
  days: number;
  gapDays: number;
};

export function serviceSpan(
  start: string | null,
  end: string | null,
  gapDays = 0,
): ServiceSpan {
  const totalRaw = inclusiveDays(start, end);
  const totalDays = Math.max(0, totalRaw - Math.max(0, gapDays));
  const years = Math.floor(totalDays / 365);
  const rest = totalDays - years * 365;
  const months = Math.floor(rest / 30);
  return {
    start,
    end,
    totalDays,
    years,
    months,
    days: rest - months * 30,
    gapDays: Math.max(0, gapDays),
  };
}

export type LeaveYearRow = {
  serviceYear: number;
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  fullYear: boolean;
  ratio: number;
  entitlementDays: number;
  usedDays: number;
  legalBasis: string;
};

/** استحقاق كل سنة خدمة على حدة مع النسبة عند عدم اكتمال السنة */
export function buildLeaveYears(
  span: ServiceSpan,
  taken: LeaveTakenRow[],
  policy: LeavePolicy,
): LeaveYearRow[] {
  const start = toDate(span.start);
  const end = toDate(span.end);
  if (!start || !end || end < start) return [];

  const rows: LeaveYearRow[] = [];
  let cursor = new Date(start.getTime());
  let index = 0;

  while (cursor <= end && index < 60) {
    index += 1;
    const yearEndCandidate = new Date(cursor.getTime());
    yearEndCandidate.setFullYear(yearEndCandidate.getFullYear() + 1);
    yearEndCandidate.setDate(yearEndCandidate.getDate() - 1);
    const periodEnd = yearEndCandidate < end ? yearEndCandidate : end;

    const periodDays = inclusiveDays(iso(cursor), iso(periodEnd));
    const fullYear = yearEndCandidate <= end;
    const perYearDays =
      index > policy.long_service_years ? policy.long_service_days : policy.base_days;
    const ratio = fullYear ? 1 : policy.prorate_partial_year ? periodDays / 365 : 0;
    const entitlementDays = r2(perYearDays * ratio);

    const usedDays = taken
      .filter((t) => {
        const s = t.start_date;
        return s && s >= iso(cursor) && s <= iso(periodEnd);
      })
      .reduce((sum, t) => sum + n(t.days), 0);

    rows.push({
      serviceYear: index,
      periodStart: iso(cursor),
      periodEnd: iso(periodEnd),
      periodDays,
      fullYear,
      ratio: r2(ratio),
      entitlementDays,
      usedDays: r2(usedDays),
      legalBasis:
        index > policy.long_service_years
          ? `${policy.long_service_days} يوماً بعد إكمال ${policy.long_service_years} سنوات خدمة`
          : `${policy.base_days} يوماً لكل سنة خدمة`,
    });

    cursor = new Date(periodEnd.getTime() + DAY);
  }

  return rows;
}

/* ==================== التحليل النهائي ==================== */

export type LeaveAnalysis = {
  policy: LeavePolicy;
  span: ServiceSpan;
  years: LeaveYearRow[];
  totalEntitlement: number;
  totalUsed: number;
  carriedRequested: number;
  carriedLegal: number;
  carriedRejected: number;
  balanceDays: number;
  dailyWage: number;
  compensation: number;
  paidAmount: number;
  provenPaid: number;
  excludedAmount: number;
  finalDue: number;
  currency: string;
  compensationAllowed: boolean;
  status: string;
  warnings: string[];
  steps: string[];
};

export type LeaveSettlement = {
  still_employed: boolean;
  wage_changed: boolean;
  wage_basis: string;
  payment_status: LeavePaymentStatus;
  paid_amount: number | "";
  payment_date: string;
  payment_method: string;
  proof_type: string;
  proof_file: string;
  notes: string;
};

export const emptySettlement = (): LeaveSettlement => ({
  still_employed: false,
  wage_changed: false,
  wage_basis: "last_actual_wage",
  payment_status: "unpaid",
  paid_amount: "",
  payment_date: "",
  payment_method: "",
  proof_type: "",
  proof_file: "",
  notes: "",
});

export function analyzeAnnualLeave(opts: {
  span: ServiceSpan;
  taken: LeaveTakenRow[];
  carryover: CarryoverRow[];
  settlement: LeaveSettlement;
  dailyWage: number;
  currency?: string;
  policy?: LeavePolicy;
}): LeaveAnalysis {
  const policy = opts.policy ?? DEFAULT_LEAVE_POLICY;
  const currency = opts.currency ?? "SAR";
  const years = buildLeaveYears(opts.span, opts.taken, policy);
  const warnings: string[] = [];
  const steps: string[] = [];

  const totalEntitlement = r2(years.reduce((a, y) => a + y.entitlementDays, 0));
  const totalUsed = r2(opts.taken.reduce((a, t) => a + n(t.days), 0));

  const carriedRequested = r2(opts.carryover.reduce((a, c) => a + n(c.days), 0));
  const legalRows = opts.carryover.filter((c) => c.is_legal);
  const legalRaw = r2(legalRows.reduce((a, c) => a + n(c.days), 0));
  const carriedLegal = r2(Math.min(legalRaw, policy.max_carryover_days));
  const carriedRejected = r2(Math.max(0, carriedRequested - carriedLegal));

  if (legalRaw > policy.max_carryover_days) {
    warnings.push(
      `الرصيد المرحّل (${legalRaw} يوم) يتجاوز الحد الأقصى النظامي للترحيل (${policy.max_carryover_days} يوم) — تم احتساب الحد الأقصى فقط.`,
    );
  }
  if (carriedRequested > legalRaw) {
    warnings.push("توجد أيام مرحّلة تم تحديدها كغير نظامية ولم تُحتسب في الرصيد.");
  }
  if (totalUsed > totalEntitlement + carriedLegal) {
    warnings.push("الإجازات المستخدمة تتجاوز إجمالي الأيام المستحقة — يرجى مراجعة السجلات.");
  }

  const balanceDays = r2(Math.max(0, totalEntitlement - totalUsed + carriedLegal));
  const dailyWage = r2(opts.dailyWage || 0);
  const compensationAllowed = opts.settlement.still_employed
    ? policy.cash_compensation_allowed && policy.compensation_on_active_employment
    : policy.cash_compensation_allowed;

  const compensation = compensationAllowed ? r2(balanceDays * dailyWage) : 0;

  if (opts.settlement.still_employed && !compensationAllowed) {
    warnings.push(
      "العلاقة العمالية مستمرة — يُعرض الرصيد فقط ولا يُحتسب تعويض نقدي وفق سياسة الدولة المختارة.",
    );
  }
  if (opts.settlement.wage_changed) {
    warnings.push(
      opts.settlement.wage_basis === "country_rule"
        ? "تم تغير الأجر خلال الخدمة، وطُبقت القاعدة القانونية للدولة المختارة في احتساب الأجر اليومي."
        : "تم تغير الأجر خلال الخدمة، واحتُسب التعويض على أساس آخر أجر فعلي.",
    );
  }

  const claimedPaid =
    opts.settlement.payment_status === "unpaid"
      ? 0
      : opts.settlement.payment_status === "paid"
        ? compensation
        : r2(n(opts.settlement.paid_amount));
  const hasProof =
    (!!opts.settlement.proof_file || !!opts.settlement.proof_type) &&
    !!opts.settlement.payment_date;
  const provenPaid = hasProof ? r2(Math.min(compensation, claimedPaid)) : 0;
  const excludedAmount = provenPaid;
  const finalDue = r2(Math.max(0, compensation - provenPaid));

  if (opts.settlement.payment_status !== "unpaid" && !hasProof) {
    warnings.push(
      "تم إدخال صرف بدل إجازة دون وجود إثبات، وقد يكون محل نظر أمام الجهة القضائية، ولم يُستبعد المبلغ من المطالبة.",
    );
  }

  const status =
    opts.settlement.payment_status === "unpaid"
      ? "غير مصروف"
      : !hasProof
        ? "صرف بدون إثبات"
        : finalDue <= 0
          ? "مصروف (مستبعد)"
          : "صرف جزئي";

  steps.push(
    `مدة الخدمة: ${opts.span.years} سنة و${opts.span.months} شهر و${opts.span.days} يوم (${opts.span.totalDays} يوم).`,
    `إجمالي أيام الاستحقاق: ${totalEntitlement} يوم (${years.length} سنة خدمة).`,
    `الإجازات المستخدمة: ${totalUsed} يوم.`,
    `الرصيد المرحّل النظامي: ${carriedLegal} يوم.`,
    `رصيد الإجازات النهائي = ${totalEntitlement} − ${totalUsed} + ${carriedLegal} = ${balanceDays} يوم.`,
    `الأجر اليومي = الأجر الفعلي ÷ 30 = ${dailyWage} ${currency}.`,
    `تعويض الإجازات = ${balanceDays} × ${dailyWage} = ${compensation} ${currency}.`,
    `المبالغ المستبعدة (مصروفة بإثبات): ${excludedAmount} ${currency}.`,
    `المبلغ النهائي المستحق: ${finalDue} ${currency}.`,
  );

  return {
    policy,
    span: opts.span,
    years,
    totalEntitlement,
    totalUsed,
    carriedRequested,
    carriedLegal,
    carriedRejected,
    balanceDays,
    dailyWage,
    compensation,
    paidAmount: claimedPaid,
    provenPaid,
    excludedAmount,
    finalDue,
    currency,
    compensationAllowed,
    status,
    warnings,
    steps,
  };
}

/* ==================== التحقق من صحة البيانات ==================== */

export function validateLeave(opts: {
  taken: LeaveTakenRow[];
  carryover: CarryoverRow[];
  settlement: LeaveSettlement;
  span: ServiceSpan;
  analysis: LeaveAnalysis;
}): string[] {
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  opts.taken.forEach((row, i) => {
    const label = `سجل الإجازة ${i + 1}`;
    if (!row.start_date || !row.end_date) {
      errors.push(`${label}: يجب إدخال تاريخ البداية والنهاية.`);
    } else if (row.end_date < row.start_date) {
      errors.push(`${label}: تاريخ النهاية قبل تاريخ البداية.`);
    }
    if (n(row.days) <= 0) errors.push(`${label}: عدد الأيام يجب أن يكون أكبر من صفر.`);
    if (opts.span.start && row.start_date && row.start_date < opts.span.start) {
      errors.push(`${label}: تاريخ الإجازة قبل بداية مدة الخدمة.`);
    }
    if (opts.span.end && row.end_date && row.end_date > opts.span.end) {
      errors.push(`${label}: تاريخ الإجازة بعد نهاية مدة الخدمة.`);
    }
    // تداخل الفترات / احتساب نفس الإجازة مرتين
    for (let j = 0; j < i; j += 1) {
      const other = opts.taken[j];
      if (!row.start_date || !row.end_date || !other.start_date || !other.end_date) continue;
      if (row.start_date <= other.end_date && other.start_date <= row.end_date) {
        errors.push(`${label}: تتداخل مع سجل الإجازة ${j + 1} (قد تكون محتسبة مرتين).`);
      }
    }
  });

  opts.carryover.forEach((row, i) => {
    const label = `الرصيد المرحّل ${i + 1}`;
    if (n(row.days) <= 0) errors.push(`${label}: عدد الأيام يجب أن يكون أكبر من صفر.`);
    if (row.from_year === "") errors.push(`${label}: يجب تحديد السنة.`);
  });

  if (opts.analysis.totalUsed > opts.analysis.totalEntitlement + opts.analysis.carriedLegal) {
    errors.push("الإجازات المستخدمة تتجاوز الإجازات المستحقة والمرحّلة.");
  }

  const s = opts.settlement;
  if (s.payment_status !== "unpaid") {
    if (!s.payment_date) errors.push("يجب إدخال تاريخ صرف بدل الإجازة.");
    if (s.payment_date && s.payment_date > today) errors.push("لا يمكن إدخال تاريخ صرف مستقبلي.");
    if (!s.payment_method) errors.push("يجب تحديد طريقة السداد.");
  }
  if (s.payment_status === "partial") {
    const paid = n(s.paid_amount);
    if (paid <= 0) errors.push("يجب إدخال القيمة المصروفة في الصرف الجزئي.");
    if (paid > opts.analysis.compensation) errors.push("المبلغ المصروف أكبر من المستحق.");
  }

  return errors;
}
