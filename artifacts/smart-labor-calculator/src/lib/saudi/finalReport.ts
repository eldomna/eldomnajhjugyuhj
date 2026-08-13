// PART 1O — التقرير القانوني النهائي: بناء مستند التقرير من نتائج محرك الحساب والوحدات السابقة.
// لا يقبل أي إدخال يدوي للبيانات — كل شيء مُجمَّع من المصادر المخزَّنة.

import type { CalcSources } from "./calcEngine";

/* ============================ الأنواع ============================ */

export type ReportSectionKey =
  | "cover"
  | "executive"
  | "case"
  | "rights"
  | "details"
  | "formulas"
  | "legal"
  | "ai"
  | "alerts"
  | "payments"
  | "audit"
  | "attachments"
  | "disclaimer";

export type ReportSectionDef = {
  key: ReportSectionKey;
  name: string;
  order: number;
  visibility: "all" | "privileged";
};

export type ReportTypeDef = {
  code: string;
  label: string;
  sections: ReportSectionKey[];
};

export type FinalReportPolicy = {
  version: string;
  systemVersion: string;
  templateVersion: string;
  disclaimer: string;
  aiDisclaimer: string;
  reportTypes: ReportTypeDef[];
  sections: ReportSectionDef[];
};

export type ReportOptions = {
  reportType: string;
  language: "ar" | "en";
  includeAttachments: boolean;
  includeFormulas: boolean;
  includeLegal: boolean;
  includeAi: boolean;
  maskSensitive: boolean;
  digitalSignature: boolean;
  watermark: boolean;
  passwordProtected: boolean;
};

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  reportType: "full",
  language: "ar",
  includeAttachments: true,
  includeFormulas: true,
  includeLegal: true,
  includeAi: true,
  maskSensitive: true,
  digitalSignature: true,
  watermark: false,
  passwordProtected: false,
};

export type ReportBlock =
  | { kind: "kv"; title?: string; rows: { label: string; value: string }[] }
  | { kind: "table"; title?: string; head: string[]; rows: string[][]; totalRow?: string[] }
  | { kind: "text"; title?: string; text: string }
  | { kind: "list"; title?: string; items: string[] };

export type ReportSection = {
  key: ReportSectionKey;
  name: string;
  order: number;
  visibility: "all" | "privileged";
  blocks: ReportBlock[];
};

export type FinalReportDocument = {
  templateVersion: string;
  header: {
    platformName: string;
    logoUrl: string | null;
    title: string;
    reportNumber: string;
    reportType: string;
    reportTypeLabel: string;
    language: string;
    caseId: string | null;
    country: string;
    authority: string;
    issuedAt: string;
    systemVersion: string;
    ruleVersion: string;
    calculationVersion: number | null;
    version: number;
    verifyUrl: string;
    qrHash: string;
  };
  totals: {
    currency: string;
    totalRights: number;
    totalPaid: number;
    totalExcluded: number;
    finalBalance: number;
    confidenceScore: number;
    confidenceLabel: string;
  };
  sections: ReportSection[];
  options: ReportOptions;
  watermark: string | null;
  disclaimer: string;
  signature: { signed: boolean; hash: string; signedBy: string; signedAt: string } | null;
};

/* ============================ السياسة ============================ */

