// بيانات تجريبية ثابتة للمعاينة الداخلية وفحص التصدير الآلي.
// لا تُستخدم في أي مسار إنتاجي ولا تمس منطق الحاسبات.

import { calculate, type CalculatorInput, type CalculatorResult } from "./calculator";
import type { SaReportDocument } from "./saudi/report-types";
import type { AmountExpectation } from "./pdf-verify";

/* ------------------------------- اليمن ------------------------------- */

export const DEMO_YE_INPUT: CalculatorInput = {
  employee_name: "عبدالله محمد صالح",
  employer_name: "شركة النموذج للتجارة",
  monthly_salary: 180000,
  currency: "YER",
  service_start_date: "2018-03-01",
  service_end_date: "2025-02-28",
  still_working: false,
  daily_hours: 9,
  day_overtime_hours: 120,
  night_overtime_hours: 30,
  sector: "private",
  friday_off: true,
  friday_worked_hours: 16,
  friday_paid: false,
  annual_leave_status: "partial",
  annual_leave_days_received: 20,
  sick_leave_days: 12,
  unused_leave_days: 0,
  insured: true,
  employment_status: "ended",
  termination_reason: "unfair",
  notice_given: false,
  notice_months: 0,
  eosb_received: 0,
  holiday_days_worked: 4,
  gender: "male",
  unfair_dismissal: true,
};

export function demoYemenResult(): CalculatorResult {
  return calculate(DEMO_YE_INPUT);
}

/** بنود الحاسبة اليمنية التي يجب أن تظهر بقيمها نفسها داخل الـ PDF. */
export function yemenExpectations(result: CalculatorResult): {
  items: AmountExpectation[];
  extras: AmountExpectation[];
  total: AmountExpectation;
} {
  const items: AmountExpectation[] = [
    { label: "مكافأة نهاية الخدمة", amount: result.eos_benefit },
    { label: "أجر العمل الإضافي النهاري", amount: result.day_overtime_amount },
    { label: "أجر العمل الإضافي الليلي", amount: result.night_overtime_amount },
    { label: "بدل أيام الجمعة", amount: result.friday_compensation },
    { label: "بدل الأعياد الرسمية", amount: result.holiday_compensation },
    { label: "بدل الإنذار", amount: result.notice_indemnity },
    { label: "بدل الإجازات غير المستخدمة", amount: result.leave_compensation },
    { label: "حقوق العاملات", amount: result.female_rights?.total ?? 0 },
    { label: "مكافأة مستلمة مسبقاً (خصم)", amount: -result.eosb_advance_deduction },
  ].filter((i) => Math.abs(i.amount) > 0);

  // بنود تُعرض في التقرير لكنها خارج «الحقوق المضمونة» (تُطالب قضائياً).
  const extras: AmountExpectation[] = [
    { label: "تعويض الفصل التعسفي (خارج الإجمالي المضمون)", amount: result.unfair_dismissal_compensation },
    ...(result.sick_leave ? [{ label: "أجر أيام الإجازة المرضية", amount: result.sick_leave.paid_amount }] : []),
  ].filter((i) => Math.abs(i.amount) > 0);

  return {
    items,
    extras,
    total: { label: "إجمالي الحقوق المضمونة", amount: result.total_due },
  };
}

/* ------------------------------ السعودية ------------------------------ */

const saEntitlements = [
  {
    key: "eosb",
    label: "مكافأة نهاية الخدمة",
    amount: 48000,
    formula: "(8,000 × 0.5 × 2) + (8,000 × 1 × 4)",
    legalRef: "المادة 84 من نظام العمل",
    explanation: "نصف شهر لكل سنة من السنوات الخمس الأولى وشهر كامل لما بعدها.",
  },
  {
    key: "overtime",
    label: "أجر العمل الإضافي",
    amount: 7200,
    formula: "(8,000 ÷ 240) × 1.5 × 216 ساعة",
    legalRef: "المادة 107 من نظام العمل",
    explanation: "أجر الساعة الإضافية بنسبة 150 % من الأجر الأساسي.",
  },
  {
    key: "annual_leave",
    label: "بدل رصيد الإجازات السنوية",
    amount: 5600,
    formula: "(8,000 ÷ 30) × 21 يوماً",
    legalRef: "المادة 109 من نظام العمل",
    explanation: "بدل نقدي عن أيام الإجازة السنوية غير المستنفدة.",
  },
  {
    key: "notice",
    label: "بدل الإشعار",
    amount: 8000,
    formula: "8,000 × شهر واحد",
    legalRef: "المادة 75 من نظام العمل",
    explanation: "لم يُمنح العامل مهلة الإشعار النظامية.",
  },
  {
    key: "compensation",
    label: "التعويض عن الإنهاء غير المشروع",
    amount: 16000,
    formula: "8,000 × 2 شهر",
    legalRef: "المادة 77 من نظام العمل",
    explanation: "التعويض النظامي لعقد غير محدد المدة.",
  },
];

