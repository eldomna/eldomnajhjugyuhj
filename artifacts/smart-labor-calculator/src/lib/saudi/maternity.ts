// PART 1H — الحمل، الأمومة، وساعة الرضاعة
// محرك مستقل لا يمس محركات الحساب القائمة، وجميع القيم تُحمّل من محرك القوانين.

/* ============================ السياسات ============================ */

export type MaternityWageStep = { min_service_years: number; rate: number };

export type MaternityPolicy = {
  total_days: number;
  pre_delivery_days: number;
  wage_rate: number;
  wage_rate_scale: MaternityWageStep[];
  max_extension_days: number;
  extension_paid: boolean;
  complication_extra_days: number;
  multiple_birth_extra_days: number;
  newborn_death_extra_days: number;
  termination_protected: boolean;
  protection_window_days: number;
  wage_basis: string;
  requires_medical_report: boolean;
  legal_basis: string;
};

export const DEFAULT_MATERNITY_POLICY: MaternityPolicy = {
  total_days: 84,
  pre_delivery_days: 28,
  wage_rate: 1,
  wage_rate_scale: [
    { min_service_years: 0, rate: 0.5 },
    { min_service_years: 1, rate: 0.5 },
    { min_service_years: 3, rate: 1 },
  ],
  max_extension_days: 30,
  extension_paid: false,
  complication_extra_days: 30,
  multiple_birth_extra_days: 0,
  newborn_death_extra_days: 0,
  termination_protected: true,
  protection_window_days: 180,
  wage_basis: "last_actual_wage",
  requires_medical_report: true,
  legal_basis: "المواد 151 و152 و155 من نظام العمل السعودي",
};

export type NursingPolicy = {
  daily_reduction_hours: number;
  eligible_months: number;
  paid: boolean;
  can_accumulate: boolean;
  starts_from: string;
  legal_basis: string;
};

export const DEFAULT_NURSING_POLICY: NursingPolicy = {
  daily_reduction_hours: 1,
  eligible_months: 6,
  paid: true,
  can_accumulate: true,
  starts_from: "return_to_work",
  legal_basis: "المادة 151 من نظام العمل السعودي واللائحة التنفيذية",
};

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
const bool = (v: unknown, d: boolean) => (v == null ? d : !!v);

export function toMaternityPolicy(value: unknown): MaternityPolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const scale = Array.isArray(v.wage_rate_scale)
    ? (v.wage_rate_scale as any[])
        .map((s) => ({
          min_service_years: num(s?.min_service_years, 0),
          rate: num(s?.rate, 0),
        }))
        .sort((a, b) => a.min_service_years - b.min_service_years)
    : DEFAULT_MATERNITY_POLICY.wage_rate_scale;
  const d = DEFAULT_MATERNITY_POLICY;
  return {
    total_days: num(v.total_days, d.total_days),
    pre_delivery_days: num(v.pre_delivery_days, d.pre_delivery_days),
    wage_rate: num(v.wage_rate, d.wage_rate),
    wage_rate_scale: scale.length ? scale : d.wage_rate_scale,
    max_extension_days: num(v.max_extension_days, d.max_extension_days),
    extension_paid: bool(v.extension_paid, d.extension_paid),
    complication_extra_days: num(v.complication_extra_days, d.complication_extra_days),
    multiple_birth_extra_days: num(v.multiple_birth_extra_days, d.multiple_birth_extra_days),
    newborn_death_extra_days: num(v.newborn_death_extra_days, d.newborn_death_extra_days),
    termination_protected: bool(v.termination_protected, d.termination_protected),
    protection_window_days: num(v.protection_window_days, d.protection_window_days),
    wage_basis: str(v.wage_basis, d.wage_basis),
    requires_medical_report: bool(v.requires_medical_report, d.requires_medical_report),
    legal_basis: str(v.legal_basis, d.legal_basis),
  };
}

export function toNursingPolicy(value: unknown): NursingPolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const d = DEFAULT_NURSING_POLICY;
  return {
    daily_reduction_hours: num(v.daily_reduction_hours, d.daily_reduction_hours),
    eligible_months: num(v.eligible_months, d.eligible_months),
    paid: bool(v.paid, d.paid),
    can_accumulate: bool(v.can_accumulate, d.can_accumulate),
    starts_from: str(v.starts_from, d.starts_from),
    legal_basis: str(v.legal_basis, d.legal_basis),
  };
}

