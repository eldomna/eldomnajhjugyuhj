// PART 1I — التأمينات الاجتماعية والاشتراكات
// محرك مستقل: لا يمس محركات الحساب القائمة، وجميع النسب والحدود تُحمّل من محرك القوانين.

/* ============================ السياسة ============================ */

export type SIRateSchedule = {
  effective_from: string;
  nationality_category: string;
  employee_rate: number;
  employer_rate: number;
  branches: string[];
};

export type SocialInsurancePolicy = {
  system_name: string;
  legal_basis: string;
  min_insurable_wage: number;
  max_insurable_wage: number;
  included_allowances: string[];
  excluded_allowances: string[];
  rate_schedules: SIRateSchedule[];
  exempt_employment_categories: string[];
  late_penalty_rate: number;
  notes: string;
};

export const DEFAULT_SI_POLICY: SocialInsurancePolicy = {
  system_name: "المؤسسة العامة للتأمينات الاجتماعية (GOSI)",
  legal_basis: "نظام التأمينات الاجتماعية ولوائحه التنفيذية",
  min_insurable_wage: 1500,
  max_insurable_wage: 45000,
  included_allowances: ["basic_salary", "housing_allowance"],
  excluded_allowances: [
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
  rate_schedules: [
    {
      effective_from: "2000-01-01",
      nationality_category: "citizen",
      employee_rate: 0.0975,
      employer_rate: 0.1175,
      branches: ["المعاشات", "الأخطار المهنية", "التأمين ضد التعطل"],
    },
    {
      effective_from: "2000-01-01",
      nationality_category: "non_citizen",
      employee_rate: 0,
      employer_rate: 0.02,
      branches: ["الأخطار المهنية"],
    },
  ],
  exempt_employment_categories: ["trainee", "exempt"],
  late_penalty_rate: 0.02,
  notes: "جميع النسب والحدود قابلة للتحديث من محرك القوانين دون تعديل الكود.",
};

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
const arr = (v: unknown, d: string[]) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string") : d;

export function toSocialInsurancePolicy(value: unknown): SocialInsurancePolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const schedules = Array.isArray(v.rate_schedules)
    ? (v.rate_schedules as Record<string, unknown>[]).map((s) => ({
        effective_from: str(s.effective_from, "2000-01-01"),
        nationality_category: str(s.nationality_category, "citizen"),
        employee_rate: num(s.employee_rate, 0),
        employer_rate: num(s.employer_rate, 0),
        branches: arr(s.branches, []),
      }))
    : DEFAULT_SI_POLICY.rate_schedules;
  return {
    system_name: str(v.system_name, DEFAULT_SI_POLICY.system_name),
    legal_basis: str(v.legal_basis, DEFAULT_SI_POLICY.legal_basis),
    min_insurable_wage: num(v.min_insurable_wage, DEFAULT_SI_POLICY.min_insurable_wage),
    max_insurable_wage: num(v.max_insurable_wage, DEFAULT_SI_POLICY.max_insurable_wage),
    included_allowances: arr(v.included_allowances, DEFAULT_SI_POLICY.included_allowances),
    excluded_allowances: arr(v.excluded_allowances, DEFAULT_SI_POLICY.excluded_allowances),
    rate_schedules: schedules.length ? schedules : DEFAULT_SI_POLICY.rate_schedules,
    exempt_employment_categories: arr(
      v.exempt_employment_categories,
      DEFAULT_SI_POLICY.exempt_employment_categories,
    ),
    late_penalty_rate: num(v.late_penalty_rate, DEFAULT_SI_POLICY.late_penalty_rate),
    notes: str(v.notes, DEFAULT_SI_POLICY.notes),
  };
}

/* ============================ خيارات الواجهة ============================ */

export const SI_SUBJECT_OPTIONS = [
  { value: "yes", label: "نعم" },
  { value: "no", label: "لا" },
  { value: "unknown", label: "غير معروف" },
];

export const SI_REGISTRATION_STATUSES = [
  { value: "active", label: "نشط" },
  { value: "suspended", label: "موقوف" },
  { value: "ended", label: "منتهي" },
  { value: "not_registered", label: "لم يتم التسجيل" },
];

export const SI_NATIONALITY_CATEGORIES = [
  { value: "citizen", label: "مواطن" },
  { value: "non_citizen", label: "غير مواطن" },
];

