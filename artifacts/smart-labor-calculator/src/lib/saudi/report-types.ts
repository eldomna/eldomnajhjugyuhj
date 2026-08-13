// نموذج التقرير النهائي الموحّد — يُبنى على الخادم ويُخزَّن كما هو (غير قابل للتعديل).

export interface SaReportSectionRow {
  label: string;
  value: string;
}

export interface SaReportMoneyRow {
  key: string;
  label: string;
  amount: number;
  formula: string;
  legalRef: string;
  explanation: string;
}

export interface SaReportDocument {
  /** رقم الإصدار من قالب التقرير الموحّد. */
  templateVersion: string;
  header: {
    platformName: string;
    logoUrl: string | null;
    title: string;
    reportNumber: string;
    version: number;
    issuedAt: string;
    generatedAt: string;
    caseId: string | null;
  };
  parties: {
    employee: string;
    employer: string;
    employeeProvided: boolean;
    employerProvided: boolean;
  };
  summary: {
    grossTotal: number;
    deductionsTotal: number;
    netTotal: number;
    currency: string;
    planCode: string;
    reportType: "مجاني" | "مدفوع";
  };
  contract: {
    rows: SaReportSectionRow[];
  };
  /** يظهر للمخوّلين فقط؛ يبقى فارغاً لغيرهم. */
  financialDetails: {
    visible: boolean;
    entitlements: SaReportMoneyRow[];
    deductions: SaReportMoneyRow[];
  };
  legalBasis: {
    visible: boolean;
    items: { label: string; text: string }[];
    settingsVersion: string;
  };
  alerts: { severity: "error" | "warning" | "info"; label: string; message: string }[];
  disclaimer: string;
}