/* ============================ القوائم ============================ */

export type MaternityPaymentStatus = "unpaid" | "paid" | "partial";

export const MATERNITY_PAYMENT_STATUSES: { value: MaternityPaymentStatus; label: string }[] = [
  { value: "unpaid", label: "لا (لم يُصرف)" },
  { value: "paid", label: "نعم (تم الصرف)" },
  { value: "partial", label: "صرف جزئي" },
];

export const DELIVERY_TYPES = [
  { value: "", label: "غير محدد" },
  { value: "natural", label: "طبيعية" },
  { value: "cesarean", label: "قيصرية" },
  { value: "other", label: "أخرى" },
] as const;

export const MULTIPLE_BIRTH_OPTIONS = [
  { value: "single", label: "مولود واحد" },
  { value: "twins", label: "توأم" },
  { value: "triplets_plus", label: "ثلاثة أطفال أو أكثر" },
] as const;

export const MATERNITY_DOCUMENT_TYPES = [
  "تقرير طبي",
  "إشعار ولادة",
  "شهادة ميلاد",
  "مستند آخر",
] as const;

export const MATERNITY_PAYMENT_METHODS = [
  "تحويل بنكي",
  "مسير رواتب",
  "شيك",
  "نقداً",
  "سند قبض",
  "مستند آخر",
] as const;

export const MATERNITY_WAGE_BASES: { value: string; label: string }[] = [
  { value: "last_actual_wage", label: "آخر أجر فعلي" },
  { value: "wage_at_leave_date", label: "الأجر وقت بداية الإجازة" },
  { value: "country_rule", label: "القاعدة القانونية للدولة المختارة" },
];

export const TERMINATION_PARTIES = [
  { value: "employer", label: "صاحب العمل" },
  { value: "employee", label: "العاملة" },
  { value: "mutual", label: "اتفاق الطرفين" },
  { value: "contract_end", label: "انتهاء مدة العقد" },
] as const;

/* ============================ الصفوف ============================ */

export type MaternityLeaveRow = {
  id?: string;
  contract_id: string;
  leave_start: string;
  leave_end: string;
  return_to_work_date: string;
  days: number | "";
  extended: boolean;
  extension_reason: string;
  extension_days: number | "";
  has_document: boolean;
  medical_report_file: string;
  payment_status: MaternityPaymentStatus;
  paid_amount: number | "";
  payment_method: string;
  payment_date: string;
  payment_proof_file: string;
  notes: string;
};

export const emptyMaternityLeave = (): MaternityLeaveRow => ({
  contract_id: "",
  leave_start: "",
  leave_end: "",
  return_to_work_date: "",
  days: "",
  extended: false,
  extension_reason: "",
  extension_days: "",
  has_document: false,
  medical_report_file: "",
  payment_status: "unpaid",
  paid_amount: "",
  payment_method: "",
  payment_date: "",
  payment_proof_file: "",
  notes: "",
});

export type NursingRow = {
  id?: string;
  delivery_date: string;
  return_to_work_date: string;
  nursing_start_date: string;
  nursing_end_date: string;
  daily_working_hours: number | "";
  notes: string;
};

export const emptyNursingRow = (): NursingRow => ({
  delivery_date: "",
  return_to_work_date: "",
  nursing_start_date: "",
  nursing_end_date: "",
  daily_working_hours: 8,
  notes: "",
});

/* ============================ أدوات ============================ */

