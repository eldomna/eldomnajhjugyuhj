// PART 1J — سبب انتهاء العلاقة العمالية
// محرك قرار قانوني مستقل: لا يمس محركات الحساب القائمة، وجميع الأسباب والآثار تُحمّل من محرك القوانين.

/* ============================ السياسة ============================ */

export type TerminationOption = { code: string; label: string };

export type TerminationReasonRule = {
  code: string;
  label: string;
  category: string;
  legal_ref: string;
  default_initiator: string;
  /** full | resignation_scale | none | review */
  eosb_effect: string;
  notice_required: boolean;
  /** none | notice_only | unlawful_compensation | review */
  compensation_effect: string;
  requires_incident: boolean;
  checks: string[];
};

export type TerminationPolicy = {
  legal_basis: string;
  employment_statuses: TerminationOption[];
  initiators: TerminationOption[];
  notice_methods: TerminationOption[];
  document_types: TerminationOption[];
  reasons: TerminationReasonRule[];
  notes: string;
};

const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const opts = (v: unknown, d: TerminationOption[]): TerminationOption[] =>
  Array.isArray(v)
    ? (v as Record<string, unknown>[])
        .map((o) => ({ code: str(o.code, ""), label: str(o.label, str(o.code, "")) }))
        .filter((o) => o.code)
    : d;

export const DEFAULT_TERMINATION_POLICY: TerminationPolicy = {
  legal_basis: "نظام العمل — أحكام انتهاء علاقة العمل",
  employment_statuses: [
    { code: "terminated", label: "انتهت العلاقة العمالية" },
    { code: "active", label: "العامل ما زال على رأس العمل" },
    { code: "suspended", label: "العلاقة معلقة" },
    { code: "unknown", label: "غير محددة" },
  ],
  initiators: [
    { code: "employee", label: "العامل" },
    { code: "employer", label: "صاحب العمل" },
    { code: "mutual", label: "الطرفان باتفاق" },
    { code: "automatic", label: "بسبب نظامي تلقائي" },
    { code: "government", label: "جهة حكومية" },
    { code: "court", label: "حكم قضائي" },
  ],
  notice_methods: [
    { code: "written", label: "إشعار خطي" },
    { code: "electronic", label: "إشعار إلكتروني" },
    { code: "other", label: "طريقة أخرى" },
  ],
  document_types: [
    { code: "termination_letter", label: "خطاب إنهاء" },
    { code: "resignation", label: "استقالة" },
    { code: "other", label: "مستند آخر" },
  ],
  reasons: [
    {
      code: "other",
      label: "سبب آخر",
      category: "other",
      legal_ref: "—",
      default_initiator: "employer",
      eosb_effect: "review",
      notice_required: false,
      compensation_effect: "review",
      requires_incident: false,
      checks: [],
    },
  ],
  notes: "التحليل استرشادي مبني على البيانات المدخلة ولا يُعد حكماً قضائياً.",
};

export function toTerminationPolicy(value: unknown): TerminationPolicy {
  const v = (value ?? {}) as Record<string, unknown>;
  const reasons: TerminationReasonRule[] = Array.isArray(v.reasons)
    ? (v.reasons as Record<string, unknown>[])
        .map((r) => ({
          code: str(r.code, ""),
          label: str(r.label, str(r.code, "")),
          category: str(r.category, "other"),
          legal_ref: str(r.legal_ref, "—"),
          default_initiator: str(r.default_initiator, "employer"),
          eosb_effect: str(r.eosb_effect, "review"),
          notice_required: bool(r.notice_required, false),
          compensation_effect: str(r.compensation_effect, "review"),
          requires_incident: bool(r.requires_incident, false),
          checks: Array.isArray(r.checks) ? (r.checks as unknown[]).map((c) => String(c)) : [],
        }))
        .filter((r) => r.code)
    : [];
  return {
    legal_basis: str(v.legal_basis, DEFAULT_TERMINATION_POLICY.legal_basis),
    employment_statuses: opts(v.employment_statuses, DEFAULT_TERMINATION_POLICY.employment_statuses),
    initiators: opts(v.initiators, DEFAULT_TERMINATION_POLICY.initiators),
    notice_methods: opts(v.notice_methods, DEFAULT_TERMINATION_POLICY.notice_methods),
    document_types: opts(v.document_types, DEFAULT_TERMINATION_POLICY.document_types),
    reasons: reasons.length ? reasons : DEFAULT_TERMINATION_POLICY.reasons,
    notes: str(v.notes, DEFAULT_TERMINATION_POLICY.notes),
  };
}

