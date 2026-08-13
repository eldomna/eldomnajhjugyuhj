/**
 * تحليل العقود للنظام السعودي (الخطوة 2).
 * محرك تحليلي مستقل — لا يعدّل محركات الحساب القائمة (السعودي أو اليمني).
 */

export type ContractType = "fixed_term" | "indefinite";

export type RenewItem = { date: string; months: number };

export type Contract = {
  id: string;
  case_id: string;
  contract_number: string;
  contract_name: string | null;
  start_date: string;
  end_date: string | null;
  joining_date: string | null;
  contract_type: ContractType;
  is_qiwa_documented: boolean;
  qiwa_contract_number: string | null;
  renewed: boolean;
  renew_count: number;
  renew_history: RenewItem[];
  ended: boolean;
  end_reason: string | null;
  actual_end_date: string | null;
  sort_order: number;
};

export type ContractDraft = Omit<Contract, "id" | "case_id" | "sort_order">;

export const emptyContract: ContractDraft = {
  contract_number: "",
  contract_name: "",
  start_date: "",
  end_date: null,
  joining_date: null,
  contract_type: "fixed_term",
  is_qiwa_documented: false,
  qiwa_contract_number: null,
  renewed: false,
  renew_count: 0,
  renew_history: [],
  ended: false,
  end_reason: null,
  actual_end_date: null,
};

export const END_REASONS = [
  "انتهاء مدة العقد",
  "فسخ من صاحب العمل",
  "استقالة العامل",
  "اتفاق الطرفين",
  "انتهاء فترة التجربة",
  "أسباب المادة (80)",
  "أسباب المادة (81)",
  "بلوغ سن التقاعد",
  "قوة قاهرة / إغلاق المنشأة",
  "أخرى",
];

const DAY = 86_400_000;
export const toDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
export const fmtDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("ar-SA") : "—");

/** نهاية العقد الفعلية المستخدمة في التحليل */
export function effectiveEnd(c: Contract | ContractDraft): string | null {
  return (c.ended ? c.actual_end_date : null) ?? c.end_date ?? null;
}

export function durationDays(c: Contract): number {
  const s = toDate(c.start_date);
  const e = toDate(effectiveEnd(c)) ?? new Date();
  if (!s) return 0;
  return Math.max(0, daysBetween(s, e));
}

export const daysToYears = (d: number) => d / 365.25;
export const daysToMonths = (d: number) => d / 30.4375;

export function formatDuration(days: number): string {
  const y = Math.floor(days / 365.25);
  const m = Math.floor((days - y * 365.25) / 30.4375);
  const d = Math.max(0, Math.round(days - y * 365.25 - m * 30.4375));
  const parts: string[] = [];
  if (y) parts.push(`${y} سنة`);
  if (m) parts.push(`${m} شهر`);
  if (d || parts.length === 0) parts.push(`${d} يوم`);
  return parts.join(" و ");
}

/* ============================ التحقق ============================ */

export type ContractErrors = Partial<Record<keyof ContractDraft, string>> & { _form?: string };

