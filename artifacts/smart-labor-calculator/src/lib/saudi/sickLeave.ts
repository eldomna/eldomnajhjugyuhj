// PART 1G — الإجازة المرضية
// محرك مستقل لا يعدّل محركي الحساب القائمين، ويعتمد قواعد قابلة للتحديث من محرك القوانين.

export type SickTier = { from: number; to: number; rate: number };

export type SickPolicy = {
  tiers: SickTier[];
  annual_max_days: number;
  requires_medical_report: boolean;
  year_reset: string;
  wage_basis: string;
  service_end_during_leave: string;
  aggregate_across_leaves: boolean;
};

export const DEFAULT_SICK_POLICY: SickPolicy = {
  tiers: [
    { from: 1, to: 30, rate: 1 },
    { from: 31, to: 90, rate: 0.75 },
    { from: 91, to: 120, rate: 0 },
  ],
  annual_max_days: 120,
  requires_medical_report: true,
  year_reset: "rolling_year",
  wage_basis: "last_actual_wage",
  service_end_during_leave: "pay_until_end_date",
  aggregate_across_leaves: true,
};

export function toSickPolicy(value: unknown): SickPolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const tiers = Array.isArray(v.tiers)
    ? (v.tiers as any[])
        .map((t) => ({
          from: Number(t?.from) || 0,
          to: Number(t?.to) || 0,
          rate: Number(t?.rate) || 0,
        }))
        .filter((t) => t.to >= t.from && t.from > 0)
        .sort((a, b) => a.from - b.from)
    : DEFAULT_SICK_POLICY.tiers;
  const num = (k: string, d: number) => (Number.isFinite(Number(v[k])) ? Number(v[k]) : d);
  const str = (k: string, d: string) => (typeof v[k] === "string" ? (v[k] as string) : d);
  return {
    tiers: tiers.length ? tiers : DEFAULT_SICK_POLICY.tiers,
    annual_max_days: num("annual_max_days", DEFAULT_SICK_POLICY.annual_max_days),
    requires_medical_report:
      v.requires_medical_report == null ? true : !!v.requires_medical_report,
    year_reset: str("year_reset", DEFAULT_SICK_POLICY.year_reset),
    wage_basis: str("wage_basis", DEFAULT_SICK_POLICY.wage_basis),
    service_end_during_leave: str(
      "service_end_during_leave",
      DEFAULT_SICK_POLICY.service_end_during_leave,
    ),
    aggregate_across_leaves:
      v.aggregate_across_leaves == null ? true : !!v.aggregate_across_leaves,
  };
}

/* ============================ الأنواع ============================ */

export type SickPaymentStatus = "unpaid" | "paid" | "partial";

export const SICK_PAYMENT_STATUSES: { value: SickPaymentStatus; label: string }[] = [
  { value: "unpaid", label: "لا (لم يُصرف)" },
  { value: "paid", label: "نعم (تم الصرف)" },
  { value: "partial", label: "صرف جزئي" },
];

export const SICK_LEAVE_KINDS = [
  { value: "sick", label: "إجازة مرضية" },
  { value: "work_injury", label: "إصابة عمل" },
  { value: "surgery", label: "عملية جراحية" },
  { value: "chronic", label: "مرض مزمن" },
  { value: "quarantine", label: "حجر صحي" },
  { value: "other", label: "أخرى" },
] as const;

export const MEDICAL_REPORT_TYPES = [
  "تقرير طبي PDF",
  "صورة التقرير",
  "تقرير إلكتروني",
  "مستند آخر",
] as const;

export const SICK_PAYMENT_METHODS = [
  "تحويل بنكي",
  "مسير رواتب",
  "شيك",
  "نقداً",
  "سند قبض",
  "مستند آخر",
] as const;

export const SICK_WAGE_BASES: { value: string; label: string }[] = [
  { value: "last_actual_wage", label: "آخر أجر فعلي" },
  { value: "wage_at_leave_date", label: "الأجر وقت الإجازة" },
  { value: "country_rule", label: "القاعدة القانونية للدولة المختارة" },
];