/* ============================ أنواع الإدخال ============================ */

export type TerminationDocRow = {
  id?: string;
  doc_type: string;
  doc_date: string;
  file_path: string;
  issuer: string;
  notes: string;
};

export const emptyTerminationDoc = (docType = "other"): TerminationDocRow => ({
  doc_type: docType,
  doc_date: "",
  file_path: "",
  issuer: "",
  notes: "",
});

export type TerminationInput = {
  employmentStatus: string;
  reasonCode: string;
  initiatedBy: string;
  reasonDetails: string;
  incidentDescription: string;
  incidentDate: string;
  terminationDate: string;
  lastWorkingDay: string;
  effectiveDate: string;
  noticeGiven: boolean;
  noticeDate: string;
  noticePeriodDays: number | "";
  noticeMethod: string;
  hasDocument: boolean;
  documents: TerminationDocRow[];
  notes: string;
  policy: TerminationPolicy | undefined;
  /** سياق من الخطوات السابقة */
  context: TerminationContext;
};

export type TerminationContext = {
  serviceStart: string | null;
  serviceEnd: string | null;
  contractTypes: string[];
  contractsCount: number;
  renewedCount: number;
  hasTrialPeriod: boolean;
  trialEndDate: string | null;
  endedDuringTrial: boolean;
  gender?: string | null;
};

/* ============================ أدوات ============================ */

const D = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
export const daysBetween = (a: string, b: string) => {
  const x = D(a);
  const y = D(b);
  if (!x || !y) return 0;
  return Math.round((y.getTime() - x.getTime()) / 86400000);
};

export function serviceYears(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const d = daysBetween(start, end);
  return d <= 0 ? 0 : d / 365.25;
}

export const EOSB_EFFECT_LABELS: Record<string, string> = {
  full: "تُحتسب مكافأة نهاية الخدمة كاملة وفق مدة الخدمة",
  resignation_scale: "تُحتسب مكافأة نهاية الخدمة وفق نسب الاستقالة المقررة",
  none: "لا تُحتسب مكافأة نهاية الخدمة وفق القاعدة المطبقة",
  review: "أثر المكافأة يحتاج مراجعة قانونية",
};

export const COMPENSATION_EFFECT_LABELS: Record<string, string> = {
  none: "لا يُحتسب تعويض إنهاء",
  notice_only: "يُحتسب بدل الإشعار فقط عند عدم منح الإشعار",
  unlawful_compensation: "يُحتسب تعويض الإنهاء غير المشروع وفق القاعدة المطبقة",
  review: "أثر التعويض يحتاج مراجعة قانونية",
};

/* ============================ محرك القرار ============================ */

export type TerminationWarning = {
  level: "error" | "warning" | "info";
  message: string;
};

export type TerminationAnalysis = {
  status: "matched" | "conflict" | "insufficient" | "review" | "ongoing";
  statusLabel: string;
  statusMessage: string;
  reason: TerminationReasonRule | null;
  category: string;
  warnings: TerminationWarning[];
  serviceYears: number;
  noticeShortfallDays: number | null;
  effects: {
    eosb: string;
    eosbLabel: string;
    compensation: string;
    compensationLabel: string;
    noticeAllowance: "due" | "not_due" | "review";
    noticeAllowanceLabel: string;
    excludedRights: string[];
    periodicRightsOnly: boolean;
    legalRef: string;
  };
  handoff: Record<string, unknown>;
};