export const SI_EMPLOYMENT_CATEGORIES = [
  { value: "full_time", label: "عامل بدوام كامل" },
  { value: "part_time", label: "عامل بدوام جزئي" },
  { value: "seasonal", label: "عامل موسمي" },
  { value: "trainee", label: "متدرب" },
  { value: "exempt", label: "مستثنى من الاشتراك" },
];

export const SI_SECTORS = [
  { value: "private", label: "القطاع الخاص" },
  { value: "public", label: "القطاع العام" },
  { value: "domestic", label: "العمالة المنزلية" },
];

export const SI_REGISTRATION_STATES = [
  { value: "registered", label: "مسجل" },
  { value: "not_registered", label: "غير مسجل" },
  { value: "partial", label: "ناقص" },
  { value: "suspended", label: "موقوف" },
  { value: "not_applicable", label: "لا ينطبق" },
];

export const SI_PAYMENT_STATUSES = [
  { value: "paid", label: "نعم (مسدد)" },
  { value: "unpaid", label: "لا (غير مسدد)" },
  { value: "partial", label: "سداد جزئي" },
];

export const SI_PROOF_TYPES = [
  { value: "gosi_notice", label: "إشعار التأمينات" },
  { value: "account_statement", label: "كشف حساب" },
  { value: "receipt", label: "إيصال" },
  { value: "official_document", label: "مستند رسمي" },
  { value: "pdf", label: "ملف PDF" },
  { value: "other", label: "مستند آخر" },
];

export type SIPaymentStatus = "paid" | "unpaid" | "partial";

export type SIMonthRow = {
  id?: string;
  year: number;
  month: number;
  key: string;
  actual_wage: number | "";
  registered_wage: number | "";
  registration_state: string;
  payment_status: SIPaymentStatus;
  paid_amount: number | "";
  payment_date: string;
  payment_reference: string;
  payment_entity: string;
  payment_proof_type: string;
  payment_proof_file: string;
  notes: string;
};

export const monthName = (m: number) =>
  [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ][Math.max(0, Math.min(11, m - 1))];

