// تصنيف بنود الأجر وحساب الأجر الفعلي/اليومي/الساعي — تلقائي وغير قابل للتعديل اليدوي.

export type SalaryInput = {
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  communication_allowance: number;
  work_nature_allowance: number;
  risk_allowance: number;
  delegation_allowance: number;
  other_allowances: number;
  fixed_commission: number;
  fixed_bonus: number;
  other_benefits: number;
};

export const emptySalary: SalaryInput = {
  basic_salary: 0,
  housing_allowance: 0,
  transport_allowance: 0,
  communication_allowance: 0,
  work_nature_allowance: 0,
  risk_allowance: 0,
  delegation_allowance: 0,
  other_allowances: 0,
  fixed_commission: 0,
  fixed_bonus: 0,
  other_benefits: 0,
};

export type SalaryField = keyof SalaryInput;

export const SALARY_GROUPS: { title: string; fields: { key: SalaryField; label: string }[] }[] = [
  { title: "أولاً: الأجر الأساسي", fields: [{ key: "basic_salary", label: "الراتب الأساسي" }] },
  {
    title: "ثانياً: البدلات",
    fields: [
      { key: "housing_allowance", label: "بدل السكن" },
      { key: "transport_allowance", label: "بدل النقل" },
      { key: "communication_allowance", label: "بدل الاتصال" },
      { key: "work_nature_allowance", label: "بدل طبيعة العمل" },
      { key: "risk_allowance", label: "بدل المخاطر" },
      { key: "delegation_allowance", label: "بدل الانتداب الثابت" },
      { key: "other_allowances", label: "البدلات الأخرى" },
    ],
  },
  {
    title: "ثالثاً: العمولات والمكافآت",
    fields: [
      { key: "fixed_commission", label: "العمولات الثابتة" },
      { key: "fixed_bonus", label: "المكافآت الثابتة" },
    ],
  },
  {
    title: "رابعاً: المزايا النقدية",
    fields: [{ key: "other_benefits", label: "مزايا نقدية أخرى تدخل ضمن الأجر" }],
  },
];

export type SalaryResult = {
  basic: number;
  allowances: number;
  commissions: number;
  benefits: number;
  actual: number;
  daily: number;
  hourly: number;
};

const n = (v: number) => (Number.isFinite(v) ? Number(v) : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function computeSalary(s: SalaryInput): SalaryResult {
  const basic = n(s.basic_salary);
  const allowances =
    n(s.housing_allowance) +
    n(s.transport_allowance) +
    n(s.communication_allowance) +
    n(s.work_nature_allowance) +
    n(s.risk_allowance) +
    n(s.delegation_allowance) +
    n(s.other_allowances);
  const commissions = n(s.fixed_commission) + n(s.fixed_bonus);
  const benefits = n(s.other_benefits);
  const actual = basic + allowances + commissions + benefits;
  const daily = actual / 30;
  const hourly = daily / 8;
  return {
    basic: r2(basic),
    allowances: r2(allowances),
    commissions: r2(commissions),
    benefits: r2(benefits),
    actual: r2(actual),
    daily: r2(daily),
    hourly: r2(hourly),
  };
}

export type SalaryErrors = Partial<Record<SalaryField, string>>;

export function validateSalary(raw: Record<SalaryField, string>): SalaryErrors {
  const e: SalaryErrors = {};
  (Object.keys(emptySalary) as SalaryField[]).forEach((k) => {
    const v = (raw[k] ?? "").trim();
    if (k === "basic_salary" && !v) {
      e[k] = "الراتب الأساسي مطلوب";
      return;
    }
    if (!v) return;
    if (!/^\d+(\.\d{1,2})?$/.test(v)) {
      e[k] = "أدخل رقماً صحيحاً بدون نصوص أو قيم سالبة";
      return;
    }
    if (Number(v) < 0) e[k] = "لا يمكن إدخال قيمة سالبة";
  });
  if (!e.basic_salary && Number(raw.basic_salary) <= 0) e.basic_salary = "الراتب الأساسي يجب أن يكون أكبر من صفر";
  return e;
}

export const toNumbers = (raw: Record<SalaryField, string>): SalaryInput => {
  const out = { ...emptySalary };
  (Object.keys(emptySalary) as SalaryField[]).forEach((k) => {
    out[k] = Number((raw[k] ?? "").trim() || 0) || 0;
  });
  return out;
};

export const money = (v: number, currency = "SAR") =>
  `${v.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
