// بناء مستند التقرير النهائي الموحّد — خادم فقط.
import type { SaCaseInput, SaFullResult } from "./types";
import type { SaReportDocument, SaReportMoneyRow, SaReportSectionRow } from "./report-types";

export const SA_REPORT_TEMPLATE_VERSION = "SA-REPORT-1.0";

const NATIONALITY: Record<string, string> = { saudi: "سعودي", non_saudi: "غير سعودي" };
const TERMINATION: Record<string, string> = {
  employer_termination: "إنهاء من صاحب العمل",
  unlawful_termination: "فصل غير مشروع",
  resignation: "استقالة",
  mutual: "إنهاء بالتراضي",
  contract_expiry: "انتهاء مدة العقد",
  during_probation: "إنهاء خلال فترة التجربة",
};

export interface BuildReportOptions {
  reportNumber: string;
  version: number;
  planCode: string;
  showDetails: boolean;
  showLegalRefs: boolean;
  caseId: string | null;
  platformName: string;
  logoUrl: string | null;
  createdAt: string;
  settingsVersion: string;
}

export function buildSaReportDocument(
  input: SaCaseInput,
  r: SaFullResult,
  o: BuildReportOptions,
): SaReportDocument {
  const showNames = input.includeNamesInReport !== false;
  const entitlements: SaReportMoneyRow[] = r.lines
    .filter((l) => l.amount >= 0)
    .map((l) => ({ key: l.key, label: l.label, amount: l.amount, formula: l.formula, legalRef: l.legalRef, explanation: l.explanation }));
  const deductions: SaReportMoneyRow[] = r.lines
    .filter((l) => l.amount < 0)
    .map((l) => ({ key: l.key, label: l.label, amount: l.amount, formula: l.formula, legalRef: l.legalRef, explanation: l.explanation }));

  if (r.settledAmount > 0) {
    deductions.push({
      key: "settlements",
      label: "المخالصات الموثقة المخصومة",
      amount: -r.settledAmount,
      formula: `-${r.settledAmount}`,
      legalRef: "المخالصات والتسويات",
      explanation: r.settlements
        .filter((s) => s.accepted)
        .map((s) => `${s.date}: ${s.amount} — ${s.reliabilityLabel}`)
        .join(" • "),
    });
  }

  const contractRows: SaReportSectionRow[] = [
    { label: "المسمى الوظيفي", value: input.jobTitle },
    { label: "القطاع", value: input.sector },
    { label: "الجنسية", value: NATIONALITY[input.nationality] ?? input.nationality },
    { label: "تاريخ بدء العمل", value: input.startDate },
    { label: "تاريخ انتهاء العلاقة", value: input.endDate },
    { label: "مدة الخدمة", value: `${r.serviceYears} سنة (${r.serviceDays} يوم)` },
    { label: "تكييف العقد", value: r.contractClassification },
    { label: "سبب انتهاء العلاقة", value: TERMINATION[input.terminationReason] ?? input.terminationReason },
    { label: "تكييف الإنهاء", value: r.terminationClassification },
    { label: "الأجر الفعلي", value: `${r.actualWage} ر.س` },
    { label: "الأجر اليومي / بالساعة", value: `${r.dailyRate} / ${r.hourlyRate} ر.س` },
    { label: "الاشتراك في التأمينات", value: r.gosi.subscribed ? `مشترك — الأجر الخاضع ${r.gosi.subjectWage} ر.س` : "غير مشترك" },
    { label: "تاريخ تقادم الدعوى", value: `${r.limitationDate}${r.limitationExpired ? " (منتهية)" : ""}` },
  ];

  const alerts: SaReportDocument["alerts"] = r.validation.issues.map((i) => ({
    severity: i.severity === "error" ? "error" : "warning",
    label: i.label,
    message: i.message,
  }));
  if (r.limitationExpired) {
    alerts.push({ severity: "error", label: "تقادم الدعوى", message: `انتهت المدة النظامية لرفع الدعوى بتاريخ ${r.limitationDate}.` });
  }
  for (const a of r.adjustments) {
    alerts.push({ severity: "info", label: a.label, message: `${a.reason} (${a.before} ← ${a.after} ر.س)` });
  }
  for (const s of r.settlements.filter((x) => !x.accepted)) {
    alerts.push({ severity: "warning", label: "مخالصة غير موثقة", message: `${s.date} — ${s.amount} ر.س — ${s.note}` });
  }

  const legalItems = o.showLegalRefs
    ? Array.from(new Map(r.lines.map((l) => [l.legalRef, { label: l.label, text: l.legalRef }])).values())
    : [];

  const deductionsTotal = Math.abs(deductions.reduce((s, d) => s + d.amount, 0));

  return {
    templateVersion: SA_REPORT_TEMPLATE_VERSION,
    header: {
      platformName: o.platformName,
      logoUrl: o.logoUrl,
      title: "التقرير النهائي للحقوق العمالية — المملكة العربية السعودية",
      reportNumber: o.reportNumber,
      version: o.version,
      issuedAt: o.createdAt,
      generatedAt: o.createdAt,
      caseId: o.caseId,
    },
    parties: {
      employee: showNames && input.employeeName ? input.employeeName : "غير مُفصح عنه",
      employer: showNames && input.employerName ? input.employerName : "غير مُفصح عنه",
      employeeProvided: !!(showNames && input.employeeName),
      employerProvided: !!(showNames && input.employerName),
    },
    summary: {
      grossTotal: r.grossTotal,
      deductionsTotal,
      netTotal: r.total,
      currency: "SAR",
      planCode: o.planCode,
      reportType: o.planCode === "free" ? "مجاني" : "مدفوع",
    },
    contract: { rows: contractRows },
    financialDetails: {
      visible: o.showDetails,
      entitlements: o.showDetails ? entitlements : [],
      deductions: o.showDetails ? deductions : [],
    },
    legalBasis: { visible: o.showLegalRefs, items: legalItems, settingsVersion: o.settingsVersion },
    alerts,
    disclaimer:
      "هذا التقرير استرشادي يستند إلى البيانات التي أدخلها المستخدم وإلى الإعدادات النظامية المعتمدة داخل المنصة وقت الإصدار، ولا يُعد فتوى قانونية أو حكماً قضائياً. أي تعديل على البيانات يستوجب إصدار تقرير جديد برقم مستقل.",
  };
}