export function validateContract(
  c: ContractDraft,
  others: Contract[],
  editingId?: string,
): ContractErrors {
  const e: ContractErrors = {};
  const peers = others.filter((o) => o.id !== editingId);

  if (!c.contract_number.trim()) e.contract_number = "رقم العقد مطلوب";
  else if (
    peers.some((o) => o.contract_number.trim().toLowerCase() === c.contract_number.trim().toLowerCase())
  )
    e.contract_number = "رقم العقد مستخدم في عقد آخر";

  if (!c.start_date) e.start_date = "تاريخ بداية العقد مطلوب";

  const s = toDate(c.start_date);
  const end = toDate(c.end_date);
  const join = toDate(c.joining_date);
  const actual = toDate(c.actual_end_date);

  if (c.contract_type === "fixed_term" && !c.end_date) e.end_date = "العقد محدد المدة يتطلب تاريخ نهاية";
  if (s && end && end.getTime() < s.getTime()) e.end_date = "تاريخ النهاية لا يمكن أن يكون قبل تاريخ البداية";
  if (s && join && daysBetween(join, s) > 0) e.joining_date = "تاريخ المباشرة لا يمكن أن يكون قبل بداية العقد";
  if (s && actual && actual.getTime() < s.getTime())
    e.actual_end_date = "تاريخ انتهاء العقد لا يمكن أن يكون قبل بدايته";

  if (c.ended && !c.end_reason) e.end_reason = "حدّد سبب انتهاء العقد";
  if (c.ended && !c.actual_end_date) e.actual_end_date = "حدّد تاريخ انتهاء العقد";

  if (c.renewed) {
    if (!c.renew_count || c.renew_count < 1) e.renew_count = "عدد مرات التجديد يجب أن يكون 1 على الأقل";
    else if (c.renew_history.length !== c.renew_count)
      e.renew_history = "أكمل تاريخ ومدة كل تجديد";
    else if (c.renew_history.some((r) => !r.date || !r.months || r.months <= 0))
      e.renew_history = "كل تجديد يحتاج تاريخاً ومدةً بالأشهر";
  }

  // تكرار نفس العقد (نفس التواريخ والنوع)
  if (
    s &&
    peers.some(
      (o) =>
        o.start_date === c.start_date &&
        (o.end_date ?? "") === (c.end_date ?? "") &&
        o.contract_type === c.contract_type,
    )
  )
    e._form = "يوجد عقد مطابق بنفس التواريخ والنوع — لا يمكن تكرار نفس العقد";

  // تداخل غير منطقي مع عقد آخر
  if (s) {
    const cEnd = toDate(effectiveEnd(c)) ?? new Date();
    const overlap = peers.find((o) => {
      const os = toDate(o.start_date)!;
      const oe = toDate(effectiveEnd(o)) ?? new Date();
      return os.getTime() <= cEnd.getTime() && s.getTime() <= oe.getTime();
    });
    if (overlap)
      e._form = `تداخل غير منطقي مع العقد رقم ${overlap.contract_number} (${fmtDate(overlap.start_date)} — ${fmtDate(
        effectiveEnd(overlap),
      )})`;
  }

  return e;
}

/* ============================ التحليل ============================ */

export type Gap = { afterContract: string; beforeContract: string; from: string; to: string; days: number };

export type ContractAnalysis = {
  count: number;
  ordered: Contract[];
  first: Contract | null;
  last: Contract | null;
  current: Contract | null; // العقد الساري (غير منتهٍ ويشمل تاريخ اليوم)
  activeCount: number;
  endedContracts: Contract[];
  perContractDays: Record<string, number>;
  totalContractsDays: number;
  actualServiceDays: number; // مجموع مدد العقود (خدمة فعلية)
  legalServiceDays: number; // من أول عقد إلى آخر نهاية (خدمة نظامية)
  gaps: Gap[];
  totalGapDays: number;
  serviceContinuity: "continuous" | "separated";
  totalRenewals: number;
  renewalMonths: number;
  article55: {
    applies: boolean;
    triggered: boolean;
    reasons: string[];
    originalType: ContractType | null;
    legalType: ContractType | null;
  };
  errors: string[];
};

/** انقطاع أكثر من هذا الحد يجعل الخدمة منفصلة */
const CONTINUITY_TOLERANCE_DAYS = 30;
/** المادة (55): التحول عند 3 تجديدات متتالية أو 4 سنوات */
const A55_RENEWALS = 3;
const A55_YEARS = 4;

