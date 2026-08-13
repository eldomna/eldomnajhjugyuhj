// منطق فترة التجربة — مستقل لكل عقد. لا يمس محركات الحساب القائمة.
import type { Contract } from "./contracts";

export const DAY = 86400000;
export const toDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
export const addDays = (s: string, days: number) => {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
export const diffDays = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY);

export type TerminationRight = "worker" | "employer" | "both";
export type WhoTerminated = "worker" | "employer";

export type ReTrialAnswers = {
  worked_before: boolean;
  materially_different_job: boolean;
  new_independent_contract: boolean;
  system_allows_retrial: boolean;
};

export type ReTrialAnalysis = ReTrialAnswers & {
  valid: boolean;
  reasons: string[];
};

export type TrialPeriod = {
  id?: string;
  contract_id: string;
  has_trial_period: boolean;
  trial_start_date: string | null;
  trial_duration_days: number | null;
  trial_end_date: string | null;
  is_extended: boolean;
  extension_duration_days: number | null;
  extension_reason: string | null;
  extension_start_date: string | null;
  extension_end_date: string | null;
  termination_right: TerminationRight | null;
  ended_during_trial: boolean;
  who_terminated: WhoTerminated | null;
  re_trial_analysis: ReTrialAnalysis | Record<string, never>;
};

export const emptyReTrial: ReTrialAnswers = {
  worked_before: false,
  materially_different_job: false,
  new_independent_contract: false,
  system_allows_retrial: false,
};

export function emptyTrial(contractId: string): TrialPeriod {
  return {
    contract_id: contractId,
    has_trial_period: false,
    trial_start_date: null,
    trial_duration_days: null,
    trial_end_date: null,
    is_extended: false,
    extension_duration_days: null,
    extension_reason: null,
    extension_start_date: null,
    extension_end_date: null,
    termination_right: null,
    ended_during_trial: false,
    who_terminated: null,
    re_trial_analysis: {},
  };
}

/** الحد النظامي: 90 يوماً للتجربة، وقابلة للتمديد إلى 180 يوماً بموافقة كتابية */
export const TRIAL_MAX_DAYS = 90;
export const TRIAL_MAX_WITH_EXTENSION_DAYS = 180;

export type TrialErrors = Record<string, string>;

export function validateTrial(t: TrialPeriod, contract: Contract): TrialErrors {
  const e: TrialErrors = {};
  if (!t.has_trial_period) return e;

  if (!t.trial_start_date) e.trial_start_date = "تاريخ بداية فترة التجربة مطلوب";
  if (!t.trial_duration_days || t.trial_duration_days <= 0) e.trial_duration_days = "مدة فترة التجربة مطلوبة (بالأيام)";
  if (!t.trial_end_date) e.trial_end_date = "تاريخ نهاية فترة التجربة مطلوب";

  if (t.trial_start_date && contract.start_date && diffDays(contract.start_date, t.trial_start_date) < 0)
    e.trial_start_date = "بداية فترة التجربة لا يمكن أن تسبق بداية العقد";

  if (t.trial_start_date && t.trial_end_date && diffDays(t.trial_start_date, t.trial_end_date) <= 0)
    e.trial_end_date = "تاريخ نهاية فترة التجربة يجب أن يكون بعد تاريخ البدايتها";

  if (t.trial_duration_days && t.trial_duration_days > TRIAL_MAX_DAYS)
    e.trial_duration_days = `مدة فترة التجربة تتجاوز الحد النظامي (${TRIAL_MAX_DAYS} يوماً)`;

  if (t.is_extended) {
    if (!t.extension_duration_days || t.extension_duration_days <= 0)
      e.extension_duration_days = "مدة التمديد مطلوبة";
    if (!t.extension_reason?.trim()) e.extension_reason = "سبب التمديد مطلوب";
    if (!t.extension_start_date) e.extension_start_date = "تاريخ بداية التمديد مطلوب";
    if (!t.extension_end_date) e.extension_end_date = "تاريخ نهاية التمديد مطلوب";

    if (t.trial_end_date && t.extension_start_date && diffDays(t.trial_end_date, t.extension_start_date) < 0)
      e.extension_start_date = "بداية التمديد يجب أن تكون بعد نهاية فترة التجربة الأصلية";
    if (t.extension_start_date && t.extension_end_date && diffDays(t.extension_start_date, t.extension_end_date) <= 0)
      e.extension_end_date = "تاريخ نهاية التمديد يجب أن يكون بعد تاريخ بدايته";

    const total = (t.trial_duration_days ?? 0) + (t.extension_duration_days ?? 0);
    if (total > TRIAL_MAX_WITH_EXTENSION_DAYS)
      e.extension_duration_days = `إجمالي فترة التجربة مع التمديد (${total} يوماً) يتجاوز الحد النظامي (${TRIAL_MAX_WITH_EXTENSION_DAYS} يوماً)`;
  }

  if (!t.termination_right) e.termination_right = "يجب تحديد من يحق له إنهاء العقد أثناء فترة التجربة";

  if (t.ended_during_trial && !t.who_terminated) e.who_terminated = "يجب تحديد الطرف الذي أنهى العقد";

  const end = t.is_extended ? t.extension_end_date : t.trial_end_date;
  const cEnd = contract.actual_end_date ?? contract.end_date;
  if (end && cEnd && diffDays(end, cEnd) < 0)
    e.trial_end_date = "نهاية فترة التجربة تتجاوز تاريخ نهاية العقد";

  return e;
}