const saDeductions = [
  {
    key: "gosi",
    label: "حصة العامل في التأمينات الاجتماعية",
    amount: 3600,
    formula: "8,000 × 9 % × 5 أشهر",
    legalRef: "نظام التأمينات الاجتماعية",
    explanation: "اقتطاع نظامي من الأجر الخاضع للاشتراك.",
  },
  {
    key: "advance",
    label: "سلفة مستلمة مقدماً",
    amount: 2000,
    formula: "مبلغ ثابت",
    legalRef: "المادة 92 من نظام العمل",
    explanation: "خصم مبلغ مستلم فعلياً من صاحب العمل.",
  },
];

const grossTotal = saEntitlements.reduce((s, r) => s + r.amount, 0);
const deductionsTotal = saDeductions.reduce((s, r) => s + r.amount, 0);

export function demoSaudiReport(): SaReportDocument {
  const now = new Date("2026-01-15T09:30:00.000Z");
  return {
    templateVersion: "SA-REPORT-v1.4",
    header: {
      platformName: "حاسبة العمال الذكية",
      logoUrl: null,
      title: "التقرير النهائي لاحتساب الحقوق العمالية — المملكة العربية السعودية",
      reportNumber: "SA-DEMO-2026-000123",
      version: 1,
      issuedAt: now.toISOString(),
      generatedAt: now.toISOString(),
      caseId: "demo-case",
    },
    parties: {
      employee: "سالم أحمد الغامدي",
      employer: "مؤسسة النموذج للمقاولات",
      employeeProvided: true,
      employerProvided: true,
    },
    summary: {
      grossTotal,
      deductionsTotal,
      netTotal: grossTotal - deductionsTotal,
      currency: "SAR",
      planCode: "yearly",
      reportType: "مدفوع",
    },
    contract: {
      rows: [
        { label: "نوع العقد", value: "غير محدد المدة" },
        { label: "تاريخ بداية الخدمة", value: "2016-01-01" },
        { label: "تاريخ نهاية الخدمة", value: "2025-12-31" },
        { label: "مدة الخدمة", value: "10 سنوات" },
        { label: "الأجر الشهري الأساسي", value: "8,000 ريال" },
        { label: "بدل السكن", value: "1,000 ريال" },
        { label: "سبب إنهاء العلاقة", value: "إنهاء من صاحب العمل بغير سبب مشروع" },
      ],
    },
    financialDetails: { visible: true, entitlements: saEntitlements, deductions: saDeductions },
    legalBasis: {
      visible: true,
      items: [
        { label: "المادة 77", text: "التعويض عن إنهاء العقد بغير سبب مشروع." },
        { label: "المادة 84", text: "استحقاق مكافأة نهاية الخدمة ومقدارها." },
        { label: "المادة 107", text: "أجر ساعات العمل الإضافية بنسبة 150 %." },
        { label: "المادة 109", text: "الإجازة السنوية وبدلها النقدي." },
      ],
      settingsVersion: "SA-RULES-2026.01",
    },
    alerts: [
      {
        severity: "warning",
        label: "مدة التقادم",
        message: "يجب رفع الدعوى خلال 12 شهراً من تاريخ نهاية الخدمة.",
      },
      {
        severity: "info",
        label: "بيانات تجريبية",
        message: "هذا التقرير للمعاينة الداخلية وفحص التصدير فقط.",
      },
    ],
    disclaimer:
      "هذا التقرير معلوماتي ويستند إلى المدخلات المقدَّمة، ولا يُعد بديلاً عن الاستشارة القانونية الرسمية.",
  };
}

export function saudiExpectations(doc: SaReportDocument): {
  items: AmountExpectation[];
  extras: AmountExpectation[];
  total: AmountExpectation;
} {
  return {
    extras: [
      { label: "إجمالي المستحقات قبل الخصم", amount: doc.summary.grossTotal },
      { label: "إجمالي الخصومات", amount: doc.summary.deductionsTotal },
    ],
    items: [
      ...doc.financialDetails.entitlements.map((r) => ({ label: r.label, amount: r.amount })),
      ...doc.financialDetails.deductions.map((r) => ({ label: r.label, amount: -r.amount })),
    ],
    total: { label: "الصافي المستحق", amount: doc.summary.netTotal },
  };
}