/* ============================ أدوات ============================ */

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKey = (y: number, m: number) => `${y}-${pad(m)}`;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** توليد أشهر الخدمة بين تاريخين (شاملة). */
export function serviceMonths(start?: string | null, end?: string | null) {
  if (!start) return [] as { year: number; month: number; key: string }[];
  const s = new Date(start);
  const e = new Date(end || new Date().toISOString().slice(0, 10));
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return [];
  const out: { year: number; month: number; key: string }[] = [];
  let y = s.getUTCFullYear();
  let m = s.getUTCMonth() + 1;
  let guard = 0;
  while (guard++ < 1200) {
    out.push({ year: y, month: m, key: monthKey(y, m) });
    if (y === e.getUTCFullYear() && m === e.getUTCMonth() + 1) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function emptyMonthRow(year: number, month: number, actualWage: number): SIMonthRow {
  return {
    year,
    month,
    key: monthKey(year, month),
    actual_wage: actualWage,
    registered_wage: actualWage,
    registration_state: "registered",
    payment_status: "unpaid",
    paid_amount: "",
    payment_date: "",
    payment_reference: "",
    payment_entity: "",
    payment_proof_type: "",
    payment_proof_file: "",
    notes: "",
  };
}

/** الأجر الخاضع للاشتراك: البدلات الداخلة فقط، ثم تطبيق الحد الأدنى والأعلى. */
export function insurableWageBreakdown(
  salary: Record<string, unknown> | null | undefined,
  policy: SocialInsurancePolicy,
) {
  const included: { key: string; amount: number }[] = [];
  const excluded: { key: string; amount: number }[] = [];
  for (const key of policy.included_allowances) {
    included.push({ key, amount: num(salary?.[key], 0) });
  }
  for (const key of policy.excluded_allowances) {
    const amount = num(salary?.[key], 0);
    if (amount) excluded.push({ key, amount });
  }
  const raw = round2(included.reduce((s, r) => s + r.amount, 0));
  let capped = raw;
  let cappedByMax = false;
  let raisedByMin = false;
  if (policy.max_insurable_wage > 0 && capped > policy.max_insurable_wage) {
    capped = policy.max_insurable_wage;
    cappedByMax = true;
  }
  if (policy.min_insurable_wage > 0 && capped > 0 && capped < policy.min_insurable_wage) {
    capped = policy.min_insurable_wage;
    raisedByMin = true;
  }
  return { included, excluded, raw, insurable: round2(capped), cappedByMax, raisedByMin };
}

/** اختيار النسب السارية للشهر حسب فئة الجنسية وتاريخ السريان. */
export function ratesFor(
  policy: SocialInsurancePolicy,
  nationalityCategory: string,
  periodKey: string,
): SIRateSchedule | null {
  const periodDate = `${periodKey}-01`;
  const candidates = policy.rate_schedules
    .filter((s) => s.nationality_category === nationalityCategory)
    .filter((s) => (s.effective_from || "2000-01-01") <= periodDate)
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  return candidates[0] ?? null;
}

export function clampInsurable(wage: number, policy: SocialInsurancePolicy) {
  let w = round2(Math.max(0, wage));
  if (policy.max_insurable_wage > 0 && w > policy.max_insurable_wage) w = policy.max_insurable_wage;
  if (policy.min_insurable_wage > 0 && w > 0 && w < policy.min_insurable_wage)
    w = policy.min_insurable_wage;
  return round2(w);
}

/* ============================ التحليل ============================ */

export type SIInput = {
  isSubject: string;
  exemptionReason: string;
  registrationStatus: string;
  registrationDate: string;
  coverageStart: string;
  coverageEnd: string;
  nationalityCategory: string;
  employmentCategory: string;
  sector: string;
  months: SIMonthRow[];
  baseInsurableWage: number;
  currency: string;
  policy?: SocialInsurancePolicy;
  serviceStart: string | null;
  serviceEnd: string | null;
};

export type SIMonthResult = {
  index: number;
  key: string;
  year: number;
  month: number;
  actualWage: number;
  insurableWage: number;
  registeredWage: number;
  employeeRate: number;
  employerRate: number;
  employeeContribution: number;
  employerContribution: number;
  total: number;
  registeredTotal: number;
  difference: number;
  employeeDifference: number;
  employerDifference: number;
  paid: number;
  remaining: number;
  registrationState: string;
  paymentStatus: SIPaymentStatus;
  proofMissing: boolean;
  counted: boolean;
};

export function analyzeSocialInsurance(input: SIInput) {
  const policy = input.policy ?? DEFAULT_SI_POLICY;
  const warnings: string[] = [];
  const steps: string[] = [];
  const exemptByCategory = policy.exempt_employment_categories.includes(input.employmentCategory);
  const applicable = input.isSubject === "yes" && !exemptByCategory;

  if (input.isSubject === "no") {
    warnings.push("العامل غير خاضع لنظام التأمينات الاجتماعية، ولن يتم احتساب أي اشتراكات.");
  }
  if (input.isSubject === "unknown") {
    warnings.push(
      "حالة الخضوع للتأمينات غير معروفة؛ يُنصح بالتحقق من سجل التأمينات قبل الاعتماد على النتائج.",
    );
  }
  if (exemptByCategory && input.isSubject === "yes") {
    warnings.push("نوع العامل مستثنى من الاشتراك وفق قواعد محرك القوانين، فلا تُحتسب الاشتراكات.");
  }

  const results: SIMonthResult[] = [];
  let totalDue = 0;
  let totalEmployee = 0;
  let totalEmployer = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  let totalDifference = 0;
  let unregisteredMonths = 0;
  let partialMonths = 0;
  let suspendedMonths = 0;
  let missingProofMonths = 0;

  input.months.forEach((row, index) => {
    const actualWage = Number(row.actual_wage) || 0;
    const insurableWage = clampInsurable(actualWage, policy);
    const registeredWageRaw =
      row.registered_wage === "" ? insurableWage : Number(row.registered_wage) || 0;
    const registeredWage = clampInsurable(registeredWageRaw, policy);
    const sched = applicable ? ratesFor(policy, input.nationalityCategory, row.key) : null;
    const employeeRate = sched?.employee_rate ?? 0;
    const employerRate = sched?.employer_rate ?? 0;
    const counted =
      applicable && row.registration_state !== "not_applicable" && insurableWage > 0;

    const employeeContribution = counted ? round2(insurableWage * employeeRate) : 0;
    const employerContribution = counted ? round2(insurableWage * employerRate) : 0;
    const total = round2(employeeContribution + employerContribution);
    const registeredTotal = counted
      ? round2(registeredWage * employeeRate + registeredWage * employerRate)
      : 0;
    const employeeDifference = counted
      ? round2((insurableWage - registeredWage) * employeeRate)
      : 0;
    const employerDifference = counted
      ? round2((insurableWage - registeredWage) * employerRate)
      : 0;
    const difference = round2(employeeDifference + employerDifference);

    const paid =
      row.payment_status === "paid"
        ? row.paid_amount === ""
          ? total
          : Number(row.paid_amount) || 0
        : row.payment_status === "partial"
          ? Number(row.paid_amount) || 0
          : 0;
    const remaining = counted ? round2(Math.max(0, total - paid)) : 0;
    const proofMissing =
      (row.payment_status === "paid" || row.payment_status === "partial") &&
      !row.payment_proof_file;

    if (counted) {
      totalDue += total;
      totalEmployee += employeeContribution;
      totalEmployer += employerContribution;
      totalPaid += Math.min(paid, total);
      totalRemaining += remaining;
      totalDifference += difference;
    }
    if (row.registration_state === "not_registered") unregisteredMonths += 1;
    if (row.registration_state === "partial") partialMonths += 1;
    if (row.registration_state === "suspended") suspendedMonths += 1;
    if (proofMissing) missingProofMonths += 1;

    results.push({
      index,
      key: row.key,
      year: row.year,
      month: row.month,
      actualWage,
      insurableWage,
      registeredWage,
      employeeRate,
      employerRate,
      employeeContribution,
      employerContribution,
      total,
      registeredTotal,
      difference,
      employeeDifference,
      employerDifference,
      paid: round2(paid),
      remaining,
      registrationState: row.registration_state,
      paymentStatus: row.payment_status,
      proofMissing,
      counted,
    });
  });

  const firstSched = applicable
    ? ratesFor(policy, input.nationalityCategory, input.months[0]?.key ?? monthKey(2024, 1))
    : null;

  if (applicable) {
    steps.push(
      `النظام المطبق: ${policy.system_name} — ${policy.legal_basis}.`,
      `الأجر الخاضع للاشتراك = مجموع البدلات الداخلة، مع حد أدنى ${policy.min_insurable_wage} وحد أعلى ${policy.max_insurable_wage} ${input.currency}.`,
      `نسبة العامل السارية: ${((firstSched?.employee_rate ?? 0) * 100).toFixed(2)}% — نسبة صاحب العمل: ${((firstSched?.employer_rate ?? 0) * 100).toFixed(2)}% (تُطبق نسبة كل فترة وفق تاريخ سريانها).`,
      `اشتراك العامل = الأجر الخاضع × نسبة العامل، واشتراك صاحب العمل = الأجر الخاضع × نسبة صاحب العمل.`,
      `إجمالي الاشتراك الشهري = اشتراك العامل + اشتراك صاحب العمل.`,
      `عدد أشهر الخدمة الخاضعة للمراجعة: ${results.filter((r) => r.counted).length} شهراً.`,
      `إجمالي الاشتراكات المستحقة: ${round2(totalDue)} ${input.currency} (العامل ${round2(totalEmployee)} / صاحب العمل ${round2(totalEmployer)}).`,
      `المسدد: ${round2(totalPaid)} ${input.currency} — المتبقي: ${round2(totalRemaining)} ${input.currency}.`,
      `فروقات الأجر المسجل مقابل الأجر الفعلي: ${round2(totalDifference)} ${input.currency}.`,
    );
  }

  // الفروقات والانقطاعات
  if (applicable) {
    if (unregisteredMonths)
      warnings.push(`يوجد ${unregisteredMonths} شهراً غير مسجل في التأمينات الاجتماعية.`);
    if (partialMonths) warnings.push(`يوجد ${partialMonths} شهراً بتسجيل ناقص.`);
    if (suspendedMonths) warnings.push(`يوجد ${suspendedMonths} شهراً موقوف الاشتراك فيه.`);
    if (missingProofMonths)
      warnings.push(
        `تم تسجيل وجود سداد دون مستند مؤيد في ${missingProofMonths} شهراً، وقد يتطلب ذلك التحقق عند المراجعة القانونية.`,
      );
    if (totalDifference > 0)
      warnings.push(
        "يوجد اختلاف بين الأجر الفعلي والأجر المسجل في التأمينات، ما ينتج عنه فروقات اشتراكات تحتاج إلى مراجعة.",
      );
    if (input.registrationDate && input.serviceStart && input.registrationDate > input.serviceStart)
      warnings.push("تاريخ التسجيل في التأمينات لاحق لتاريخ بدء الخدمة (تسجيل متأخر).");
    if (input.coverageEnd && input.serviceEnd && input.coverageEnd < input.serviceEnd)
      warnings.push("تم إلغاء/إنهاء الاشتراك قبل انتهاء علاقة العمل.");
    if (input.registrationStatus === "not_registered")
      warnings.push("حالة التسجيل: لم يتم التسجيل في التأمينات الاجتماعية خلال مدة الخدمة.");
    const rateSet = new Set(results.filter((r) => r.counted).map((r) => `${r.employeeRate}-${r.employerRate}`));
    if (rateSet.size > 1)
      warnings.push("تغيّرت نسب الاشتراك النظامية خلال مدة الخدمة، وتم تطبيق نسبة كل فترة وفق تاريخ سريانها.");
    const wageSet = new Set(results.filter((r) => r.counted).map((r) => r.insurableWage));
    if (wageSet.size > 1)
      warnings.push("تغيّر الأجر الخاضع للاشتراك أثناء الخدمة، وتم إعادة الاحتساب لكل فترة وفق أجرها.");
  }

  return {
    policy,
    applicable,
    exemptByCategory,
    currency: input.currency,
    branches: firstSched?.branches ?? [],
    employeeRate: firstSched?.employee_rate ?? 0,
    employerRate: firstSched?.employer_rate ?? 0,
    baseInsurableWage: clampInsurable(input.baseInsurableWage, policy),
    months: results,
    monthsCount: results.length,
    countedMonths: results.filter((r) => r.counted).length,
    unregisteredMonths,
    partialMonths,
    suspendedMonths,
    missingProofMonths,
    totalDue: round2(totalDue),
    totalEmployee: round2(totalEmployee),
    totalEmployer: round2(totalEmployer),
    totalPaid: round2(totalPaid),
    totalRemaining: round2(totalRemaining),
    totalDifference: round2(totalDifference),
    monthlyEmployee: round2(clampInsurable(input.baseInsurableWage, policy) * (firstSched?.employee_rate ?? 0)),
    monthlyEmployer: round2(clampInsurable(input.baseInsurableWage, policy) * (firstSched?.employer_rate ?? 0)),
    warnings,
    steps,
  };
}

export type SIAnalysis = ReturnType<typeof analyzeSocialInsurance>;

/* ============================ التحقق ============================ */

export function validateSocialInsurance(
  input: SIInput & { analysis: SIAnalysis },
): string[] {
  const e: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  if (input.isSubject !== "yes") return e;

  if (!input.registrationDate && input.registrationStatus !== "not_registered")
    e.push("تاريخ التسجيل في التأمينات مطلوب.");
  if (input.registrationDate && input.registrationDate > today)
    e.push("تاريخ التسجيل لا يمكن أن يكون في المستقبل.");
  if (input.coverageStart && input.registrationDate && input.coverageStart < input.registrationDate)
    e.push("تاريخ بدء الاشتراك لا يمكن أن يكون قبل تاريخ التسجيل.");
  if (input.coverageStart && input.coverageEnd && input.coverageEnd < input.coverageStart)
    e.push("تاريخ انتهاء الاشتراك لا يمكن أن يكون قبل تاريخ بدء الاشتراك.");
  if (input.coverageStart && input.coverageStart > today)
    e.push("تاريخ بدء الاشتراك لا يمكن أن يكون في المستقبل.");

  const policy = input.analysis.policy;
  input.months.forEach((row, i) => {
    const res = input.analysis.months[i];
    const label = `${monthName(row.month)} ${row.year}`;
    if (Number(row.actual_wage) < 0) e.push(`${label}: الأجر لا يمكن أن يكون سالباً.`);
    if (
      policy.max_insurable_wage > 0 &&
      Number(row.registered_wage) > policy.max_insurable_wage
    )
      e.push(
        `${label}: الأجر المسجل يتجاوز الحد الأعلى للأجر التأميني (${policy.max_insurable_wage}).`,
      );
    if (row.payment_status !== "unpaid" && !row.payment_date)
      e.push(`${label}: تاريخ السداد مطلوب عند اختيار السداد.`);
    if (row.payment_date && row.payment_date > today)
      e.push(`${label}: تاريخ السداد لا يمكن أن يكون في المستقبل.`);
    if (row.payment_status === "partial" && !(Number(row.paid_amount) > 0))
      e.push(`${label}: يجب إدخال قيمة السداد الجزئي.`);
    if (res && Number(row.paid_amount) > res.total + 0.01)
      e.push(`${label}: قيمة السداد تتجاوز قيمة الاشتراك المستحق.`);
  });

  const keys = input.months.map((m) => m.key);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dup.length) e.push(`توجد أشهر مكررة: ${[...new Set(dup)].join(", ")}`);

  return e;
}