export type SickLeaveRow = {
  id?: string;
  contract_id: string;
  start_date: string;
  end_date: string;
  days: number | "";
  leave_kind: string;
  illness_reason: string;
  medical_provider: string;
  medical_report_number: string;
  has_medical_report: boolean;
  medical_report_type: string;
  medical_report_file: string;
  payment_status: SickPaymentStatus;
  paid_amount: number | "";
  payment_method: string;
  payment_date: string;
  proof_type: string;
  proof_file: string;
  notes: string;
};

export const emptySickLeave = (): SickLeaveRow => ({
  contract_id: "",
  start_date: "",
  end_date: "",
  days: "",
  leave_kind: "sick",
  illness_reason: "",
  medical_provider: "",
  medical_report_number: "",
  has_medical_report: false,
  medical_report_type: "",
  medical_report_file: "",
  payment_status: "unpaid",
  paid_amount: "",
  payment_method: "",
  payment_date: "",
  proof_type: "",
  proof_file: "",
  notes: "",
});

const DAY = 86400000;
const n = (v: number | "" | null | undefined) => (v === "" || v == null ? 0 : Number(v) || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const toDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function inclusiveDays(start?: string | null, end?: string | null): number {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return 0;
  const d = Math.floor((b.getTime() - a.getTime()) / DAY) + 1;
  return d > 0 ? d : 0;
}

/* ==================== دمج الفترات ومنع التكرار ==================== */

export type MergedPeriod = { start: string; end: string; days: number; sources: number[] };

/** دمج الفترات المتصلة أو المتداخلة وفصل المنفصلة ومنع احتساب اليوم مرتين */
export function mergePeriods(rows: SickLeaveRow[]): MergedPeriod[] {
  const items = rows
    .map((r, i) => ({ i, start: r.start_date, end: r.end_date }))
    .filter((x) => x.start && x.end && inclusiveDays(x.start, x.end) > 0)
    .sort((a, b) => a.start.localeCompare(b.start));
  const out: MergedPeriod[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last) {
      const lastEnd = toDate(last.end)!;
      const curStart = toDate(it.start)!;
      // متصلة أو متداخلة (الفارق يوم واحد أو أقل)
      if (curStart.getTime() - lastEnd.getTime() <= DAY) {
        if (toDate(it.end)!.getTime() > lastEnd.getTime()) last.end = it.end;
        last.days = inclusiveDays(last.start, last.end);
        last.sources.push(it.i);
        continue;
      }
    }
    out.push({
      start: it.start,
      end: it.end,
      days: inclusiveDays(it.start, it.end),
      sources: [it.i],
    });
  }
  return out;
}

export function overlaps(rows: SickLeaveRow[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (!a.start_date || !a.end_date || !b.start_date || !b.end_date) continue;
      if (a.start_date <= b.end_date && b.start_date <= a.end_date) pairs.push([i, j]);
    }
  }
  return pairs;
}

/* ==================== احتساب المراحل ==================== */

export type StageLine = {
  stage: number;
  from: number;
  to: number;
  days: number;
  rate: number;
  amount: number;
  legalBasis: string;
};

/** توزيع الأيام على مراحل السياسة بدءاً من رصيد مستهلك سابقاً */
export function splitStages(
  days: number,
  usedBefore: number,
  policy: SickPolicy,
  dailyWage: number,
): { stages: StageLine[]; excessDays: number; due: number } {
  const stages: StageLine[] = [];
  let remaining = Math.max(0, days);
  let cursor = Math.max(0, usedBefore);
  policy.tiers.forEach((t, idx) => {
    if (remaining <= 0) return;
    const tierEnd = t.to;
    const availableTop = Math.max(0, tierEnd - Math.max(cursor, t.from - 1));
    if (availableTop <= 0) return;
    const take = Math.min(remaining, availableTop);
    if (take <= 0) return;
    const from = Math.max(cursor, t.from - 1) + 1;
    stages.push({
      stage: idx + 1,
      from,
      to: from + take - 1,
      days: take,
      rate: t.rate,
      amount: r2(take * dailyWage * t.rate),
      legalBasis: `المرحلة ${idx + 1}: الأيام ${t.from}–${t.to} بنسبة ${Math.round(t.rate * 100)}% من الأجر`,
    });
    cursor = from + take - 1;
    remaining -= take;
  });
  const due = stages.reduce((s, x) => s + x.amount, 0);
  return { stages, excessDays: remaining, due: r2(due) };
}