export const DEFAULT_FINAL_REPORT_POLICY: FinalReportPolicy = {
  version: "SA-REPORT-2026.1",
  systemVersion: "SLC-1.0",
  templateVersion: "1.0",
  disclaimer:
    "تم إعداد هذا التقرير اعتماداً على البيانات والمستندات المدخلة والقواعد القانونية المطبقة في تاريخ الحساب. ويُعد هذا التقرير أداة مساعدة للتحليل والاحتساب، ولا يُمثل حكماً قضائياً أو فتوى قانونية أو بديلاً عن التقدير الذي تقوم به الجهات المختصة.",
  aiDisclaimer:
    "نتائج التحليل الآلي أدناه مساعدة للمراجعة فقط، وليست رأياً قانونياً أو حكماً قضائياً.",
  reportTypes: [
    {
      code: "full",
      label: "تقرير كامل",
      sections: [
        "cover",
        "executive",
        "case",
        "rights",
        "details",
        "formulas",
        "legal",
        "ai",
        "alerts",
        "payments",
        "audit",
        "attachments",
        "disclaimer",
      ],
    },
    { code: "brief", label: "تقرير مختصر", sections: ["cover", "executive", "rights", "alerts", "disclaimer"] },
  ],
  sections: [
    { key: "cover", name: "صفحة الغلاف", order: 1, visibility: "all" },
    { key: "executive", name: "ملخص تنفيذي", order: 2, visibility: "all" },
    { key: "case", name: "بيانات القضية", order: 3, visibility: "all" },
    { key: "rights", name: "ملخص الحقوق", order: 4, visibility: "all" },
    { key: "details", name: "تفاصيل كل حق", order: 5, visibility: "all" },
    { key: "formulas", name: "المعادلات المستخدمة", order: 6, visibility: "privileged" },
    { key: "legal", name: "المواد القانونية المطبقة", order: 7, visibility: "all" },
    { key: "ai", name: "تحليل Legal AI", order: 8, visibility: "privileged" },
    { key: "alerts", name: "التنبيهات القانونية", order: 9, visibility: "all" },
    { key: "payments", name: "سجل المدفوعات", order: 10, visibility: "all" },
    { key: "audit", name: "سجل الحساب", order: 11, visibility: "all" },
    { key: "attachments", name: "المرفقات", order: 12, visibility: "all" },
    { key: "disclaimer", name: "إخلاء المسؤولية", order: 13, visibility: "all" },
  ],
};

export function toFinalReportPolicy(value: unknown): FinalReportPolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const base = DEFAULT_FINAL_REPORT_POLICY;
  const types = Array.isArray(v["report_types"]) ? (v["report_types"] as Record<string, unknown>[]) : [];
  const sections = Array.isArray(v["sections"]) ? (v["sections"] as Record<string, unknown>[]) : [];
  return {
    version: typeof v["version"] === "string" ? (v["version"] as string) : base.version,
    systemVersion:
      typeof v["system_version"] === "string" ? (v["system_version"] as string) : base.systemVersion,
    templateVersion:
      typeof v["template_version"] === "string" ? (v["template_version"] as string) : base.templateVersion,
    disclaimer: typeof v["disclaimer"] === "string" ? (v["disclaimer"] as string) : base.disclaimer,
    aiDisclaimer:
      typeof v["ai_disclaimer"] === "string" ? (v["ai_disclaimer"] as string) : base.aiDisclaimer,
    reportTypes: types.length
      ? types.map((t) => ({
          code: String(t["code"] ?? ""),
          label: String(t["label"] ?? t["code"] ?? ""),
          sections: (Array.isArray(t["sections"]) ? (t["sections"] as string[]) : []) as ReportSectionKey[],
        }))
      : base.reportTypes,
    sections: sections.length
      ? sections.map((s) => ({
          key: String(s["key"] ?? "") as ReportSectionKey,
          name: String(s["name"] ?? s["key"] ?? ""),
          order: Number(s["order"] ?? 0),
          visibility: (String(s["visibility"] ?? "all") === "privileged" ? "privileged" : "all") as
            | "all"
            | "privileged",
        }))
      : base.sections,
  };
}