export function analyzeTermination(input: TerminationInput): TerminationAnalysis {
  const policy = input.policy ?? DEFAULT_TERMINATION_POLICY;
  const warnings: TerminationWarning[] = [];
  const ctx = input.context;
  const reason = policy.reasons.find((r) => r.code === input.reasonCode) ?? null;

  const push = (level: TerminationWarning["level"], message: string) =>
    warnings.push({ level, message });

  /* --- العامل ما زال على رأس العمل --- */
  if (input.employmentStatus === "active") {
    return {
      status: "ongoing",
      statusLabel: "العلاقة العمالية مستمرة",
      statusMessage:
        "العامل ما زال على رأس العمل، لذلك لا تُحتسب مكافأة نهاية الخدمة ولا تعويضات الإنهاء، ويقتصر الاحتساب على الحقوق الدورية مع إصدار تقرير مرحلي.",
      reason: null,
      category: "ongoing",
      warnings: [
        {
          level: "info",
          message:
            "سيتم الانتقال إلى التقرير المرحلي مع احتساب الحقوق الدورية فقط (الأجور، الإضافي، الإجازات، الاشتراكات).",
        },
      ],
      serviceYears: serviceYears(ctx.serviceStart, ctx.serviceEnd),
      noticeShortfallDays: null,
      effects: {
        eosb: "none",
        eosbLabel: "لا تُحتسب مكافأة نهاية الخدمة (العلاقة مستمرة)",
        compensation: "none",
        compensationLabel: "لا تُحتسب تعويضات إنهاء (العلاقة مستمرة)",
        noticeAllowance: "not_due",
        noticeAllowanceLabel: "لا ينطبق بدل الإشعار",
        excludedRights: ["مكافأة نهاية الخدمة", "تعويض الإنهاء", "بدل الإشعار"],
        periodicRightsOnly: true,
        legalRef: policy.legal_basis,
      },
      handoff: { employment_status: "active", periodic_rights_only: true },
    };
  }

  if (input.employmentStatus === "suspended") {
    push(
      "warning",
      "العلاقة العمالية معلقة، وقد يتوقف احتساب بعض الحقوق على تحديد طبيعة التعليق ومدته.",
    );
  }
  if (input.employmentStatus === "unknown") {
    push("warning", "لم يتم تحديد حالة العلاقة العمالية بشكل دقيق.");
  }

  /* --- التحققات العامة --- */
  if (!reason) push("error", "لم يتم تحديد سبب انتهاء العلاقة العمالية.");
  if (!input.initiatedBy) push("warning", "لم يتم تحديد الجهة التي أنهت العلاقة العمالية.");
  if (!input.terminationDate) push("error", "تاريخ انتهاء العلاقة العمالية مطلوب.");
  if (!input.lastWorkingDay) push("warning", "لم يتم إدخال آخر يوم عمل فعلي.");

  const endDate = input.effectiveDate || input.terminationDate;

  if (input.lastWorkingDay && input.terminationDate && daysBetween(input.lastWorkingDay, input.terminationDate) < 0) {
    push("error", "تاريخ الإنهاء لا يمكن أن يكون قبل آخر يوم عمل.");
  }
  if (input.effectiveDate && input.terminationDate && daysBetween(input.terminationDate, input.effectiveDate) < 0) {
    push("warning", "تاريخ سريان الإنهاء يسبق تاريخ الإنهاء المدخل.");
  }
  if (ctx.serviceStart && endDate && daysBetween(ctx.serviceStart, endDate) < 0) {
    push("error", "تاريخ الإنهاء يسبق تاريخ بداية أول عقد في الخطوة الثانية.");
  }
  if (ctx.serviceEnd && endDate && Math.abs(daysBetween(ctx.serviceEnd, endDate)) > 31) {
    push(
      "warning",
      "يوجد فرق يتجاوز شهراً بين تاريخ الإنهاء المدخل وتاريخ نهاية العقود المسجلة في الخطوة الثانية.",
    );
  }
  if (!ctx.contractsCount) {
    push("warning", "لا توجد عقود مسجلة في الخطوة الثانية للتحقق من توافق تاريخ الإنهاء.");
  }

  /* --- الإشعار --- */
  let noticeShortfallDays: number | null = null;
  if (input.noticeGiven) {
    if (!input.noticeDate) push("warning", "لم يتم إدخال تاريخ الإشعار.");
    if (!input.noticePeriodDays) push("warning", "لم يتم إدخال مدة الإشعار.");
    if (!input.noticeMethod) push("warning", "لم يتم تحديد طريقة الإشعار.");
    if (input.noticeDate && endDate) {
      const actual = daysBetween(input.noticeDate, endDate);
      if (actual < 0) push("error", "تاريخ الإشعار لاحق لتاريخ انتهاء العلاقة العمالية.");
      else if (typeof input.noticePeriodDays === "number" && input.noticePeriodDays > 0) {
        noticeShortfallDays = Math.max(0, input.noticePeriodDays - actual);
        if (noticeShortfallDays > 0) {
          push(
            "warning",
            `المدة الفعلية بين الإشعار وتاريخ الإنهاء (${actual} يوماً) أقل من مدة الإشعار المدخلة بمقدار ${noticeShortfallDays} يوماً.`,
          );
        }
      }
    }
  } else if (reason?.notice_required) {
    push(
      "warning",
      "السبب المختار يستوجب إشعاراً وفق القاعدة المطبقة، ولم يتم إثبات وجود إشعار — قد ينشأ استحقاق لبدل الإشعار.",
    );
  }

  /* --- المستندات --- */
  const docs = input.documents.filter((d) => d.doc_type);
  if (!input.hasDocument || !docs.length) {
    push(
      "warning",
      "لم يتم إرفاق مستند يثبت سبب انتهاء العلاقة العمالية، وقد يؤثر ذلك على تقييم بعض المطالبات القانونية.",
    );
  }
  const missingFiles = docs.filter((d) => !d.file_path).length;
  if (missingFiles) push("info", `${missingFiles} مستند مُسجل بدون ملف مرفوع.`);

  const docCodes = new Set(docs.map((d) => d.doc_type));
  const conflictPairs: Array<[string, string, string]> = [
    ["resignation", "dismissal_decision", "يوجد تعارض بين مستند استقالة ومستند قرار فصل."],
    ["resignation", "termination_letter", "يوجد استقالة وخطاب إنهاء في الملف نفسه — يلزم تحديد المستند المعتمد."],
  ];
  for (const [a, b, msg] of conflictPairs) {
    if (docCodes.has(a) && docCodes.has(b)) push("warning", msg);
  }

  /* --- تحققات خاصة بكل سبب --- */
  const checks = reason?.checks ?? [];

  if (checks.includes("contract_expiry")) {
    if (ctx.contractTypes.includes("indefinite")) {
      push(
        "warning",
        "أحد العقود غير محدد المدة، ولا يتصور انتهاؤه بانتهاء المدة — يرجى مراجعة سبب الإنهاء.",
      );
    }
    if (ctx.renewedCount > 0) {
      push("info", `سبق تجديد العقد ${ctx.renewedCount} مرة، وقد يؤثر ذلك على تكييف العقد ومدة الخدمة.`);
    }
    if (ctx.serviceEnd && endDate && daysBetween(ctx.serviceEnd, endDate) > 15) {
      push(
        "warning",
        "استمر العامل بعد تاريخ انتهاء العقد المسجل، وقد يعد ذلك تجديداً ضمنياً أو تحولاً إلى عقد غير محدد المدة.",
      );
    }
  }

  if (checks.includes("resignation")) {
    if (input.initiatedBy && input.initiatedBy !== "employee" && input.initiatedBy !== "mutual") {
      push("warning", "سبب الاستقالة لا يتوافق مع كون الجهة المنهية غير العامل.");
    }
    if (!docCodes.has("resignation")) {
      push("warning", "لم يتم إرفاق طلب الاستقالة أو ما يثبت تاريخ قبولها ونفاذها.");
    }
    if (docCodes.has("dismissal_decision") || docCodes.has("termination_letter")) {
      push("error", "يوجد تعارض بين سبب الاستقالة والمستندات المرفقة (قرار فصل/خطاب إنهاء).");
    }
  }

  if (checks.includes("dismissal")) {
    if (input.initiatedBy && !["employer", "court", "government"].includes(input.initiatedBy)) {
      push("warning", "سبب الفصل/الإنهاء لا يتوافق مع كون الجهة المنهية هي العامل.");
    }
    if (!docCodes.has("dismissal_decision") && !docCodes.has("termination_letter") && !docCodes.has("court_ruling")) {
      push("warning", "لم يتم إرفاق قرار الفصل أو خطاب الإنهاء لإثبات سبب الإنهاء.");
    }
    if (docCodes.has("resignation")) {
      push("error", "يوجد تعارض بين سبب الفصل/الإنهاء ووجود مستند استقالة.");
    }
  }

  if (checks.includes("trial_period")) {
    if (!ctx.hasTrialPeriod) {
      push("error", "لا توجد فترة تجربة مسجلة في الخطوة الثالثة، ولا يصح الإنهاء خلال فترة التجربة.");
    } else if (ctx.trialEndDate && endDate && daysBetween(ctx.trialEndDate, endDate) > 0) {
      push(
        "error",
        "تاريخ الإنهاء لاحق لانتهاء فترة التجربة المسجلة في الخطوة الثالثة — يوجد تعارض في البيانات.",
      );
    }
    if (serviceYears(ctx.serviceStart, endDate) > 1) {
      push("warning", "مدة الخدمة تجاوزت سنة، وهو ما لا يتوافق عادة مع الإنهاء خلال فترة التجربة.");
    }
  }

  if (checks.includes("article_80") || checks.includes("article_81")) {
    if (!input.incidentDescription.trim()) {
      push("error", "يلزم وصف الواقعة المستند إليها في الإنهاء وفق النص القانوني الخاص.");
    }
    if (!input.incidentDate) push("warning", "لم يتم إدخال تاريخ الواقعة.");
    if (!docs.length) push("warning", "لا توجد مستندات مؤيدة للواقعة المستند إليها.");
    push(
      "info",
      "يُترك التقييم القانوني النهائي للجهة المختصة، وتُستخدم هذه البيانات في احتساب الحقوق وفق القواعد المطبقة.",
    );
  }

  if (checks.includes("force_majeure")) {
    if (!input.incidentDescription.trim()) push("error", "يلزم وصف حدث القوة القاهرة.");
    if (!input.incidentDate) push("warning", "لم يتم إدخال تاريخ حدث القوة القاهرة.");
  }

  if (checks.includes("permit")) {
    push(
      "info",
      reason?.code === "permit_expiry_employer_fault"
        ? "تُعامل الحالة كسبب يعود إلى صاحب العمل وفق القواعد القانونية المطبقة في الدولة المختارة."
        : "تُطبق القواعد القانونية الخاصة بانتهاء الرخصة بسبب العامل وفق الدولة المختارة.",
    );
  }

  if (reason?.requires_incident && !input.incidentDescription.trim() && !checks.length) {
    push("warning", "السبب المختار يحتاج وصف الواقعة والمستندات المؤيدة.");
  }

  /* --- الحالة النهائية --- */
  const hasError = warnings.some((w) => w.level === "error");
  const hasWarning = warnings.some((w) => w.level === "warning");
  const missingCore =
    !reason || !input.terminationDate || !input.initiatedBy || input.employmentStatus === "unknown";

  let status: TerminationAnalysis["status"] = "matched";
  if (hasError) status = "conflict";
  else if (missingCore) status = "insufficient";
  else if (reason.eosb_effect === "review" || reason.compensation_effect === "review" || hasWarning)
    status = hasWarning && reason.eosb_effect !== "review" ? "review" : "review";

  const statusMeta: Record<TerminationAnalysis["status"], { label: string; message: string }> = {
    matched: {
      label: "متوافق",
      message: "السبب المدخل يتوافق مع البيانات المتوفرة.",
    },
    conflict: {
      label: "تعارض",
      message: "يوجد تعارض بين سبب الإنهاء والبيانات أو المستندات المرفقة.",
    },
    insufficient: {
      label: "بيانات غير كافية",
      message: "توجد بيانات غير كافية لتحديد سبب انتهاء العلاقة بشكل دقيق.",
    },
    review: {
      label: "يحتاج مراجعة قانونية",
      message: "يحتاج الملف إلى مراجعة قانونية إضافية.",
    },
    ongoing: { label: "علاقة مستمرة", message: "" },
  };

  const eosb = reason?.eosb_effect ?? "review";
  const compensation = reason?.compensation_effect ?? "review";
  const noticeAllowance: "due" | "not_due" | "review" = !reason
    ? "review"
    : reason.notice_required && (!input.noticeGiven || (noticeShortfallDays ?? 0) > 0)
      ? "due"
      : reason.notice_required
        ? "not_due"
        : "not_due";

  const excludedRights: string[] = [];
  if (eosb === "none") excludedRights.push("مكافأة نهاية الخدمة");
  if (compensation === "none") excludedRights.push("تعويض الإنهاء");
  if (!reason?.notice_required) excludedRights.push("بدل الإشعار");

  return {
    status,
    statusLabel: statusMeta[status].label,
    statusMessage: statusMeta[status].message,
    reason,
    category: reason?.category ?? "unknown",
    warnings,
    serviceYears: serviceYears(ctx.serviceStart, endDate || ctx.serviceEnd),
    noticeShortfallDays,
    effects: {
      eosb,
      eosbLabel: EOSB_EFFECT_LABELS[eosb] ?? EOSB_EFFECT_LABELS.review,
      compensation,
      compensationLabel: COMPENSATION_EFFECT_LABELS[compensation] ?? COMPENSATION_EFFECT_LABELS.review,
      noticeAllowance,
      noticeAllowanceLabel:
        noticeAllowance === "due"
          ? "يُحتسب بدل الإشعار وفق المدة الناقصة"
          : noticeAllowance === "review"
            ? "بدل الإشعار يحتاج مراجعة"
            : "لا يُحتسب بدل الإشعار",
      excludedRights,
      periodicRightsOnly: false,
      legalRef: reason?.legal_ref ?? policy.legal_basis,
    },
    handoff: {
      employment_status: input.employmentStatus,
      reason_code: reason?.code ?? null,
      reason_label: reason?.label ?? null,
      category: reason?.category ?? null,
      initiated_by: input.initiatedBy,
      termination_date: input.terminationDate || null,
      last_working_day: input.lastWorkingDay || null,
      effective_date: endDate || null,
      notice: {
        given: input.noticeGiven,
        date: input.noticeDate || null,
        period_days: input.noticePeriodDays === "" ? null : input.noticePeriodDays,
        method: input.noticeMethod || null,
        shortfall_days: noticeShortfallDays,
      },
      eosb_effect: eosb,
      compensation_effect: compensation,
      notice_allowance: noticeAllowance,
      excluded_rights: excludedRights,
      legal_ref: reason?.legal_ref ?? null,
      analysis_status: status,
    },
  };
}