/* ==================== التحليل الشامل ==================== */

export type SickLeaveResult = {
  index: number;
  start: string;
  end: string;
  days: number;
  effectiveDays: number;
  duplicateDays: number;
  stages: StageLine[];
  avgRate: number;
  due: number;
  paid: number;
  excluded: number;
  remaining: number;
  proven: boolean;
  status: SickPaymentStatus;
  hasReport: boolean;
  excessDays: number;
};

export type SickAnalysis = {
  dailyWage: number;
  currency: string;
  policy: SickPolicy;
  leaves: SickLeaveResult[];
  merged: MergedPeriod[];
  totalDays: number;
  effectiveDays: number;
  duplicateDays: number;
  totalDue: number;
  totalPaid: number;
  excludedAmount: number;
  remainingAmount: number;
  stageTotals: { stage: number; rate: number; days: number; amount: number }[];
  overMaxDays: number;
  warnings: string[];
  steps: string[];
};

export function analyzeSickLeave(args: {
  rows: SickLeaveRow[];
  dailyWage: number;
  currency: string;
  policy?: SickPolicy;
  serviceStart?: string | null;
  serviceEnd?: string | null;
  endedDuringLeave?: boolean;
  wageChanged?: boolean;
  wageBasis?: string;
}): SickAnalysis {
  const policy = args.policy ?? DEFAULT_SICK_POLICY;
  const dailyWage = r2(Math.max(0, args.dailyWage || 0));
  const currency = args.currency || "SAR";
  const rows = args.rows ?? [];
  const merged = mergePeriods(rows);

  // خصم الأيام المكرّرة: توزيع أيام الفترات المدموجة على السجلات بالترتيب
  const orderIdx = rows
    .map((r, i) => ({ i, start: r.start_date }))
    .filter((x) => !!x.start)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((x) => x.i);

  const covered = new Set<string>();
  const effective: Record<number, number> = {};
  for (const i of orderIdx) {
    const r = rows[i];
    const a = toDate(r.start_date);
    const b = toDate(r.end_date);
    if (!a || !b) {
      effective[i] = 0;
      continue;
    }
    let count = 0;
    for (let t = a.getTime(); t <= b.getTime(); t += DAY) {
      const key = iso(new Date(t));
      if (covered.has(key)) continue;
      covered.add(key);
      count += 1;
    }
    effective[i] = count;
  }

  const warnings: string[] = [];
  const steps: string[] = [];
  steps.push(`الأجر اليومي = الأجر الفعلي ÷ 30 = ${dailyWage} ${currency}`);
  steps.push(
    `سياسة الإجازة المرضية المحمّلة من محرك القوانين: ${policy.tiers
      .map((t) => `${t.from}–${t.to} يوم بنسبة ${Math.round(t.rate * 100)}%`)
      .join(" ، ")} — الحد الأقصى ${policy.annual_max_days} يوم`,
  );

  let usedBefore = 0;
  const leaves: SickLeaveResult[] = [];
  for (const i of orderIdx) {
    const r = rows[i];
    const declared = n(r.days) || inclusiveDays(r.start_date, r.end_date);
    const eff = policy.aggregate_across_leaves
      ? Math.min(declared, effective[i] ?? 0)
      : declared;
    const split = splitStages(eff, policy.aggregate_across_leaves ? usedBefore : 0, policy, dailyWage);
    usedBefore += eff;

    const due = split.due;
    const paid = r.payment_status === "unpaid" ? 0 : r2(n(r.paid_amount));
    const proven = !!r.proof_file && r.payment_status !== "unpaid";
    const excluded = proven ? r2(Math.min(paid, due)) : 0;
    const remaining = r2(Math.max(0, due - excluded));
    const avgRate = eff > 0 && dailyWage > 0 ? r2(due / (eff * dailyWage)) : 0;

    if (!r.has_medical_report) {
      warnings.push(
        `الإجازة (${r.start_date || "—"}): لا يوجد تقرير طبي مؤيد للإجازة المرضية، وقد يؤثر ذلك على قبول المطالبة وفق النظام المعمول به.`,
      );
    }
    if (r.payment_status !== "unpaid" && !r.proof_file) {
      warnings.push(
        `الإجازة (${r.start_date || "—"}): تم إدخال وجود صرف دون إثبات، وقد يكون محل نظر أمام الجهة القضائية.`,
      );
    }
    if (split.excessDays > 0) {
      warnings.push(
        `الإجازة (${r.start_date || "—"}): ${split.excessDays} يوم تجاوزت الحد النظامي للإجازة المرضية ولا تُحتسب بأجر.`,
      );
    }
    if (declared > (effective[i] ?? 0) && policy.aggregate_across_leaves) {
      warnings.push(
        `الإجازة (${r.start_date || "—"}): تم استبعاد ${declared - (effective[i] ?? 0)} يوم لتكرارها مع إجازة أخرى.`,
      );
    }

    leaves.push({
      index: i,
      start: r.start_date,
      end: r.end_date,
      days: declared,
      effectiveDays: eff,
      duplicateDays: Math.max(0, declared - eff),
      stages: split.stages,
      avgRate,
      due,
      paid,
      excluded,
      remaining,
      proven,
      status: r.payment_status,
      hasReport: !!r.has_medical_report,
      excessDays: split.excessDays,
    });
  }

  leaves.sort((a, b) => a.index - b.index);

  const totalDays = leaves.reduce((s, l) => s + l.days, 0);
  const effectiveDays = leaves.reduce((s, l) => s + l.effectiveDays, 0);
  const duplicateDays = leaves.reduce((s, l) => s + l.duplicateDays, 0);
  const totalDue = r2(leaves.reduce((s, l) => s + l.due, 0));
  const totalPaid = r2(leaves.reduce((s, l) => s + l.paid, 0));
  const excludedAmount = r2(leaves.reduce((s, l) => s + l.excluded, 0));
  const remainingAmount = r2(leaves.reduce((s, l) => s + l.remaining, 0));
  const overMaxDays = Math.max(0, effectiveDays - policy.annual_max_days);

  const stageMap = new Map<number, { stage: number; rate: number; days: number; amount: number }>();
  for (const l of leaves) {
    for (const s of l.stages) {
      const cur = stageMap.get(s.stage) ?? { stage: s.stage, rate: s.rate, days: 0, amount: 0 };
      cur.days += s.days;
      cur.amount = r2(cur.amount + s.amount);
      stageMap.set(s.stage, cur);
    }
  }
  const stageTotals = Array.from(stageMap.values()).sort((a, b) => a.stage - b.stage);

  steps.push(`إجمالي أيام الإجازات المرضية = ${totalDays} يوم (المحتسب فعلياً ${effectiveDays} يوم)`);
  stageTotals.forEach((s) =>
    steps.push(
      `المرحلة ${s.stage}: ${s.days} يوم × ${dailyWage} × ${Math.round(s.rate * 100)}% = ${s.amount} ${currency}`,
    ),
  );
  steps.push(`إجمالي مستحق الإجازة المرضية = ${totalDue} ${currency}`);
  steps.push(`المبالغ المستبعدة (مصروفة بإثبات) = ${excludedAmount} ${currency}`);
  steps.push(`المتبقي المستحق = ${remainingAmount} ${currency}`);

  if (args.endedDuringLeave) {
    warnings.push(
      policy.service_end_during_leave === "pay_until_end_date"
        ? "انتهت العلاقة العمالية أثناء الإجازة المرضية: يُحتسب الأجر حتى تاريخ نهاية الخدمة وفق قاعدة الدولة المختارة."
        : "انتهت العلاقة العمالية أثناء الإجازة المرضية: تُطبّق قاعدة الدولة المختارة بشأن مدة الاستحقاق.",
    );
  }
  if (args.wageChanged) {
    warnings.push(
      `تغيّر الأجر أثناء فترة المرض: تم اعتماد ${
        SICK_WAGE_BASES.find((w) => w.value === (args.wageBasis ?? policy.wage_basis))?.label ??
        policy.wage_basis
      } في الاحتساب.`,
    );
  }
  if (overMaxDays > 0) {
    warnings.push(
      `إجمالي الأيام المرضية يتجاوز الحد النظامي السنوي (${policy.annual_max_days} يوم) بمقدار ${overMaxDays} يوم.`,
    );
  }

  return {
    dailyWage,
    currency,
    policy,
    leaves,
    merged,
    totalDays,
    effectiveDays,
    duplicateDays,
    totalDue,
    totalPaid,
    excludedAmount,
    remainingAmount,
    stageTotals,
    overMaxDays,
    warnings,
    steps,
  };
}