/* ============================ أدوات ============================ */

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
export const reportMoney = (n: number, currency = "SAR") =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(round2(n))} ${currency}`;

const dateStr = (v: unknown) => {
  const s = v ? String(v) : "";
  if (!s) return "غير محدد";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB");
};
const dateTimeStr = (v: unknown) => {
  const s = v ? String(v) : "";
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("en-GB");
};
const txt = (v: unknown, fallback = "غير محدد") => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || fallback;
};

/** إخفاء جزء من البيانات الحساسة (رقم الهوية / الجوال) حسب سياسة الخصوصية. */
export function maskId(value: unknown, mask: boolean): string {
  const s = value ? String(value).trim() : "";
  if (!s) return "غير محدد";
  if (!mask) return s;
  if (s.length <= 4) return "****";
  return `${s.slice(0, 2)}${"*".repeat(Math.max(s.length - 4, 2))}${s.slice(-2)}`;
}

export function buildReportNumber(caseId: string | null, version: number) {
  const stamp = new Date();
  const y = stamp.getFullYear();
  const seq = String(stamp.getTime()).slice(-6);
  const short = (caseId ?? "000000").replace(/-/g, "").slice(0, 6).toUpperCase();
  return `SA-RPT-${y}-${short}-${seq}-V${version}`;
}

/** بصمة تجزئة للتحقق من عدم تعديل التقرير بعد إصداره. */
export async function hashDocument(payload: unknown): Promise<string> {
  const text = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (const b of bytes) h = (h * 31 + b) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/* ============================ المدخلات ============================ */

export type SavedCalculation = Record<string, unknown> | null;

export type AiInsight = { label: string; text: string };
export type ReportAttachment = { label: string; module: string; reference: string };

export type BuildReportArgs = {
  policy: FinalReportPolicy;
  options: ReportOptions;
  privileged: boolean;
  caseId: string | null;
  version: number;
  reportNumber: string;
  sources: CalcSources;
  calc: SavedCalculation;
  ruleVersions: Record<string, string>;
  platformName: string;
  logoUrl: string | null;
  generatedBy: string;
  verifyBaseUrl: string;
  aiInsights: AiInsight[];
};

const GROUP_LABELS: { key: string; label: string; codes: string[] }[] = [
  { key: "salary", label: "الرواتب والمبالغ غير المسددة", codes: ["unpaid_salaries", "salaries", "overtime"] },
  { key: "leave", label: "الإجازات", codes: ["annual_leave"] },
  { key: "sick", label: "الإجازة المرضية", codes: ["sick_leave"] },
  { key: "maternity", label: "الأمومة والرضاعة", codes: ["maternity"] },
  { key: "insurance", label: "التأمينات الاجتماعية", codes: ["social_insurance"] },
  { key: "gratuity", label: "مكافأة نهاية الخدمة", codes: ["eosb"] },
  { key: "compensation", label: "التعويضات", codes: ["compensation"] },
  { key: "other", label: "حقوق أخرى", codes: [] },
];

const TOTAL_FIELD: Record<string, string> = {
  salary: "total_salary",
  leave: "total_leave",
  sick: "total_sick_leave",
  maternity: "total_maternity",
  insurance: "total_insurance",
  gratuity: "total_gratuity",
  compensation: "total_compensation",
  other: "total_other",
};

const LEGAL_ARTICLES: { module: string; article: string; law: string }[] = [
  { module: "العقود", article: "المواد 50 – 58", law: "نظام العمل السعودي" },
  { module: "فترة التجربة", article: "المادة 53", law: "نظام العمل السعودي" },
  { module: "الأجور", article: "المواد 89 – 97", law: "نظام العمل السعودي" },
  { module: "ساعات العمل والعمل الإضافي", article: "المواد 98 – 107", law: "نظام العمل السعودي" },
  { module: "الإجازة السنوية", article: "المواد 109 – 111", law: "نظام العمل السعودي" },
  { module: "الإجازة المرضية", article: "المادة 117", law: "نظام العمل السعودي" },
  { module: "الأمومة وساعة الرضاعة", article: "المواد 151 – 159", law: "نظام العمل السعودي" },
  { module: "التأمينات الاجتماعية", article: "نظام التأمينات الاجتماعية", law: "المؤسسة العامة للتأمينات" },
  { module: "إنهاء العلاقة العمالية", article: "المواد 74 – 85", law: "نظام العمل السعودي" },
  { module: "مكافأة نهاية الخدمة", article: "المواد 84 – 88", law: "نظام العمل السعودي" },
  { module: "التعويضات", article: "المادة 77", law: "نظام العمل السعودي" },
  { module: "المخالصة النهائية", article: "المادة 88", law: "نظام العمل السعودي" },
];

const RULE_KEY_BY_MODULE: Record<string, string> = {
  العقود: "contracts",
  "فترة التجربة": "trial_period",
  الأجور: "salary",
  "ساعات العمل والعمل الإضافي": "working_hours",
  "الإجازة السنوية": "annual_leave",
  "الإجازة المرضية": "sick_leave",
  "الأمومة وساعة الرضاعة": "maternity",
  "التأمينات الاجتماعية": "social_insurance",
  "إنهاء العلاقة العمالية": "termination",
  "مكافأة نهاية الخدمة": "eosb",
  التعويضات: "compensation",
  "المخالصة النهائية": "final_settlement",
};

/* ============================ بناء التقرير ============================ */

export function buildFinalReport(args: BuildReportArgs): FinalReportDocument {
  const { policy, options, sources, calc, privileged } = args;
  const info = (sources.caseInfo ?? {}) as Record<string, unknown>;
  const salary = (sources.salary ?? {}) as Record<string, unknown>;
  const termination = (sources.termination ?? {}) as Record<string, unknown>;
  const results = (calc?.["results"] ?? null) as Record<string, unknown> | null;
  const currency = String(calc?.["currency"] ?? salary["currency"] ?? "SAR");

  const lines = (Array.isArray(results?.["lines"]) ? (results?.["lines"] as Record<string, unknown>[]) : []).map(
    (l) => ({
      code: String(l["code"] ?? ""),
      label: String(l["label"] ?? ""),
      amount: num(l["amount"]),
      legalRef: String(l["legalRef"] ?? ""),
      formula: String(l["formula"] ?? ""),
    }),
  );

  const formulas = Array.isArray(calc?.["formulas"])
    ? (calc?.["formulas"] as Record<string, unknown>[])
    : [];
  const eligibility = Array.isArray(calc?.["eligibility"])
    ? (calc?.["eligibility"] as Record<string, unknown>[])
    : [];
  const conflicts = Array.isArray(calc?.["conflicts"])
    ? (calc?.["conflicts"] as Record<string, unknown>[])
    : [];
  const exceptions = Array.isArray(calc?.["exceptions"])
    ? (calc?.["exceptions"] as Record<string, unknown>[])
    : [];
  const warnings = Array.isArray(results?.["warnings"]) ? (results?.["warnings"] as string[]) : [];
  const errors = Array.isArray(results?.["errors"]) ? (results?.["errors"] as string[]) : [];
  const confidence = (results?.["confidence"] ?? {}) as Record<string, unknown>;

  const totalRights = num(calc?.["total_rights"]);
  const totalPaid = num(calc?.["total_paid_rights"]);
  const totalExcluded = num(calc?.["total_excluded_rights"]);
  const finalBalance = num(calc?.["final_claim_amount"]);
  const confidenceScore = num(calc?.["confidence_score"]);

  const payments = sources.payments ?? [];
  const settlements = sources.settlements ?? [];
  const contracts = sources.contracts ?? [];

  const serviceStart =
    txt(info["service_start_date"], "") || txt((contracts[0] as any)?.start_date, "");
  const serviceEnd =
    txt(termination["last_working_day"], "") ||
    txt(info["service_end_date"], "") ||
    txt((contracts[contracts.length - 1] as any)?.end_date, "");

  const serviceDuration = (() => {
    if (!serviceStart || !serviceEnd) return "غير محددة";
    const a = new Date(serviceStart).getTime();
    const b = new Date(serviceEnd).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return "غير محددة";
    const days = Math.round((b - a) / 86400000);
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return `${years} سنة و${months} شهر (${days} يوماً)`;
  })();

  const documentsCount =
    payments.filter((p: any) => p.proof_file).length +
    (sources.unpaidSalaries ?? []).filter((u: any) => u.proof_file).length +
    (sources.sickLeave ? 1 : 0) +
    contracts.filter((c: any) => c.contract_file).length;

  const alerts: { severity: string; label: string; message: string }[] = [
    ...errors.map((m) => ({ severity: "مرتفع", label: "خطأ في البيانات", message: m })),
    ...conflicts.map((c) => ({
      severity: "مرتفع",
      label: String(c["label"] ?? "تعارض"),
      message: String(c["detail"] ?? ""),
    })),
    ...warnings
      .filter((w) => !conflicts.some((c) => String(c["detail"] ?? "") && w.includes(String(c["detail"]))))
      .map((m) => ({ severity: "متوسط", label: "تحذير", message: m })),
    ...exceptions.map((e) => ({
      severity: "منخفض",
      label: String(e["label"] ?? "حالة خاصة"),
      message: String(e["detail"] ?? ""),
    })),
  ];

  /* ---------- الأقسام ---------- */

  const groupTotals = GROUP_LABELS.map((g) => {
    const field = TOTAL_FIELD[g.key]!;
    const due = num(calc?.[field]);
    const paidForGroup = payments
      .filter((p: any) => g.codes.includes(String(p.right_type ?? "")))
      .reduce((s: number, p: any) => s + num(p.amount_paid), 0);
    const excluded = payments
      .filter((p: any) => g.codes.includes(String(p.right_type ?? "")) && p.proof_file)
      .reduce((s: number, p: any) => s + num(p.amount_paid), 0);
    return {
      label: g.label,
      due,
      paid: Math.min(paidForGroup, due),
      excluded: Math.min(excluded, due),
      remaining: Math.max(round2(due - Math.min(paidForGroup, due)), 0),
    };
  });

  const sectionBlocks: Record<ReportSectionKey, ReportBlock[]> = {
    cover: [
      {
        kind: "kv",
        rows: [
          { label: "اسم النظام", value: args.platformName },
          { label: "عنوان التقرير", value: "التقرير القانوني النهائي للحقوق العمالية" },
          { label: "رقم التقرير", value: args.reportNumber },
          { label: "رقم القضية", value: txt(args.caseId, "—") },
          { label: "الدولة", value: "المملكة العربية السعودية" },
          { label: "الجهة المرجعية", value: "وزارة الموارد البشرية والتنمية الاجتماعية" },
          { label: "تاريخ إصدار التقرير", value: dateTimeStr(new Date().toISOString()) },
        ],
      },
    ],
    executive: [
      {
        kind: "kv",
        rows: [
          { label: "حالة القضية", value: txt(calc?.["calculation_status"], "لم يُنفذ الحساب") },
          { label: "مدة الخدمة", value: serviceDuration },
          { label: "سبب انتهاء العلاقة", value: txt(termination["reason_label"] ?? termination["reason_code"]) },
          { label: "إجمالي الحقوق", value: reportMoney(totalRights, currency) },
          { label: "إجمالي المسدد", value: reportMoney(totalPaid, currency) },
          { label: "إجمالي المستبعد", value: reportMoney(totalExcluded, currency) },
          { label: "الرصيد النهائي المستحق", value: reportMoney(finalBalance, currency) },
          {
            label: "درجة اكتمال البيانات",
            value: `${confidenceScore}% — ${txt(confidence["label"], "")}`,
          },
          { label: "عدد المستندات", value: String(documentsCount) },
          { label: "عدد التنبيهات القانونية", value: String(alerts.length) },
        ],
      },
    ],
    case: [
      {
        kind: "kv",
        rows: [
          { label: "رقم القضية", value: txt(args.caseId, "—") },
          { label: "اسم العامل", value: txt(info["employee_name"]) },
          { label: "رقم الهوية", value: maskId(info["employee_id_number"], options.maskSensitive) },
          { label: "الجنس", value: txt(info["gender"]) },
          { label: "الجنسية", value: txt(info["nationality"]) },
          { label: "صاحب العمل", value: txt(info["employer_name"]) },
          { label: "الدولة", value: "SA — المملكة العربية السعودية" },
          { label: "القطاع", value: txt(info["sector"]) },
          { label: "نوع العقد", value: txt((contracts[0] as any)?.contract_type) },
          { label: "عدد العقود", value: String(contracts.length) },
          { label: "تاريخ بداية الخدمة", value: dateStr(serviceStart) },
          { label: "تاريخ انتهاء الخدمة", value: dateStr(serviceEnd) },
          { label: "مدة الخدمة", value: serviceDuration },
          { label: "العملة", value: currency },
        ],
      },
    ],
    rights: [
      {
        kind: "table",
        head: ["الحق", "المستحق", "المسدد", "المستبعد", "المتبقي"],
        rows: groupTotals.map((g) => [
          g.label,
          reportMoney(g.due, currency),
          reportMoney(g.paid, currency),
          reportMoney(g.excluded, currency),
          reportMoney(g.remaining, currency),
        ]),
        totalRow: [
          "الإجمالي النهائي",
          reportMoney(totalRights, currency),
          reportMoney(totalPaid, currency),
          reportMoney(totalExcluded, currency),
          reportMoney(finalBalance, currency),
        ],
      },
    ],
    details: lines.length
      ? lines.map((l) => ({
          kind: "kv" as const,
          title: l.label,
          rows: [
            { label: "المبلغ المحتسب", value: reportMoney(l.amount, currency) },
            { label: "طريقة الحساب", value: l.formula || "—" },
            { label: "الأساس القانوني", value: l.legalRef || "—" },
            {
              label: "الأهلية",
              value:
                txt(
                  eligibility.find((e) => String(e["code"]) === l.code)?.["reason"],
                  "مستحق وفق البيانات المدخلة",
                ) || "—",
            },
            {
              label: "التنبيهات المرتبطة",
              value:
                alerts.filter((a) => a.message.includes(l.label)).map((a) => a.message).join(" • ") ||
                "لا توجد",
            },
          ],
        }))
      : [{ kind: "text", text: "لا توجد حقوق محتسبة — يجب تنفيذ محرك الحساب أولاً." }],
    formulas: formulas.length
      ? [
          {
            kind: "table",
            head: ["اسم المعادلة", "المتغيرات", "النتيجة"],
            rows: formulas.map((f) => [
              String(f["label"] ?? f["code"] ?? ""),
              String(f["formula"] ?? "—"),
              reportMoney(num(f["amount"]), currency),
            ]),
          },
        ]
      : [{ kind: "text", text: "لا توجد معادلات مسجَّلة لهذه القضية." }],
    legal: [
      {
        kind: "table",
        head: ["الوحدة", "المادة", "اسم النظام", "تاريخ السريان"],
        rows: LEGAL_ARTICLES.map((a) => [
          a.module,
          a.article,
          a.law,
          dateStr(calc?.["calculation_completed_at"] ?? new Date().toISOString()),
        ]),
      },
    ],
    ai: [
      { kind: "text", text: policy.aiDisclaimer },
      ...(args.aiInsights.length
        ? [
            {
              kind: "kv" as const,
              rows: args.aiInsights.map((i) => ({ label: i.label, value: i.text })),
            },
          ]
        : [{ kind: "text" as const, text: "لا توجد نتائج تحليل آلي مسجَّلة لهذه القضية." }]),
    ],
    alerts: alerts.length
      ? [
          {
            kind: "table",
            head: ["التصنيف", "النوع", "التفصيل"],
            rows: alerts.map((a) => [a.severity, a.label, a.message]),
          },
        ]
      : [{ kind: "text", text: "لا توجد تنبيهات قانونية." }],
    payments: payments.length
      ? [
          {
            kind: "table",
            head: ["الحق المرتبط", "المبلغ", "تاريخ السداد", "طريقة السداد", "إثبات السداد"],
            rows: payments.map((p: any) => [
              txt(p.right_label ?? p.right_type),
              reportMoney(num(p.amount_paid), currency),
              dateStr(p.payment_date),
              txt(p.payment_method, "—"),
              p.proof_file ? "مرفق" : "غير مرفق",
            ]),
            totalRow: [
              "إجمالي المدفوعات",
              reportMoney(
                payments.reduce((s: number, p: any) => s + num(p.amount_paid), 0),
                currency,
              ),
              "",
              "",
              "",
            ],
          },
        ]
      : [{ kind: "text", text: "لا توجد مدفوعات مسجَّلة." }],
    audit: [
      {
        kind: "kv",
        rows: [
          { label: "وقت بدء الحساب", value: dateTimeStr(calc?.["calculation_started_at"]) },
          { label: "وقت اكتمال الحساب", value: dateTimeStr(calc?.["calculation_completed_at"]) },
          { label: "المستخدم", value: args.generatedBy },
          { label: "رقم نسخة الحساب", value: txt(calc?.["calculation_version"], "—") },
          { label: "Calculation ID", value: txt(calc?.["id"], "—") },
          {
            label: "Snapshot",
            value: txt((calc?.["snapshot"] as Record<string, unknown>)?.["snapshotId"], "—"),
          },
          { label: "حالة الحساب", value: txt(calc?.["calculation_status"], "—") },
        ],
      },
    ],
    attachments: (() => {
      const items: ReportAttachment[] = [
        ...contracts
          .filter((c: any) => c.contract_file)
          .map((c: any) => ({
            label: `عقد عمل — ${dateStr(c.start_date)}`,
            module: "العقود",
            reference: String(c.contract_file),
          })),
        ...(sources.unpaidSalaries ?? [])
          .filter((u: any) => u.proof_file)
          .map((u: any) => ({
            label: `إثبات سداد — ${txt(u.claim_label ?? u.claim_type, "مبلغ غير مسدد")}`,
            module: "الرواتب المتأخرة",
            reference: String(u.proof_file),
          })),
        ...settlements.map((s: any) => ({
          label: `مخالصة — ${dateStr(s.settlement_date)}`,
          module: "المخالصة النهائية",
          reference: String(s.document_file ?? "بدون ملف"),
        })),
        ...payments
          .filter((p: any) => p.proof_file)
          .map((p: any) => ({
            label: `سند سداد — ${txt(p.right_label ?? p.right_type)}`,
            module: "المدفوعات",
            reference: String(p.proof_file),
          })),
      ];
      return items.length
        ? [
            {
              kind: "table" as const,
              head: ["المرفق", "الوحدة", "المرجع"],
              rows: items.map((i) => [
                i.label,
                i.module,
                options.maskSensitive ? "مرجع داخلي محفوظ" : i.reference,
              ]),
            },
          ]
        : [{ kind: "text" as const, text: "لا توجد مرفقات مسجَّلة." }];
    })(),
    disclaimer: [{ kind: "text", text: policy.disclaimer }],
  };

  const typeDef =
    policy.reportTypes.find((t) => t.code === options.reportType) ?? policy.reportTypes[0]!;

  const included = new Set<ReportSectionKey>(typeDef.sections);
  if (!options.includeFormulas) included.delete("formulas");
  if (!options.includeLegal) included.delete("legal");
  if (!options.includeAi) included.delete("ai");
  if (!options.includeAttachments) included.delete("attachments");

  const sections: ReportSection[] = policy.sections
    .filter((s) => included.has(s.key))
    .filter((s) => (s.visibility === "privileged" ? privileged : true))
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ ...s, blocks: sectionBlocks[s.key] ?? [] }));

  return {
    templateVersion: policy.templateVersion,
    header: {
      platformName: args.platformName,
      logoUrl: args.logoUrl,
      title: "التقرير القانوني النهائي للحقوق العمالية",
      reportNumber: args.reportNumber,
      reportType: typeDef.code,
      reportTypeLabel: typeDef.label,
      language: options.language,
      caseId: args.caseId,
      country: "SA",
      authority: "وزارة الموارد البشرية والتنمية الاجتماعية",
      issuedAt: new Date().toISOString(),
      systemVersion: policy.systemVersion,
      ruleVersion: String(calc?.["rule_version"] ?? policy.version),
      calculationVersion: calc?.["calculation_version"] ? num(calc["calculation_version"]) : null,
      version: args.version,
      verifyUrl: `${args.verifyBaseUrl}/verify-report?no=${encodeURIComponent(args.reportNumber)}`,
      qrHash: "",
    },
    totals: {
      currency,
      totalRights,
      totalPaid,
      totalExcluded,
      finalBalance,
      confidenceScore,
      confidenceLabel: txt(confidence["label"], ""),
    },
    sections,
    options,
    watermark: options.watermark ? "نسخة غير رسمية — للمراجعة الداخلية" : null,
    disclaimer: policy.disclaimer,
    signature: options.digitalSignature
      ? { signed: true, hash: "", signedBy: args.generatedBy, signedAt: new Date().toISOString() }
      : null,
  };
}