export function analyzeContracts(contracts: Contract[], nationality: string): ContractAnalysis {
  const ordered = [...contracts].sort(
    (a, b) => (toDate(a.start_date)?.getTime() ?? 0) - (toDate(b.start_date)?.getTime() ?? 0),
  );
  const today = new Date();
  const errors: string[] = [];

  const perContractDays: Record<string, number> = {};
  ordered.forEach((c) => {
    perContractDays[c.id] = durationDays(c);
  });

  const totalContractsDays = Object.values(perContractDays).reduce((a, b) => a + b, 0);

  const gaps: Gap[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const prevEnd = toDate(effectiveEnd(prev));
    const curStart = toDate(cur.start_date);
    if (!prevEnd || !curStart) continue;
    const d = daysBetween(prevEnd, curStart) - 1;
    if (d > 0) {
      gaps.push({
        afterContract: prev.contract_number,
        beforeContract: cur.contract_number,
        from: new Date(prevEnd.getTime() + DAY).toISOString().slice(0, 10),
        to: new Date(curStart.getTime() - DAY).toISOString().slice(0, 10),
        days: d,
      });
    }
  }
  const totalGapDays = gaps.reduce((a, g) => a + g.days, 0);

  const first = ordered[0] ?? null;
  const last = ordered[ordered.length - 1] ?? null;

  const current =
    ordered.find((c) => {
      const s = toDate(c.start_date);
      const e = toDate(effectiveEnd(c));
      if (!s) return false;
      return !c.ended && s.getTime() <= today.getTime() && (!e || e.getTime() >= today.getTime());
    }) ??
    ordered.find((c) => !c.ended) ??
    null;

  const endedContracts = ordered.filter((c) => c.ended);
  const activeCount = ordered.length - endedContracts.length;

  const firstStart = first ? toDate(first.start_date) : null;
  const lastEnd = last ? (toDate(effectiveEnd(last)) ?? today) : null;
  const legalServiceDays = firstStart && lastEnd ? Math.max(0, daysBetween(firstStart, lastEnd)) : 0;

  const serviceContinuity: "continuous" | "separated" =
    gaps.some((g) => g.days > CONTINUITY_TOLERANCE_DAYS) ? "separated" : "continuous";

  const totalRenewals = ordered.reduce((a, c) => a + (c.renewed ? c.renew_count : 0), 0);
  const renewalMonths = ordered.reduce(
    (a, c) => a + (c.renewed ? c.renew_history.reduce((x, r) => x + (r.months || 0), 0) : 0),
    0,
  );

  // المادة (55) — للسعوديين وللعقود محددة المدة فقط
  const isSaudi = nationality.trim() === "سعودي" || nationality.trim().toLowerCase() === "saudi";
  const fixedContracts = ordered.filter((c) => c.contract_type === "fixed_term");
  const applies = isSaudi && fixedContracts.length > 0;
  const reasons: string[] = [];
  let triggered = false;

  if (applies) {
    const fixedDays = fixedContracts.reduce((a, c) => a + (perContractDays[c.id] ?? 0), 0);
    const years = daysToYears(fixedDays + (serviceContinuity === "continuous" ? 0 : 0));
    if (totalRenewals >= A55_RENEWALS) {
      triggered = true;
      reasons.push(`تجديد العقد ${totalRenewals} مرات متتالية (الحد ${A55_RENEWALS})`);
    }
    if (fixedContracts.length >= A55_RENEWALS + 1 && serviceContinuity === "continuous") {
      triggered = true;
      reasons.push(`تعاقب ${fixedContracts.length} عقود محددة المدة بخدمة متصلة`);
    }
    if (years >= A55_YEARS) {
      triggered = true;
      reasons.push(`إجمالي مدة العقود محددة المدة ${years.toFixed(2)} سنة (الحد ${A55_YEARS} سنوات)`);
    }
  } else if (!isSaudi) {
    reasons.push("العامل غير سعودي — لا تُطبّق قواعد التحول الخاصة بعقود السعوديين");
  }

  if (!ordered.length) errors.push("لا يوجد أي عقد مسجّل — يجب إدخال عقد واحد على الأقل");
  ordered.forEach((c) => {
    const s = toDate(c.start_date);
    const e = toDate(effectiveEnd(c));
    if (!s) errors.push(`العقد ${c.contract_number}: تاريخ البداية مفقود`);
    if (s && e && e.getTime() < s.getTime())
      errors.push(`العقد ${c.contract_number}: تاريخ النهاية قبل تاريخ البداية`);
  });
  for (let i = 1; i < ordered.length; i++) {
    const prevEnd = toDate(effectiveEnd(ordered[i - 1]));
    const curStart = toDate(ordered[i].start_date);
    if (prevEnd && curStart && daysBetween(prevEnd, curStart) < 0)
      errors.push(
        `تعارض: العقد ${ordered[i].contract_number} يبدأ قبل انتهاء العقد ${ordered[i - 1].contract_number}`,
      );
  }
  if (ordered.length && !current && !endedContracts.length)
    errors.push("تعذّر تحديد العقد الحالي");

  return {
    count: ordered.length,
    ordered,
    first,
    last,
    current,
    activeCount,
    endedContracts,
    perContractDays,
    totalContractsDays,
    actualServiceDays: totalContractsDays,
    legalServiceDays,
    gaps,
    totalGapDays,
    serviceContinuity,
    totalRenewals,
    renewalMonths,
    article55: {
      applies,
      triggered,
      reasons,
      originalType: first?.contract_type ?? null,
      legalType: triggered ? "indefinite" : (first?.contract_type ?? null),
    },
    errors,
  };
}