const DAY = 86400000;
const n = (v: number | "" | null | undefined) => (v === "" || v == null ? 0 : Number(v) || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const toDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const today = () => new Date().toISOString().slice(0, 10);

export function inclusiveDays(start?: string | null, end?: string | null): number {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return 0;
  const d = Math.floor((b.getTime() - a.getTime()) / DAY) + 1;
  return d > 0 ? d : 0;
}

export function addDays(date: string, days: number): string {
  const d = toDate(date);
  if (!d) return "";
  return iso(new Date(d.getTime() + days * DAY));
}

export function addMonths(date: string, months: number): string {
  const d = toDate(date);
  if (!d) return "";
  const c = new Date(d.getTime());
  c.setMonth(c.getMonth() + months);
  return iso(c);
}

/** نسبة الأجر النظامية بحسب مدة الخدمة (تُحمّل من محرك القوانين) */
export function wageRateForService(policy: MaternityPolicy, serviceYears: number): number {
  const scale = policy.wage_rate_scale ?? [];
  if (!scale.length) return policy.wage_rate;
  let rate = policy.wage_rate;
  for (const s of scale) {
    if (serviceYears >= s.min_service_years) rate = s.rate;
  }
  return rate;
}

/* ============================ تحليل الأمومة ============================ */

export type MaternityLeaveResult = {
  index: number;
  start: string;
  end: string;
  days: number;
  legalDays: number;
  excessDays: number;
  extensionDays: number;
  paidExtensionDays: number;
  payableDays: number;
  rate: number;
  due: number;
  paid: number;
  excluded: number;
  remaining: number;
  proven: boolean;
  status: MaternityPaymentStatus;
};

export type NursingResult = {
  index: number;
  start: string;
  end: string;
  days: number;
  dailyReductionHours: number;
  totalReductionHours: number;
  paid: boolean;
  status: string;
};

export type ProtectionAnalysis = {
  applies: boolean;
  prohibited: boolean;
  protectedUntil: string | null;
  messages: string[];
};

export type MaternityAnalysis = {
  applicable: boolean;
  dailyWage: number;
  currency: string;
  policy: MaternityPolicy;
  nursingPolicy: NursingPolicy;
  serviceYears: number;
  legalRate: number;
  legalTotalDays: number;
  leaves: MaternityLeaveResult[];
  nursing: NursingResult[];
  totalDays: number;
  totalDue: number;
  totalPaid: number;
  excludedAmount: number;
  remainingAmount: number;
  nursingDays: number;
  nursingHours: number;
  protection: ProtectionAnalysis;
  warnings: string[];
  steps: string[];
};

export type MaternityInput = {
  gender: string;
  hadPregnancy: boolean;
  deliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  earlyDelivery?: boolean;
  multipleBirth?: string;
  newbornDeceased?: boolean;
  medicalComplications?: boolean;
  hasMedicalDocument?: boolean;
  endedDuringProtection?: boolean;
  terminationDate?: string | null;
  terminationParty?: string;
  terminationReason?: string;
  hasTerminationProof?: boolean;
  wageChanged?: boolean;
  wageBasis?: string;
  returnedToWork?: boolean;
  isNursing?: boolean;
  leaves: MaternityLeaveRow[];
  nursing: NursingRow[];
  dailyWage: number;
  currency: string;
  policy?: MaternityPolicy;
  nursingPolicy?: NursingPolicy;
  serviceYears?: number;
  serviceStart?: string | null;
  serviceEnd?: string | null;
};

export function analyzeMaternity(args: MaternityInput): MaternityAnalysis {
  const policy = args.policy ?? DEFAULT_MATERNITY_POLICY;
  const nursingPolicy = args.nursingPolicy ?? DEFAULT_NURSING_POLICY;
  const currency = args.currency || "SAR";
  const dailyWage = r2(Math.max(0, args.dailyWage || 0));
  const serviceYears = Math.max(0, args.serviceYears ?? 0);
  const legalRate = wageRateForService(policy, serviceYears);
  const applicable = args.gender === "female";

  const warnings: string[] = [];
  const steps: string[] = [];

  const extraDays =
    (args.medicalComplications ? policy.complication_extra_days : 0) +
    (args.multipleBirth === "twins" || args.multipleBirth === "triplets_plus"
      ? policy.multiple_birth_extra_days
      : 0) +
    (args.newbornDeceased ? policy.newborn_death_extra_days : 0);
  const legalTotalDays = policy.total_days + extraDays;

  steps.push(
    `سياسة الأمومة المحمّلة من محرك القوانين: مدة الإجازة ${policy.total_days} يوم` +
      (extraDays > 0 ? ` + ${extraDays} يوم لحالات خاصة = ${legalTotalDays} يوم` : "") +
      ` — الأساس النظامي: ${policy.legal_basis}`,
  );
  steps.push(
    `نسبة الأجر النظامية بحسب مدة الخدمة (${r2(serviceYears)} سنة) = ${Math.round(legalRate * 100)}%`,
  );
  steps.push(`الأجر اليومي = الأجر الفعلي ÷ 30 = ${dailyWage} ${currency}`);

  const leaves: MaternityLeaveResult[] = [];
  const rows = applicable && args.hadPregnancy ? args.leaves : [];

  rows.forEach((r, i) => {
    const declared = n(r.days) || inclusiveDays(r.leave_start, r.leave_end);
    const extension = r.extended ? n(r.extension_days) : 0;
    const legalDays = Math.min(declared, legalTotalDays);
    const excessDays = Math.max(0, declared - legalTotalDays);
    const paidExtensionDays = policy.extension_paid
      ? Math.min(extension, policy.max_extension_days)
      : 0;
    const payableDays = legalDays + paidExtensionDays;
    const due = r2(payableDays * dailyWage * legalRate);
    const paid = r.payment_status === "unpaid" ? 0 : r2(n(r.paid_amount));
    const proven = !!r.payment_proof_file && r.payment_status !== "unpaid";
    const excluded = proven ? r2(Math.min(paid, due)) : 0;
    const remaining = r2(Math.max(0, due - excluded));

    steps.push(
      `إجازة الأمومة ${i + 1}: ${payableDays} يوم × ${dailyWage} × ${Math.round(
        legalRate * 100,
      )}% = ${due} ${currency}`,
    );

    if (excessDays > 0) {
      warnings.push(
        `إجازة الأمومة ${i + 1}: ${excessDays} يوم تجاوزت الحد النظامي (${legalTotalDays} يوم) ولا تُحتسب بأجر الأمومة.`,
      );
    }
    if (r.extended && extension > policy.max_extension_days) {
      warnings.push(
        `إجازة الأمومة ${i + 1}: أيام التمديد (${extension}) تتجاوز الحد النظامي للتمديد (${policy.max_extension_days} يوم).`,
      );
    }
    if (r.extended && !policy.extension_paid) {
      warnings.push(
        `إجازة الأمومة ${i + 1}: التمديد غير مدفوع الأجر وفق قاعدة الدولة المختارة، ولم يُحتسب مالياً.`,
      );
    }
    if (!r.has_document && policy.requires_medical_report) {
      warnings.push(
        `إجازة الأمومة ${i + 1}: لا يوجد مستند مؤيد للإجازة، وقد يؤثر ذلك على بعض الحقوق النظامية وفقاً للقانون المطبق.`,
      );
    }
    if (r.payment_status !== "unpaid" && !r.payment_proof_file) {
      warnings.push(
        `إجازة الأمومة ${i + 1}: تم إدخال وجود صرف دون إثبات، وقد يكون محل نظر أمام الجهة القضائية.`,
      );
    }
    if (args.deliveryDate && r.leave_start && r.leave_start > args.deliveryDate) {
      const gap = inclusiveDays(args.deliveryDate, r.leave_start) - 1;
      if (gap > policy.pre_delivery_days) {
        warnings.push(
          `إجازة الأمومة ${i + 1}: بداية الإجازة لا تتوافق مع تاريخ الولادة وفق قاعدة توزيع المدة (${policy.pre_delivery_days} يوم قبل الوضع).`,
        );
      }
    }

    leaves.push({
      index: i,
      start: r.leave_start,
      end: r.leave_end,
      days: declared,
      legalDays,
      excessDays,
      extensionDays: extension,
      paidExtensionDays,
      payableDays,
      rate: legalRate,
      due,
      paid,
      excluded,
      remaining,
      proven,
      status: r.payment_status,
    });
  });

  if (!args.hasMedicalDocument && applicable && args.hadPregnancy) {
    warnings.push(
      "لا يوجد مستند مؤيد للحمل أو الولادة، وقد يؤثر ذلك على بعض الحقوق النظامية وفقاً للقانون المطبق.",
    );
  }
  if (args.wageChanged) {
    warnings.push(
      `تغيّر الأجر أثناء إجازة الأمومة: تم اعتماد ${
        MATERNITY_WAGE_BASES.find((w) => w.value === (args.wageBasis ?? policy.wage_basis))?.label ??
        policy.wage_basis
      } في الاحتساب وفق قاعدة الدولة المختارة.`,
    );
  }
  if (args.multipleBirth === "twins" || args.multipleBirth === "triplets_plus") {
    warnings.push(
      policy.multiple_birth_extra_days > 0
        ? `الحمل المتعدد: تمت إضافة ${policy.multiple_birth_extra_days} يوم وفق قاعدة الدولة المختارة.`
        : "الحمل المتعدد: لا توجد أيام إضافية مقررة في قواعد الدولة المختارة حالياً.",
    );
  }
  if (args.newbornDeceased && policy.newborn_death_extra_days > 0) {
    warnings.push(
      `وفاة المولود: تمت إضافة ${policy.newborn_death_extra_days} يوم وفق قاعدة الدولة المختارة.`,
    );
  }
  if (args.medicalComplications && policy.complication_extra_days > 0) {
    warnings.push(
      `المضاعفات الطبية: تمت إضافة ${policy.complication_extra_days} يوم وفق قاعدة الدولة المختارة.`,
    );
  }

  /* ------------------ ساعة الرضاعة ------------------ */
  const nursingRows =
    applicable && args.returnedToWork && args.isNursing ? args.nursing : [];
  const nursing: NursingResult[] = nursingRows.map((r, i) => {
    const base =
      nursingPolicy.starts_from === "delivery" ? r.delivery_date : r.return_to_work_date;
    const start = r.nursing_start_date || base || "";
    const legalEnd = r.delivery_date
      ? addMonths(r.delivery_date, nursingPolicy.eligible_months)
      : start
        ? addMonths(start, nursingPolicy.eligible_months)
        : "";
    let end = r.nursing_end_date || legalEnd;
    if (legalEnd && end > legalEnd) {
      warnings.push(
        `ساعة الرضاعة ${i + 1}: تاريخ الانتهاء يتجاوز مدة الاستفادة النظامية (${nursingPolicy.eligible_months} أشهر)، وتم اعتماد الحد النظامي.`,
      );
      end = legalEnd;
    }
    const days = inclusiveDays(start, end);
    const reduction = nursingPolicy.daily_reduction_hours;
    const dailyHours = n(r.daily_working_hours) || 8;
    if (reduction >= dailyHours) {
      warnings.push(
        `ساعة الرضاعة ${i + 1}: ساعات التخفيض تساوي أو تتجاوز ساعات العمل اليومية المدخلة.`,
      );
    }
    return {
      index: i,
      start,
      end,
      days,
      dailyReductionHours: reduction,
      totalReductionHours: r2(days * reduction),
      paid: nursingPolicy.paid,
      status: days > 0 ? "مستحقة" : "غير مكتملة البيانات",
    };
  });

  if (nursingRows.length) {
    steps.push(
      `سياسة ساعة الرضاعة: ${nursingPolicy.daily_reduction_hours} ساعة يومياً لمدة ${nursingPolicy.eligible_months} أشهر — ${
        nursingPolicy.paid ? "مدفوعة الأجر" : "غير مدفوعة الأجر"
      } — ${nursingPolicy.legal_basis}`,
    );
    nursing.forEach((x, i) =>
      steps.push(
        `ساعة الرضاعة ${i + 1}: من ${x.start || "—"} إلى ${x.end || "—"} = ${x.days} يوم × ${
          x.dailyReductionHours
        } ساعة = ${x.totalReductionHours} ساعة تخفيض`,
      ),
    );
  }

  /* ------------------ الحماية النظامية ------------------ */
  const protectedUntil = args.deliveryDate
    ? addDays(args.deliveryDate, policy.protection_window_days)
    : null;
  const protectionMessages: string[] = [];
  let prohibited = false;
  if (applicable && args.hadPregnancy && args.endedDuringProtection) {
    if (policy.termination_protected) {
      prohibited =
        !args.terminationDate ||
        !protectedUntil ||
        args.terminationDate <= protectedUntil;
      protectionMessages.push(
        prohibited
          ? `يوجد حظر نظامي على إنهاء العلاقة العمالية أثناء الحمل أو إجازة الأمومة${
              protectedUntil ? ` وحتى ${protectedUntil}` : ""
            } وفق ${policy.legal_basis}، وقد ينشأ تعويض إضافي عن الإنهاء غير النظامي.`
          : "تاريخ الإنهاء يقع خارج نطاق الحماية النظامية المقررة للدولة المختارة.",
      );
      if (args.terminationParty === "employer" && prohibited) {
        protectionMessages.push(
          "الإنهاء صادر من صاحب العمل خلال فترة الحماية: يُعد مخالفة لنظام العمل ويُرحّل إلى محرك الحساب والتقرير النهائي كحق تعويضي.",
        );
      }
      if (!args.hasTerminationProof) {
        protectionMessages.push(
          "لا توجد مستندات مؤيدة لإنهاء العلاقة العمالية، ويُنصح برفعها لتقوية المطالبة.",
        );
      }
    } else {
      protectionMessages.push(
        "لا توجد حماية خاصة من الإنهاء في قواعد الدولة المختارة لهذه الحالة.",
      );
    }
    warnings.push(...protectionMessages);
  }

  const totalDays = leaves.reduce((s, l) => s + l.days, 0);
  const totalDue = r2(leaves.reduce((s, l) => s + l.due, 0));
  const totalPaid = r2(leaves.reduce((s, l) => s + l.paid, 0));
  const excludedAmount = r2(leaves.reduce((s, l) => s + l.excluded, 0));
  const remainingAmount = r2(leaves.reduce((s, l) => s + l.remaining, 0));
  const nursingDays = nursing.reduce((s, x) => s + x.days, 0);
  const nursingHours = r2(nursing.reduce((s, x) => s + x.totalReductionHours, 0));

  steps.push(`إجمالي مستحق إجازة الأمومة = ${totalDue} ${currency}`);
  steps.push(`المبالغ المستبعدة (مصروفة بإثبات) = ${excludedAmount} ${currency}`);
  steps.push(`المتبقي المستحق = ${remainingAmount} ${currency}`);

  return {
    applicable,
    dailyWage,
    currency,
    policy,
    nursingPolicy,
    serviceYears,
    legalRate,
    legalTotalDays,
    leaves,
    nursing,
    totalDays,
    totalDue,
    totalPaid,
    excludedAmount,
    remainingAmount,
    nursingDays,
    nursingHours,
    protection: {
      applies: applicable && args.hadPregnancy,
      prohibited,
      protectedUntil,
      messages: protectionMessages,
    },
    warnings,
    steps,
  };
}

/* ============================ التحقق ============================ */

export function validateMaternity(args: MaternityInput & { analysis: MaternityAnalysis }): string[] {
  const errors: string[] = [];
  const t = today();
  if (args.gender !== "female") return errors;

  if (args.hadPregnancy) {
    if (!args.deliveryDate) errors.push("تاريخ الولادة مطلوب.");
    if (args.deliveryDate && args.deliveryDate > t)
      errors.push("تاريخ الولادة لا يمكن أن يكون مستقبلياً.");
    if (
      args.actualDeliveryDate &&
      args.deliveryDate &&
      args.actualDeliveryDate < args.deliveryDate
    )
      errors.push("تاريخ الوضع الفعلي لا يمكن أن يكون قبل تاريخ الولادة المدخل.");

    if (!args.leaves.length) errors.push("أضف إجازة أمومة واحدة على الأقل.");

    args.leaves.forEach((r, i) => {
      const label = `إجازة الأمومة ${i + 1}`;
      if (!r.leave_start) errors.push(`${label}: تاريخ بداية الإجازة مطلوب.`);
      if (!r.leave_end) errors.push(`${label}: تاريخ نهاية الإجازة مطلوب.`);
      if (r.leave_start && r.leave_end && r.leave_end < r.leave_start)
        errors.push(`${label}: تاريخ النهاية قبل تاريخ البداية.`);
      if (r.leave_start > t || r.leave_end > t)
        errors.push(`${label}: لا يمكن إدخال تاريخ مستقبلي.`);
      if (n(r.days) <= 0) errors.push(`${label}: عدد أيام الإجازة يجب أن يكون أكبر من صفر.`);
      if (
        r.return_to_work_date &&
        r.leave_end &&
        r.return_to_work_date < r.leave_end
      )
        errors.push(`${label}: تاريخ العودة للعمل قبل نهاية الإجازة.`);
      if (r.extended && n(r.extension_days) <= 0)
        errors.push(`${label}: عدد أيام التمديد مطلوب.`);
      if (r.extended && !r.extension_reason.trim())
        errors.push(`${label}: سبب التمديد مطلوب.`);
      if (r.payment_status !== "unpaid" && n(r.paid_amount) <= 0)
        errors.push(`${label}: قيمة المبلغ المصروف مطلوبة.`);
      if (r.payment_status !== "unpaid" && !r.payment_method)
        errors.push(`${label}: طريقة الصرف مطلوبة.`);
      if (r.payment_status !== "unpaid" && r.payment_date && r.payment_date > t)
        errors.push(`${label}: تاريخ الصرف لا يمكن أن يكون مستقبلياً.`);
    });

    // تداخل فترات الإجازات
    for (let i = 0; i < args.leaves.length; i += 1) {
      for (let j = i + 1; j < args.leaves.length; j += 1) {
        const a = args.leaves[i];
        const b = args.leaves[j];
        if (!a.leave_start || !a.leave_end || !b.leave_start || !b.leave_end) continue;
        if (a.leave_start <= b.leave_end && b.leave_start <= a.leave_end)
          errors.push(`تداخل بين إجازة الأمومة ${i + 1} وإجازة الأمومة ${j + 1}.`);
      }
    }

    if (args.endedDuringProtection) {
      if (!args.terminationDate) errors.push("تاريخ إنهاء العلاقة العمالية مطلوب.");
      if (args.terminationDate && args.terminationDate > t)
        errors.push("تاريخ الإنهاء لا يمكن أن يكون مستقبلياً.");
      if (!args.terminationReason?.trim()) errors.push("سبب انتهاء العلاقة مطلوب.");
      if (!args.terminationParty) errors.push("الجهة التي أنهت العلاقة مطلوبة.");
    }
  }

  if (args.returnedToWork && args.isNursing) {
    if (!args.nursing.length) errors.push("أضف سجل ساعة رضاعة واحداً على الأقل.");
    args.nursing.forEach((r, i) => {
      const label = `ساعة الرضاعة ${i + 1}`;
      if (!r.delivery_date) errors.push(`${label}: تاريخ الولادة مطلوب.`);
      if (!r.return_to_work_date) errors.push(`${label}: تاريخ العودة للعمل مطلوب.`);
      if (r.delivery_date && r.delivery_date > t)
        errors.push(`${label}: تاريخ الولادة مستقبلي.`);
      if (
        r.return_to_work_date &&
        r.delivery_date &&
        r.return_to_work_date < r.delivery_date
      )
        errors.push(`${label}: تاريخ العودة للعمل قبل تاريخ الولادة.`);
      if (
        r.nursing_end_date &&
        r.delivery_date &&
        r.nursing_end_date < r.delivery_date
      )
        errors.push(`${label}: لا يمكن انتهاء فترة الرضاعة قبل تاريخ الولادة.`);
      if (
        r.nursing_start_date &&
        r.nursing_end_date &&
        r.nursing_end_date < r.nursing_start_date
      )
        errors.push(`${label}: تاريخ انتهاء الرضاعة قبل تاريخ بدايتها.`);
      if (n(r.daily_working_hours) <= 0)
        errors.push(`${label}: عدد ساعات العمل اليومية مطلوب.`);
    });

    for (let i = 0; i < args.nursing.length; i += 1) {
      for (let j = i + 1; j < args.nursing.length; j += 1) {
        const a = args.analysis.nursing[i];
        const b = args.analysis.nursing[j];
        if (!a?.start || !a?.end || !b?.start || !b?.end) continue;
        if (a.start <= b.end && b.start <= a.end)
          errors.push(
            `تداخل بين فترتي ساعة الرضاعة ${i + 1} و${j + 1} — لا يمكن احتساب نفس الفترة مرتين.`,
          );
      }
    }
  }

  return errors;
}
