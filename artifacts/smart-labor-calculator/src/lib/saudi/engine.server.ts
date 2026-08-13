// Saudi Regulatory Engine — pure computation.
// Every legal rule is READ from the regulatory settings table; nothing is
// hardcoded here. Server-only: never imported by client code.

import type {
  SaAdjustmentResult,
  SaAuditEntry,
  SaCaseInput,
  SaFullResult,
  SaResultLine,
  SaSettlementResult,
  SaValidationIssue,
  SaValidationReport,
} from "./types";


export type SettingsMap = Record<string, any>;

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : fallback;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function daysBetween(a: string, b: string) {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (!Number.isFinite(d1) || !Number.isFinite(d2)) return 0;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

export function computeSaudiCase(input: SaCaseInput, s: SettingsMap): SaFullResult {
  const audit: SaAuditEntry[] = [];
  const lines: SaResultLine[] = [];

  const hoursCfg = s.working_hours ?? {};
  const otCfg = s.overtime ?? {};
  const holCfg = s.holiday_work ?? {};
  const eosbCfg = s.eosb ?? {};
  const alCfg = s.annual_leave ?? {};
  const slCfg = s.sick_leave ?? {};
  const noticeCfg = s.notice_period ?? {};
  const probCfg = s.probation ?? {};
  const compCfg = s.termination_compensation ?? {};
  const convCfg = s.contract_conversion ?? {};
  const limCfg = s.claim_limitation ?? {};
  const femCfg = s.female_rights ?? {};
  const gosiCfg = s.gosi ?? {};
  const resignCfg = s.resignation_rules ?? {};
  const adjCfg = s.benefit_adjustment ?? {};
  const setCfg = s.settlement ?? {};

  // ---- Step 11: intermediate validation ---------------------------------
  const validation = validateSaCase(input, s);
  audit.push({
    step: "validation",
    decision: validation.ok ? "اجتازت البيانات المراجعة المرحلية" : "توجد ملاحظات على البيانات",
    reason: validation.issues.length
      ? validation.issues.map((i) => `${i.label}: ${i.message}`).join(" | ")
      : "جميع البيانات الإلزامية مكتملة ولا يوجد تعارض بين المدخلات.",
  });


  // ---- Step 4: wage analysis -------------------------------------------
  const w = input.wage;
  const actualWage = round2(num(w.basic) + num(w.housing) + num(w.transport) + num(w.otherFixed));
  const daysPerMonth = num(hoursCfg.days_per_month, 30);
  const dailyRate = round2(actualWage / daysPerMonth);

  // ---- Step 5: working hours -------------------------------------------
  const stdDaily = num(hoursCfg.daily, 8);
  const ramadanDaily = num(hoursCfg.ramadan_daily, 6);
  const effectiveDaily =
    input.ramadanApplies
      ? num(input.ramadanDailyHours, ramadanDaily)
      : num(input.dailyHours, stdDaily);
  const hourlyRate = round2(dailyRate / (effectiveDaily || stdDaily));

  audit.push({
    step: "wages",
    decision: `الأجر الفعلي ${actualWage} ر.س`,
    reason: "الأجر الأساسي مضافاً إليه البدلات الثابتة وفق الإعدادات النظامية المعتمدة.",
  });
  audit.push({
    step: "working_hours",
    decision: `${effectiveDaily} ساعة يومياً`,
    reason: input.ramadanApplies
      ? `تم تطبيق ساعات العمل النظامية الخاصة برمضان (${ramadanDaily} ساعات) وفق الإعدادات.`
      : `ساعات العمل النظامية المعتمدة ${stdDaily} ساعات يومياً و${num(hoursCfg.weekly, 48)} أسبوعياً.`,
  });

  // ---- Steps 1-2: service duration and contract classification ---------
  const serviceDays = daysBetween(input.startDate, input.endDate);
  const serviceYears = round2(serviceDays / 365);

  let classification = input.contractType === "fixed" ? "عقد محدد المدة" : "عقد غير محدد المدة";
  let classificationReason = "تم اعتماد نوع العقد كما أُدخل دون توفر شروط التحويل النظامية.";

  if (input.contractType === "fixed") {
    if (input.nationality === "saudi") {
      const maxRenewals = num(convCfg.saudi_max_renewals, 3);
      const maxYears = num(convCfg.saudi_max_years, 4);
      if (num(input.renewals) >= maxRenewals || serviceYears >= maxYears) {
        classification = "عقد غير محدد المدة (بحكم التحويل النظامي)";
        classificationReason = `العامل سعودي وتحقق شرط التحويل: عدد التجديدات ${input.renewals} أو مدة الخدمة ${serviceYears} سنة، والحد المعتمد ${maxRenewals} تجديدات أو ${maxYears} سنوات.`;
      }
    } else if (convCfg.non_saudi_follows_permit !== false) {
      classificationReason =
        "العامل غير سعودي، ويبقى العقد محدد المدة مرتبطاً بمدة رخصة العمل وفق القواعد المعتمدة في لوحة التحكم.";
    }
  }
  audit.push({ step: "contract", decision: classification, reason: classificationReason });

  // ---- Step 3: probation -----------------------------------------------
  const probMax = num(probCfg.max_days, 90);
  const probExtMax = num(probCfg.extended_max_days, 180);
  let probationValid = false;
  if (input.hasProbation) {
    const limit = input.probationWritten ? probExtMax : probMax;
    probationValid = num(input.probationDays) <= limit;
    audit.push({
      step: "probation",
      decision: probationValid ? "فترة تجربة نظامية" : "فترة تجربة تتجاوز الحد النظامي",
      reason: `مدة التجربة المدخلة ${input.probationDays} يوماً، والحد المعتمد ${limit} يوماً${
        input.probationWritten ? " (باتفاق كتابي)" : ""
      }.`,
    });
  } else {
    audit.push({ step: "probation", decision: "لا توجد فترة تجربة", reason: "لم يُدخل شرط فترة تجربة." });
  }
  const endedInProbation = input.hasProbation && input.endedDuringProbation && probationValid;

  // ---- End of service award --------------------------------------------
  const firstYears = num(eosbCfg.first_years, 5);
  const firstRate = num(eosbCfg.first_rate, 0.5);
  const afterRate = num(eosbCfg.after_rate, 1);
  let eosb = 0;
  let eosbFormula = "";
  let eosbReason = "";

  if (endedInProbation && probCfg.eosb_entitled === false) {
    eosbReason = "انتهت العلاقة العمالية أثناء فترة التجربة النظامية، ولا تُستحق مكافأة نهاية خدمة وفق الإعدادات المعتمدة.";
    eosbFormula = "0";
  } else {
    const y1 = Math.min(serviceYears, firstYears);
    const y2 = Math.max(0, serviceYears - firstYears);
    let gross = y1 * firstRate * actualWage + y2 * afterRate * actualWage;
    eosbFormula = `(${round2(y1)} × ${firstRate} + ${round2(y2)} × ${afterRate}) × ${actualWage}`;
    eosbReason = `نصف أجر شهر عن كل سنة من السنوات ${firstYears} الأولى وأجر شهر كامل عن كل سنة تالية، وفق النسب المعتمدة في لوحة التحكم.`;

    if (input.terminationReason === "resignation") {
      const scale: any[] = Array.isArray(eosbCfg.resignation_scale) ? eosbCfg.resignation_scale : [];
      const tier = scale.find(
        (t) => serviceYears >= num(t.from) && (t.to === null || t.to === undefined || serviceYears < num(t.to)),
      );
      const rate = tier ? num(tier.rate) : 1;
      gross = gross * rate;
      eosbFormula += ` × ${rate}`;
      eosbReason += ` وبما أن انتهاء العلاقة كان باستقالة العامل، طُبقت نسبة الاستحقاق ${Math.round(rate * 100)}% المقررة لمدة خدمة ${serviceYears} سنة.`;
    }
    eosb = round2(gross);
  }

  lines.push({
    key: "eosb",
    label: "مكافأة نهاية الخدمة",
    amount: eosb,
    formula: eosbFormula,
    legalRef: "نظام العمل السعودي — أحكام مكافأة نهاية الخدمة",
    explanation: eosbReason,
  });
  audit.push({ step: "eosb", decision: `${eosb} ر.س`, reason: eosbReason });

  // ---- Step 17: notice period engine -------------------------------------
  const noticeDays =
    input.contractType === "indefinite"
      ? input.paidMonthly
        ? num(noticeCfg.indefinite_monthly_days, 60)
        : num(noticeCfg.indefinite_other_days, 30)
      : num(noticeCfg.fixed_term_days, 30);

  // المدة الفعلية: تُستخرج من تاريخ الإشعار وتاريخ الانتهاء عند توفرهما، وإلا من الأيام المدخلة.
  const noticeFromDates = input.terminationNoticeDate
    ? daysBetween(input.terminationNoticeDate, input.endDate)
    : null;
  const actualNoticeDays = noticeFromDates ?? (input.noticeGiven ? num(input.noticeDaysGiven) : 0);
  const noticeShortfall = Math.max(0, noticeDays - actualNoticeDays);

  let noticeAmount = 0;
  let noticeReason = "تم الالتزام بمهلة الإشعار النظامية كاملة، فلا يُستحق بدل إشعار.";
  const employerSideEnd =
    input.terminationReason === "employer_termination" || input.terminationReason === "unlawful_termination";

  if (endedInProbation) {
    noticeReason = "انتهت العلاقة أثناء فترة التجربة النظامية، ولا تسري مهلة الإشعار وفق الإعدادات المعتمدة.";
  } else if (employerSideEnd) {
    noticeAmount = round2(noticeShortfall * dailyRate);
    noticeReason = `الطرف المُنهي هو صاحب العمل. مهلة الإشعار النظامية ${noticeDays} يوماً لهذا النوع من العقود، والمدة الفعلية ${actualNoticeDays} يوماً${
      noticeFromDates !== null ? " (محسوبة من تاريخ الإشعار حتى تاريخ الانتهاء)" : ""
    }، فيُستحق بدل عن ${noticeShortfall} يوماً.`;
  } else if (input.terminationReason === "resignation") {
    if (noticeShortfall > 0 && resignCfg.breach_charged_to_employee !== false) {
      noticeAmount = -round2(noticeShortfall * dailyRate);
      noticeReason = `الطرف المُنهي هو العامل (استقالة). مهلة الإشعار النظامية ${noticeDays} يوماً والمدة الفعلية ${actualNoticeDays} يوماً، ويُحمَّل العامل مقابل الإخلال عن ${noticeShortfall} يوماً وفق الإعدادات المعتمدة.`;
    } else {
      noticeReason = `الطرف المُنهي هو العامل، والتزم بمهلة الإشعار النظامية البالغة ${noticeDays} يوماً.`;
    }
  }
  lines.push({
    key: "notice",
    label: noticeAmount < 0 ? "خصم الإخلال بمهلة الإشعار" : "بدل مهلة الإشعار",
    amount: noticeAmount,
    formula: `${noticeShortfall} يوم × ${dailyRate}`,
    legalRef: "نظام العمل السعودي — مهلة الإشعار وأثر الإخلال بها",
    explanation: noticeReason,
  });
  audit.push({
    step: "notice_period",
    decision: `${noticeAmount} ر.س`,
    reason: `المدة النظامية ${noticeDays} يوماً، الفعلية ${actualNoticeDays} يوماً، الفارق ${noticeShortfall} يوماً. ${noticeReason}`,
  });


  // ---- Unlawful termination compensation --------------------------------
  let compAmount = 0;
  let compReason = "لم تتحقق حالة الفصل غير المشروع، فلا يُستحق تعويض.";
  if (input.terminationReason === "unlawful_termination") {
    if (classification.startsWith("عقد غير محدد")) {
      const perYear = num(compCfg.indefinite_days_per_year, 15);
      const minMonths = num(compCfg.indefinite_min_months, 2);
      const calc = serviceYears * perYear * dailyRate;
      compAmount = round2(Math.max(calc, minMonths * actualWage));
      compReason = `تعويض العقد غير محدد المدة بواقع ${perYear} يوماً عن كل سنة خدمة، وبحد أدنى أجر ${minMonths} شهرين.`;
    } else {
      const remaining = input.contractTermEnd ? daysBetween(input.endDate, input.contractTermEnd) : 0;
      compAmount = round2(remaining * dailyRate);
      compReason = `تعويض العقد محدد المدة يعادل أجر المدة المتبقية من العقد وقدرها ${remaining} يوماً.`;
    }
  }
  lines.push({
    key: "termination_compensation",
    label: "تعويض الفصل غير المشروع",
    amount: compAmount,
    formula: compReason,
    legalRef: "نظام العمل السعودي — التعويض عن إنهاء العقد لسبب غير مشروع",
    explanation: compReason,
  });
  audit.push({ step: "compensation", decision: `${compAmount} ر.س`, reason: compReason });

  // ---- Step 6: overtime --------------------------------------------------
  const otRate = num(otCfg.rate, 1.5);
  const otAmount = round2(num(input.overtimeHours) * hourlyRate * otRate);
  lines.push({
    key: "overtime",
    label: "أجر الساعات الإضافية",
    amount: otAmount,
    formula: `${num(input.overtimeHours)} ساعة × ${hourlyRate} × ${otRate}`,
    legalRef: "نظام العمل السعودي — أجر ساعات العمل الإضافية",
    explanation: `تُحتسب الساعة الإضافية بنسبة ${Math.round(otRate * 100)}% من أجر الساعة، وفق النسبة المعتمدة في لوحة التحكم.`,
  });
  audit.push({ step: "overtime", decision: `${otAmount} ر.س`, reason: `${num(input.overtimeHours)} ساعة إضافية بنسبة ${otRate}.` });

  // ---- Step 7: official holiday work -------------------------------------
  const holRate = num(holCfg.rate, 2);
  const holHours = (input.holidayWork ?? []).reduce((a, e) => a + num(e.hours), 0);
  const holAmount = round2(holHours * hourlyRate * holRate);
  lines.push({
    key: "holiday_work",
    label: "أجر العمل في الإجازات الرسمية",
    amount: holAmount,
    formula: `${holHours} ساعة × ${hourlyRate} × ${holRate}`,
    legalRef: "نظام العمل السعودي — العمل في الأعياد والمناسبات الرسمية",
    explanation: `العمل خلال الإجازات الرسمية المعتمدة يُعوَّض بنسبة ${Math.round(holRate * 100)}% وفق جدول الإجازات المُدار من لوحة التحكم.`,
  });
  audit.push({ step: "holiday_work", decision: `${holAmount} ر.س`, reason: `${holHours} ساعة عمل خلال إجازات رسمية معتمدة.` });

  // ---- Step 8: outstanding wages -----------------------------------------
  const unpaid = (input.unpaidWages ?? []).filter((e) => !e.paid);
  const unpaidAmount = round2(unpaid.reduce((a, e) => a + num(e.amount), 0));
  lines.push({
    key: "unpaid_wages",
    label: "الأجور والرواتب المتأخرة",
    amount: unpaidAmount,
    formula: `${unpaid.length} مستحق غير مسدد`,
    legalRef: "نظام العمل السعودي — التزام صاحب العمل بأداء الأجر",
    explanation: "مجموع الرواتب والمستحقات التي لم تُسدد للعامل خلال فترة الخدمة حسب البيانات المدخلة.",
  });
  audit.push({ step: "unpaid_wages", decision: `${unpaidAmount} ر.س`, reason: `${unpaid.length} مستحق غير مسدد.` });

  // ---- Step 9: annual leave balance ---------------------------------------
  const baseDays = num(alCfg.base_days, 21);
  const longDays = num(alCfg.long_service_days, 30);
  const longYears = num(alCfg.long_service_years, 5);
  const perYear = serviceYears >= longYears ? longDays : baseDays;
  const entitled =
    input.annualLeaveEntitledDays !== null && input.annualLeaveEntitledDays !== undefined
      ? num(input.annualLeaveEntitledDays)
      : round2(perYear * serviceYears);
  const balance = Math.max(0, round2(entitled - num(input.annualLeaveUsedDays)));
  const leaveAmount = round2(balance * dailyRate);
  lines.push({
    key: "annual_leave",
    label: "بدل رصيد الإجازات السنوية",
    amount: leaveAmount,
    formula: `${balance} يوم × ${dailyRate}`,
    legalRef: "نظام العمل السعودي — الإجازة السنوية وبدلها النقدي",
    explanation: `الاستحقاق ${perYear} يوماً عن كل سنة (لمدة خدمة ${serviceYears} سنة) = ${entitled} يوماً، والمستخدم ${input.annualLeaveUsedDays} يوماً، فيتبقى ${balance} يوماً تُحتسب بآخر أجر فعلي.`,
  });
  audit.push({ step: "annual_leave", decision: `${leaveAmount} ر.س`, reason: `رصيد ${balance} يوماً بآخر أجر فعلي.` });

  // ---- Step 10: sick leave --------------------------------------------------
  const tiers: any[] = Array.isArray(slCfg.tiers) ? slCfg.tiers : [];
  let sickAmount = 0;
  const tierParts: string[] = [];
  let remaining = num(input.sickLeaveDays);
  for (const t of tiers) {
    if (remaining <= 0) break;
    const from = num(t.from, 1);
    const to = num(t.to, from);
    const span = Math.max(0, to - from + 1);
    const used = Math.min(remaining, span);
    const rate = num(t.rate);
    sickAmount += used * rate * dailyRate;
    if (used > 0) tierParts.push(`${used} يوم × ${Math.round(rate * 100)}%`);
    remaining -= used;
  }
  sickAmount = round2(sickAmount);
  lines.push({
    key: "sick_leave",
    label: "أجر الإجازة المرضية",
    amount: sickAmount,
    formula: tierParts.length ? `${tierParts.join(" + ")} × ${dailyRate}` : "0",
    legalRef: "نظام العمل السعودي — الإجازة المرضية",
    explanation: "تُطبَّق شرائح أجر الإجازة المرضية المعرَّفة في لوحة التحكم على عدد الأيام المعتمدة طبياً.",
  });
  audit.push({ step: "sick_leave", decision: `${sickAmount} ر.س`, reason: tierParts.join(" + ") || "لا توجد أيام مرضية." });

  // ---- Step 12: female employee rights ------------------------------------
  const serviceMonths = serviceDays / 30.4375;
  if (input.gender === "female") {
    const f = input.female ?? ({} as any);

    // إجازة الأمومة
    const matDaysCfg = num(femCfg.maternity_leave_days, 70);
    const matDays =
      f.maternityStart && f.maternityEnd ? Math.min(matDaysCfg, daysBetween(f.maternityStart, f.maternityEnd)) : 0;
    const payTiers: any[] = Array.isArray(femCfg.maternity_pay_tiers) ? femCfg.maternity_pay_tiers : [];
    let matRate = num(femCfg.maternity_pay_rate, 1);
    for (const t of payTiers) {
      if (serviceMonths >= num(t.min_service_months)) matRate = num(t.rate, matRate);
    }
    const minService = num(femCfg.maternity_min_service_months, 0);
    const matEligible = matDays > 0 && serviceMonths >= minService;
    const matAmount = matEligible && !f.maternityPaid ? round2(matDays * matRate * dailyRate) : 0;
    const matReason = !f.maternityStart
      ? "لم تُدخل بيانات إجازة أمومة."
      : !matEligible
        ? `لم تتحقق شروط استحقاق إجازة الأمومة: مدة الخدمة ${Math.round(serviceMonths)} شهراً والحد المعتمد ${minService} شهراً.`
        : f.maternityPaid
          ? `إجازة الأمومة (${matDays} يوماً) مستحقة نظاماً بنسبة ${Math.round(matRate * 100)}% وقد صُرفت فعلاً، فلا تُضاف للمطالبة.`
          : `إجازة أمومة مستحقة عن ${matDays} يوماً بنسبة ${Math.round(matRate * 100)}% من الأجر وفق الإعدادات المعتمدة، ولم تُصرف.`;
    lines.push({
      key: "maternity_leave",
      label: "أجر إجازة الأمومة",
      amount: matAmount,
      formula: `${matDays} يوم × ${matRate} × ${dailyRate}`,
      legalRef: "نظام العمل السعودي — إجازة الوضع للعاملة",
      explanation: matReason,
    });
    audit.push({ step: "maternity_leave", decision: `${matAmount} ر.س`, reason: matReason });

    // الحماية من الإنهاء أثناء الأمومة
    if (f.terminatedDuringMaternity) {
      audit.push({
        step: "maternity_protection",
        decision: "إنهاء خلال فترة الحماية",
        reason: `تم إنهاء العلاقة خلال فترة الحماية النظامية البالغة ${num(femCfg.maternity_protection_days, 180)} يوماً، ويُراجَع تكييف الإنهاء بناءً على ذلك.`,
      });
    }

    // ساعة الرضاعة
    const nursingHours = num(femCfg.nursing_hours_per_day, 1);
    const nursingMaxMonths = num(femCfg.nursing_period_months, 24);
    const claimedMonths = Math.min(num(f.nursingMonths), nursingMaxMonths);
    const nursingEligible = !!f.nursingClaimed && claimedMonths > 0 && femCfg.nursing_paid !== false;
    const nursingDays = claimedMonths * num(hoursCfg.days_per_month, 30);
    const nursingAmount = nursingEligible ? round2(nursingDays * nursingHours * hourlyRate) : 0;
    const nursingReason = !f.nursingClaimed
      ? "لم تُطلب ساعة الرضاعة."
      : nursingEligible
        ? `ساعة رضاعة مدفوعة الأجر بواقع ${nursingHours} ساعة يومياً لمدة ${claimedMonths} شهراً (الحد النظامي ${nursingMaxMonths} شهراً) ولم تُمنح فعلياً.`
        : "لم تتحقق شروط استحقاق ساعة الرضاعة وفق الإعدادات المعتمدة.";
    lines.push({
      key: "nursing_hour",
      label: "مقابل ساعة الرضاعة",
      amount: nursingAmount,
      formula: `${nursingDays} يوم × ${nursingHours} ساعة × ${hourlyRate}`,
      legalRef: "نظام العمل السعودي — فترة الرضاعة للعاملة",
      explanation: nursingReason,
    });
    audit.push({ step: "nursing_hour", decision: `${nursingAmount} ر.س`, reason: nursingReason });
  } else {
    audit.push({ step: "female_rights", decision: "لا ينطبق", reason: "العامل ذكر، فلا تنطبق أحكام حقوق العاملات." });
  }

  // ---- Step 13: GOSI ------------------------------------------------------
  const gosiBasis = String(gosiCfg.wage_basis ?? "basic_plus_housing");
  const rawSubject =
    input.gosiSubjectWageOverride !== null && input.gosiSubjectWageOverride !== undefined
      ? num(input.gosiSubjectWageOverride)
      : gosiBasis === "actual_wage"
        ? actualWage
        : num(w.basic) + num(w.housing);
  const subjectWage = input.gosiSubscribed
    ? round2(Math.min(Math.max(rawSubject, num(gosiCfg.min_subject_wage, 0)), num(gosiCfg.max_subject_wage, rawSubject)))
    : 0;
  const gosiRates = (input.nationality === "saudi" ? gosiCfg.saudi : gosiCfg.non_saudi) ?? {};
  const empRate = num(gosiRates.employee_rate, 0);
  const erRate = num(gosiRates.employer_rate, 0);
  const gosiMonths = Math.max(0, num(input.gosiMonths));
  const gosi = {
    subscribed: !!input.gosiSubscribed,
    subjectWage,
    employeeRate: empRate,
    employerRate: erRate,
    employeeAmount: round2(subjectWage * empRate * (gosiMonths || 1)),
    employerAmount: round2(subjectWage * erRate * (gosiMonths || 1)),
    months: gosiMonths || 1,
    effectiveFrom: String(gosiCfg.effective_from ?? ""),
    legalVersion: String(gosiCfg.legal_version ?? ""),
    basis: gosiBasis,
  };
  audit.push({
    step: "gosi",
    decision: input.gosiSubscribed
      ? `اشتراك العامل ${gosi.employeeAmount} ر.س ومساهمة صاحب العمل ${gosi.employerAmount} ر.س`
      : "غير مشترك في التأمينات",
    reason: `الأجر الخاضع للاشتراك ${subjectWage} ر.س وفق أساس (${gosiBasis})، نسبة العامل ${empRate} ونسبة صاحب العمل ${erRate}، سريان النسبة من ${gosi.effectiveFrom} — الإصدار ${gosi.legalVersion}.`,
  });

  // ---- Step 14: termination classification --------------------------------
  const terminationClassification = classifyTermination(input, {
    endedInProbation,
    classification,
    noticeDays,
    actualNoticeDays,
    resignCfg,
    audit,
  });

  // ---- Step 16: benefit adjustment ----------------------------------------
  const adjustments: SaAdjustmentResult[] = [];
  const applyTo: string[] = Array.isArray(adjCfg.apply_to) ? adjCfg.apply_to : ["eosb"];
  const exempt: string[] = Array.isArray(adjCfg.exempt_lines) ? adjCfg.exempt_lines : [];
  const adjRate = num((adjCfg.rates ?? {})[input.terminationReason], 1);
  if (adjRate !== 1) {
    for (const l of lines) {
      if (!applyTo.includes(l.key) || exempt.includes(l.key) || l.amount === 0) continue;
      const before = l.amount;
      l.amount = round2(before * adjRate);
      adjustments.push({
        lineKey: l.key,
        label: l.label,
        rate: adjRate,
        before,
        after: l.amount,
        reason: `طُبقت نسبة ${Math.round(adjRate * 100)}% على «${l.label}» بسبب تكييف انتهاء العلاقة (${terminationClassification}) وفق الإعدادات المعتمدة.`,
      });
    }
  }
  for (const a of adjustments) audit.push({ step: "benefit_adjustment", decision: `${a.label}: ${a.before} ← ${a.after}`, reason: a.reason });
  if (!adjustments.length) {
    audit.push({
      step: "benefit_adjustment",
      decision: "لا يوجد تعديل",
      reason: "لم تتضمن الإعدادات المعتمدة أي نسبة تخفيض أو زيادة لسبب انتهاء العلاقة المُدخل.",
    });
  }

  const grossTotal = round2(lines.reduce((a, l) => a + l.amount, 0));

  // ---- Step 18: settlement verification -----------------------------------
  const relMap: Record<string, string> = setCfg.reliability ?? {};
  const relLabels: Record<string, string> = setCfg.reliability_labels ?? {};
  const settlements: SaSettlementResult[] = (input.settlements ?? []).map((e) => {
    const rel = (relMap[e.method] ?? "low") as "high" | "medium" | "low";
    const accepted = !!e.hasDocuments && rel !== "low";
    return {
      date: e.date,
      amount: round2(num(e.amount)),
      kind: e.kind,
      method: e.method,
      reliability: rel,
      reliabilityLabel: relLabels[rel] ?? rel,
      accepted,
      note: accepted
        ? "مخالصة موثقة بمستند مؤيد، وتُخصم من الرصيد النهائي."
        : !e.hasDocuments
          ? "لا توجد مستندات مؤيدة، فلم تُعتمد المخالصة في الخصم."
          : "موثوقية المستند منخفضة وفق التصنيف المعتمد، فلم تُعتمد المخالصة في الخصم.",
    };
  });
  for (const st of settlements) {
    audit.push({
      step: "settlement",
      decision: `${st.amount} ر.س — ${st.reliabilityLabel}${st.accepted ? " (معتمدة)" : " (غير معتمدة)"}`,
      reason: `مخالصة بتاريخ ${st.date} عبر ${st.method}. ${st.note}`,
    });
  }
  const settledAmount = setCfg.deduct_from_total === false ? 0 : round2(settlements.filter((x) => x.accepted).reduce((a, x) => a + x.amount, 0));
  if (settledAmount > 0) {
    lines.push({
      key: "settlements",
      label: "خصم المخالصات الموثقة",
      amount: -settledAmount,
      formula: `- ${settledAmount}`,
      legalRef: "نظام العمل السعودي — المخالصة وأثرها على المستحقات",
      explanation: `تم خصم قيمة المخالصات الموثقة والمقبولة (${settlements.filter((x) => x.accepted).length} مخالصة) من إجمالي المستحقات.`,
    });
  }

  // ---- Step 19: amicable dispute settlement -------------------------------
  if (input.dispute?.exists) {
    const d = input.dispute;
    const coveredKeys = d.coveredKeys ?? [];
    const coveredLabels = lines.filter((l) => coveredKeys.includes(l.key)).map((l) => l.label);
    const uncoveredLabels = lines.filter((l) => !coveredKeys.includes(l.key) && l.amount > 0).map((l) => l.label);
    const coveredValue = round2(lines.filter((l) => coveredKeys.includes(l.key)).reduce((a, l) => a + l.amount, 0));
    const gap = round2(coveredValue - num(d.amount));
    const disputeReason = `مبلغ التسوية ${num(d.amount)} ر.س مقابل بنود محتسبة بقيمة ${coveredValue} ر.س (${
      coveredLabels.join("، ") || "لا توجد بنود محددة"
    }). ${gap > 0 ? `يوجد فارق ${gap} ر.س لغير صالح العامل.` : gap < 0 ? `التسوية تزيد عن المحتسب بمقدار ${Math.abs(gap)} ر.س.` : "التسوية مطابقة للمحتسب."} البنود غير المشمولة: ${
      uncoveredLabels.join("، ") || "لا يوجد"
    }.`;
    lines.push({
      key: "dispute_settlement",
      label: "أثر التسوية الودية",
      amount: -round2(num(d.amount)),
      formula: `- ${num(d.amount)}`,
      legalRef: "نظام العمل السعودي — التسوية الودية للمنازعات العمالية",
      explanation: disputeReason + (d.note ? ` ملاحظة: ${d.note}` : ""),
    });
    audit.push({ step: "dispute_settlement", decision: `- ${num(d.amount)} ر.س`, reason: disputeReason });
  }

  const total = round2(lines.reduce((a, l) => a + l.amount, 0));

  // ---- Claim limitation -------------------------------------------------
  const limMonths = num(limCfg.months, 12);
  const lim = new Date(input.endDate);
  lim.setMonth(lim.getMonth() + limMonths);
  const limitationDate = Number.isFinite(lim.getTime()) ? lim.toISOString().slice(0, 10) : "";
  const limitationExpired = Number.isFinite(lim.getTime()) ? lim.getTime() < Date.now() : false;

  return {
    currency: "SAR",
    actualWage,
    dailyRate,
    hourlyRate,
    serviceYears,
    serviceDays,
    contractClassification: classification,
    terminationClassification,
    lines,
    grossTotal,
    total,
    validation,
    gosi,
    settlements,
    settledAmount,
    adjustments,
    limitationDate,
    limitationExpired,
    audit,
  };
}

/** الخطوة 14: تكييف سبب انتهاء العلاقة العمالية. */
function classifyTermination(
  input: SaCaseInput,
  ctx: {
    endedInProbation: boolean;
    classification: string;
    noticeDays: number;
    actualNoticeDays: number;
    resignCfg: any;
    audit: SaAuditEntry[];
  },
): string {
  const { resignCfg, audit } = ctx;
  const labels: Record<string, string> = {
    employer_termination: "إنهاء من صاحب العمل",
    unlawful_termination: "إنهاء من صاحب العمل — محل بحث المشروعية",
    resignation: "استقالة العامل",
    mutual: "إنهاء باتفاق الطرفين",
    contract_expiry: "انتهاء مدة العقد",
    during_probation: "إنهاء أثناء فترة التجربة",
  };
  let classification = labels[input.terminationReason] ?? "غير محدد";
  const reasons: string[] = [];

  if (ctx.endedInProbation) {
    reasons.push("انتهت العلاقة خلال فترة تجربة نظامية صحيحة.");
  }

  if (input.terminationReason === "resignation") {
    const r = input.resignation ?? ({} as any);
    const missing: string[] = [];
    if (resignCfg.requires_written !== false && !r.written) missing.push("عدم إثبات تقديم الاستقالة كتابةً");
    if (!r.submittedDate) missing.push("عدم تحديد تاريخ تقديم الاستقالة");
    if (!r.effectiveDate) missing.push("عدم تحديد تاريخ سريان الاستقالة");
    if (resignCfg.qiwa_required && !r.qiwaSubmitted) missing.push("عدم توثيق الإجراء عبر المنصة الحكومية المعتمدة");

    if (r.acceptance === "rejected") {
      reasons.push("الاستقالة مرفوضة صراحةً من صاحب العمل، ولا يجوز افتراض انتهاء العلاقة بها.");
      classification = "استقالة غير مكتملة الشروط";
    } else if (r.acceptance === "none" && resignCfg.requires_acceptance) {
      const deemed = Number(resignCfg.acceptance_deemed_days ?? 30);
      reasons.push(`لم يُوثَّق قبول صاحب العمل، وتُعد الاستقالة مقبولة حكماً بعد ${deemed} يوماً وفق الإعدادات المعتمدة.`);
    }
    if (missing.length) {
      classification = classification === "استقالة العامل" ? "استقالة تحتاج استكمال شروط" : classification;
      reasons.push(`ملاحظات نظامية: ${missing.join("، ")}.`);
    } else {
      reasons.push("استوفت الاستقالة الشروط الشكلية المعتمدة.");
    }
    if (ctx.actualNoticeDays < ctx.noticeDays) {
      reasons.push(`مدة الإشعار الفعلية ${ctx.actualNoticeDays} يوماً أقل من النظامية ${ctx.noticeDays} يوماً.`);
    }
  }

  if (input.terminationReason === "unlawful_termination") {
    reasons.push(
      "أُدخل الإنهاء على أنه غير مشروع، ولا يُعتمد هذا الوصف نهائياً إلا بعد تحقق الشروط النظامية والمستندات المؤيدة.",
    );
  }
  if (input.gender === "female" && input.female?.terminatedDuringMaternity) {
    reasons.push("وقع الإنهاء خلال فترة الحماية المقررة للعاملة، وهو مؤثر في تكييف مشروعية الإنهاء.");
  }

  audit.push({
    step: "termination_reason",
    decision: classification,
    reason: reasons.join(" ") || "تم اعتماد سبب الإنهاء كما أُدخل وفق الإعدادات المعتمدة.",
  });
  return classification;
}

/** الخطوة 11: المراجعة المرحلية للبيانات قبل اعتماد النتائج. */
export function validateSaCase(input: SaCaseInput, s: SettingsMap): SaValidationReport {
  const v = s.validation ?? {};
  const hours = s.working_hours ?? {};
  const issues: SaValidationIssue[] = [];
  const err = (field: string, label: string, message: string) =>
    issues.push({ field, label, severity: "error", message });
  const warn = (field: string, label: string, message: string) =>
    issues.push({ field, label, severity: "warning", message });

  // اكتمال البيانات الإلزامية
  if (!input.jobTitle?.trim()) err("jobTitle", "المسمى الوظيفي", "بيان إلزامي غير مكتمل.");
  if (!input.startDate) err("startDate", "تاريخ مباشرة العمل", "بيان إلزامي غير مكتمل.");
  if (!input.endDate) err("endDate", "تاريخ انتهاء العلاقة", "بيان إلزامي غير مكتمل.");

  const start = new Date(input.startDate).getTime();
  const end = new Date(input.endDate).getTime();
  if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
    err("endDate", "تاريخ انتهاء العلاقة", "تاريخ الانتهاء يجب أن يكون لاحقاً لتاريخ المباشرة.");
  }
  if (Number.isFinite(end) && end > Date.now() + 86400000) {
    warn("endDate", "تاريخ انتهاء العلاقة", "التاريخ المدخل مستقبلي، تأكد من صحته.");
  }

  const wage = num(input.wage?.basic) + num(input.wage?.housing) + num(input.wage?.transport) + num(input.wage?.otherFixed);
  if (v.require_wage !== false && wage <= 0) err("wage", "الأجر", "لم يتم إدخال أي مكوّن من مكوّنات الأجر.");
  if (num(input.wage?.basic) <= 0 && wage > 0) {
    warn("wage.basic", "الراتب الأساسي", "لم يُدخل الراتب الأساسي رغم إدخال بدلات، وقد يؤثر على الأجر الخاضع للاشتراك.");
  }

  // تعارض بيانات العقد
  if (input.contractType === "fixed" && !input.contractTermEnd) {
    warn("contractTermEnd", "نهاية مدة العقد", "العقد محدد المدة دون تحديد تاريخ نهاية المدة.");
  }
  if (input.contractType === "indefinite" && num(input.renewals) > 0) {
    warn("renewals", "عدد التجديدات", "أُدخلت تجديدات رغم أن العقد غير محدد المدة.");
  }
  if (input.hasProbation && num(input.probationDays) <= 0) {
    err("probationDays", "مدة فترة التجربة", "تم تفعيل فترة التجربة دون تحديد مدتها.");
  }
  if (!input.hasProbation && input.endedDuringProbation) {
    err("endedDuringProbation", "الإنهاء أثناء التجربة", "تعارض: لا توجد فترة تجربة مُدخلة رغم اختيار الإنهاء أثناءها.");
  }

  // سلامة العمليات الحسابية وحدود الساعات
  const dailyHours = num(input.dailyHours, num(hours.daily, 8));
  if (dailyHours > num(v.max_daily_hours, 11)) {
    warn("dailyHours", "ساعات العمل اليومية", `القيمة المدخلة ${dailyHours} تتجاوز الحد المعتمد ${num(v.max_daily_hours, 11)} ساعة.`);
  }
  const serviceDays = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, (end - start) / 86400000) : 0;
  const maxOtHours = (serviceDays / 7) * num(input.workDaysPerWeek, num(hours.days_per_week, 6)) * dailyHours * num(v.max_overtime_ratio, 0.5);
  if (num(input.overtimeHours) > 0 && maxOtHours > 0 && num(input.overtimeHours) > maxOtHours) {
    warn("overtimeHours", "الساعات الإضافية", `عدد الساعات المدخل يتجاوز النسبة المعقولة مقارنة بمدة الخدمة (الحد التقديري ${Math.round(maxOtHours)} ساعة).`);
  }

  // الإجازات
  const usedLeave = num(input.annualLeaveUsedDays);
  const entitled = input.annualLeaveEntitledDays;
  if (entitled !== null && entitled !== undefined && usedLeave > num(entitled)) {
    err("annualLeaveUsedDays", "الإجازات السنوية", "أيام الإجازة المستخدمة تتجاوز الأيام المستحقة المدخلة.");
  }
  if (num(input.sickLeaveDays) > serviceDays && serviceDays > 0) {
    err("sickLeaveDays", "الإجازة المرضية", "عدد الأيام المرضية يتجاوز مدة الخدمة الفعلية.");
  }

  // الإشعار
  if (input.noticeGiven && num(input.noticeDaysGiven) <= 0) {
    err("noticeDaysGiven", "أيام الإشعار", "تم اختيار منح الإشعار دون تحديد عدد الأيام.");
  }
  if (input.terminationNoticeDate && Number.isFinite(end)) {
    const nd = new Date(input.terminationNoticeDate).getTime();
    if (Number.isFinite(nd) && nd > end) err("terminationNoticeDate", "تاريخ الإشعار", "تاريخ الإشعار لاحق لتاريخ انتهاء العلاقة.");
  }

  // حقوق العاملات
  if (input.gender === "female") {
    const f = input.female ?? ({} as any);
    if (f.maternityStart && !f.maternityEnd) err("female.maternityEnd", "نهاية إجازة الأمومة", "تاريخ نهاية إجازة الأمومة غير مكتمل.");
    if (f.maternityStart && f.maternityEnd && new Date(f.maternityEnd) <= new Date(f.maternityStart)) {
      err("female.maternityEnd", "إجازة الأمومة", "تاريخ نهاية الإجازة يجب أن يكون لاحقاً لتاريخ بدايتها.");
    }
    if (f.nursingClaimed && num(f.nursingMonths) <= 0) {
      err("female.nursingMonths", "ساعة الرضاعة", "تم طلب ساعة الرضاعة دون تحديد عدد الأشهر.");
    }
    if (f.nursingClaimed && !f.birthDate) warn("female.birthDate", "تاريخ الولادة", "لم يُدخل تاريخ الولادة المرتبط باستحقاق الرضاعة.");
  } else if (input.female?.maternityStart || input.female?.nursingClaimed) {
    err("gender", "جنس العامل", "تعارض: أُدخلت بيانات أمومة أو رضاعة مع اختيار جنس ذكر.");
  }

  // الاستقالة
  if (input.terminationReason === "resignation") {
    const r = input.resignation ?? ({} as any);
    if (!r.submittedDate) err("resignation.submittedDate", "تاريخ تقديم الاستقالة", "بيان إلزامي عند اختيار الاستقالة.");
    if (r.submittedDate && r.effectiveDate && new Date(r.effectiveDate) < new Date(r.submittedDate)) {
      err("resignation.effectiveDate", "سريان الاستقالة", "تاريخ السريان سابق لتاريخ التقديم.");
    }
  }

  // المتأخرات والمخالصات — تكرار أو نقص
  const dupWages = new Set<string>();
  for (const u of input.unpaidWages ?? []) {
    const k = `${u.label}|${u.amount}|${u.dueDate}`;
    if (dupWages.has(k)) warn("unpaidWages", "الأجور المتأخرة", `يوجد إدخال مكرر: ${u.label || "بدون بيان"}.`);
    dupWages.add(k);
    if (num(u.amount) <= 0) warn("unpaidWages", "الأجور المتأخرة", "يوجد مستحق بقيمة صفر أو غير محددة.");
  }
  const dupHol = new Set<string>();
  for (const h of input.holidayWork ?? []) {
    if (!h.date) warn("holidayWork", "العمل في الإجازات", "يوجد سجل بدون تاريخ.");
    else if (dupHol.has(h.date)) warn("holidayWork", "العمل في الإجازات", `تاريخ مكرر: ${h.date}.`);
    dupHol.add(h.date);
  }
  const dupSet = new Set<string>();
  for (const st of input.settlements ?? []) {
    const k = `${st.date}|${st.amount}`;
    if (dupSet.has(k)) warn("settlements", "المخالصات", `مخالصة مكررة بتاريخ ${st.date}.`);
    dupSet.add(k);
    if (!st.date) err("settlements", "المخالصات", "يوجد سجل مخالصة بدون تاريخ.");
    if (num(st.amount) <= 0) err("settlements", "المخالصات", "يوجد سجل مخالصة بدون قيمة.");
  }
  if (input.dispute?.exists && num(input.dispute.amount) <= 0) {
    err("dispute.amount", "التسوية الودية", "تم تفعيل التسوية دون تحديد قيمتها.");
  }

  // التأمينات
  if (input.gosiSubscribed && num(input.gosiMonths) <= 0) {
    warn("gosiMonths", "التأمينات الاجتماعية", "لم تُحدد عدد أشهر الاشتراك، وسيُحتسب شهر واحد.");
  }

  if (v.warn_missing_names !== false && input.includeNamesInReport && !input.employeeName?.trim()) {
    warn("employeeName", "اسم العامل", "تم اختيار إظهار الأسماء في التقرير دون إدخال اسم العامل.");
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
    checkedAt: new Date().toISOString(),
  };
}