/* ==================== التحقق من صحة البيانات ==================== */

export function validateSickLeave(args: {
  rows: SickLeaveRow[];
  analysis: SickAnalysis;
  serviceStart?: string | null;
  serviceEnd?: string | null;
  policy?: SickPolicy;
}): string[] {
  const errors: string[] = [];
  const { rows, analysis } = args;
  const policy = args.policy ?? analysis.policy;
  const today = new Date().toISOString().slice(0, 10);

  if (!rows.length) errors.push("أضف إجازة مرضية واحدة على الأقل أو اختر «لا».");

  rows.forEach((r, i) => {
    const label = `الإجازة ${i + 1}`;
    if (!r.start_date) errors.push(`${label}: تاريخ البداية مطلوب.`);
    if (!r.end_date) errors.push(`${label}: تاريخ النهاية مطلوب.`);
    if (r.start_date && r.end_date && r.end_date < r.start_date)
      errors.push(`${label}: تاريخ النهاية قبل تاريخ البداية.`);
    if (r.start_date > today || r.end_date > today)
      errors.push(`${label}: لا يمكن إدخال تاريخ مستقبلي.`);
    if (n(r.days) <= 0) errors.push(`${label}: عدد الأيام يجب أن يكون أكبر من صفر.`);
    if (!r.medical_provider.trim())
      errors.push(`${label}: الجهة الطبية المصدرة للتقرير مطلوبة.`);
    if (policy.requires_medical_report && r.has_medical_report && !r.medical_report_file)
      errors.push(`${label}: يرجى رفع التقرير الطبي.`);
    if (r.payment_status !== "unpaid" && n(r.paid_amount) <= 0)
      errors.push(`${label}: أدخل قيمة المبلغ المصروف.`);
    if (r.payment_status !== "unpaid" && !r.payment_date)
      errors.push(`${label}: أدخل تاريخ الصرف.`);
    if (r.payment_status !== "unpaid" && !r.payment_method)
      errors.push(`${label}: أدخل طريقة السداد.`);
    if (args.serviceStart && r.start_date && r.start_date < args.serviceStart)
      errors.push(`${label}: تاريخ الإجازة يسبق بداية مدة الخدمة.`);
    if (args.serviceEnd && r.end_date && r.end_date > args.serviceEnd)
      errors.push(`${label}: تاريخ نهاية الإجازة يتجاوز نهاية مدة الخدمة.`);

    const res = analysis.leaves.find((l) => l.index === i);
    if (res && r.payment_status !== "unpaid" && n(r.paid_amount) > res.due + 0.01)
      errors.push(`${label}: قيمة الصرف تتجاوز المبلغ المستحق (${res.due} ${analysis.currency}).`);
  });

  overlaps(rows).forEach(([a, b]) =>
    errors.push(`تداخل بين الإجازة ${a + 1} والإجازة ${b + 1} في نفس الأيام.`),
  );

  return errors;
}