/* ============================ التحقق ============================ */

export function validateTermination(input: TerminationInput): string[] {
  const e: string[] = [];
  if (!input.employmentStatus) e.push("يرجى تحديد حالة العلاقة العمالية");
  if (input.employmentStatus === "active") return e;

  if (!input.reasonCode) e.push("يرجى تحديد سبب انتهاء العلاقة العمالية");
  if (!input.initiatedBy) e.push("يرجى تحديد الجهة التي أنهت العلاقة");
  if (!input.terminationDate) e.push("تاريخ انتهاء العلاقة العمالية مطلوب");
  if (input.lastWorkingDay && input.terminationDate && daysBetween(input.lastWorkingDay, input.terminationDate) < 0)
    e.push("تاريخ الإنهاء لا يمكن أن يكون قبل آخر يوم عمل");
  if (input.noticeGiven && !input.noticeDate) e.push("تاريخ الإشعار مطلوب عند وجود إشعار");
  if (input.noticeGiven && !input.noticePeriodDays) e.push("مدة الإشعار مطلوبة عند وجود إشعار");
  if (input.hasDocument && !input.documents.length) e.push("يرجى إضافة مستند واحد على الأقل أو اختيار (لا)");

  const rule = (input.policy ?? DEFAULT_TERMINATION_POLICY).reasons.find(
    (r) => r.code === input.reasonCode,
  );
  if (rule?.requires_incident && !input.incidentDescription.trim())
    e.push("وصف الواقعة مطلوب للسبب المختار");
  return e;
}