export type TerminationVerdict = {
  checked: boolean;
  lawful: boolean;
  message: string;
  effects: string[];
};

/** التحقق من صلاحية الإنهاء أثناء فترة التجربة وفق الحق المنصوص عليه في العقد */
export function verifyTermination(t: TrialPeriod): TerminationVerdict {
  if (!t.has_trial_period || !t.ended_during_trial || !t.who_terminated || !t.termination_right)
    return { checked: false, lawful: true, message: "", effects: [] };

  const allowed =
    t.termination_right === "both" ||
    (t.termination_right === "worker" && t.who_terminated === "worker") ||
    (t.termination_right === "employer" && t.who_terminated === "employer");

  if (allowed)
    return {
      checked: true,
      lawful: true,
      message: "الإنهاء أثناء فترة التجربة صحيح وفق حق الإنهاء المنصوص عليه في العقد.",
      effects: [
        "لا تُحتسب أجور المدة المتبقية من العقد",
        "لا يُحتسب تعويض إنهاء العقد",
        "لا تُحتسب بقية مدة العقد",
        "تُحتسب فقط الحقوق التي نشأت حتى تاريخ انتهاء العلاقة",
      ],
    };

  return {
    checked: true,
    lawful: false,
    message: `تنبيه قانوني: الإنهاء مخالف للعقد — حق الإنهاء ممنوح ${
      t.termination_right === "worker" ? "للعامل فقط" : "لصاحب العمل فقط"
    } بينما تم الإنهاء من ${t.who_terminated === "worker" ? "العامل" : "صاحب العمل"}.`,
    effects: ["تُستخدم هذه النتيجة لاحقاً عند احتساب التعويضات", "لا يتم حذف أي بيانات مدخلة"],
  };
}

/** تحليل صحة إعادة فترة التجربة لدى نفس صاحب العمل */
export function analyzeReTrial(a: ReTrialAnswers): ReTrialAnalysis {
  const reasons: string[] = [];
  if (!a.worked_before) {
    reasons.push("لم يعمل العامل سابقاً لدى نفس صاحب العمل — لا تنطبق قاعدة إعادة فترة التجربة.");
    return { ...a, valid: true, reasons };
  }
  if (!a.system_allows_retrial) reasons.push("النظام لا يسمح بإعادة فترة التجربة في هذه الحالة.");
  if (!a.materially_different_job) reasons.push("الوظيفة الجديدة غير مختلفة اختلافاً جوهرياً عن الوظيفة السابقة.");
  if (!a.new_independent_contract) reasons.push("لا يوجد عقد جديد مستقل يبرر إعادة فترة التجربة.");

  const valid = a.system_allows_retrial && a.materially_different_job && a.new_independent_contract;
  if (valid)
    reasons.push("إعادة فترة التجربة صحيحة: وظيفة مختلفة جوهرياً + عقد جديد مستقل + النظام يسمح بذلك.");
  return { ...a, valid, reasons };
}
