// PDF report generator for the Yemen Labor Rights Platform.
//
// Strategy
// --------
// 1. HTML → canvas → PDF via html2canvas + jsPDF so we can author the layout
//    as RTL HTML and rely on the browser's Arabic shaper (proper ligatures,
//    mixed Arabic/numeric, currency placement). We render each logical section
//    separately; this prevents html2pdf from creating a blank trailing page.
// 2. We inline @font-face declarations for **Cairo** (regular + bold) from
//    Google Fonts so the snapshot has shaped Arabic glyphs even for bold
//    headings. Without this, html2canvas captures before the page fonts load
//    and bold falls back to a system font that breaks letter joining.
// 3. We `await document.fonts.ready` and explicitly `document.fonts.load()`
//    every weight we render, then add a 100 ms safety wait, before snapshot.
// 4. Layout is compressed so a normal report fits on a single A4 page; larger
//    reports paginate only between full sections, never through a table row.

import { renderHtmlToPdf, ensureArabicFonts } from "./pdf-engine";
import { LEGAL_ARTICLES, legalArticle, legalCitation } from "@/lib/legal-articles";
import QRCode from "qrcode";
import type { CalculatorInput, CalculatorResult } from "./calculator";
import { formatCurrency, currencySuffix, formatDateAr, formatServiceDuration } from "./calculator";
import {
  fetchApprovedLegalReferences,
  formatLegalReference,
  PENDING_REFERENCE_NOTICE,
} from "@/hooks/useLegalReferences";


export interface PdfBranding {
  platformName: string;
  logoUrl?: string | null;
  footer?: string | null;
}

export interface PdfTemplate {
  watermark?: string | null;
  signatureBlock?: string | null;
  disclaimer?: string | null;
  verificationStatement?: string | null;
}

export interface PdfMeta {
  serial: string;
  issuedAt: Date;
  customClauses?: string;
  template?: PdfTemplate;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTimeAr(d: Date) {
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

function formatTimeAr(d: Date) {
  return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

// تحميل الخط العربي وتضمينه يتم في محرك PDF المشترك (pdf-engine.ts).


export interface PdfOutputOptions {
  /** إرجاع HTML التقرير بدلاً من إنتاج ملف (معاينة داخلية / فحص آلي). */
  returnHtml?: boolean;
  /** إرجاع Blob بدلاً من تنزيل مباشر. */
  returnBlob?: boolean;
  /** وضع سريع لتفادي تجاوز المهلة في الاختبار الآلي. */
  fast?: boolean;
  onStats?: (stats: import("./pdf-engine").PdfRenderStats) => void;
}

export async function generateReportPDF(
  input: CalculatorInput,
  result: CalculatorResult,
  branding: PdfBranding,
  meta: PdfMeta,
  opts?: PdfOutputOptions,
): Promise<string | Blob | void> {
  // Load Arabic font FIRST so the offscreen render shapes letters correctly.
  await ensureArabicFonts();

  // QR with verification URL — kept LTR; URL is ASCII.
  const verifyUrl = `${window.location.origin}/verify?serial=${encodeURIComponent(meta.serial)}`;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });
  } catch {
    /* ignore */
  }

  const rows = (entries: [string, string][]) =>
    entries
      .map(
        ([k, v]) =>
          `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`,
      )
      .join("");

  const cur = input.currency || "YER";
  const suf = currencySuffix(cur);

  const workerRows = rows([
    ["اسم العامل", input.employee_name || "—"],
    ["الجنسية / الصفة", "عامل لدى صاحب العمل المذكور"],
  ]);

  const employerRows = rows([
    ["اسم صاحب العمل / المنشأة", input.employer_name || "—"],
  ]);

  const TERMINATION_LABELS: Record<string, string> = {
    mutual: "إنهاء بالتراضي",
    resignation: "استقالة من العامل",
    dismissal: "فصل من صاحب العمل لسبب مشروع",
    unfair: "فصل تعسفي من صاحب العمل",
    dismissal_pregnancy: "فصل أثناء الحمل",
    dismissal_lactation: "فصل أثناء فترة الرضاعة",
    other: "سبب آخر",
  };
  const LEAVE_STATUS_LABELS: Record<string, string> = {
    full: "استُخدمت جميع الإجازات السنوية",
    partial: "استُخدم جزء من الإجازات السنوية",
    none: "لم تُستخدم أي إجازة سنوية",
  };
  // كل مُدخل موجود فعلياً يُعرض؛ الحقول غير المدخلة لا تظهر إطلاقاً.
  const optionalRow = (label: string, value: string | null | undefined): [string, string][] =>
    value === null || value === undefined || value === "" ? [] : [[label, value]];

  const employmentRows = rows([
    ["تاريخ بداية الخدمة", formatDateAr(input.service_start_date)],
    [
      input.still_working ? "تاريخ الاحتساب (الخدمة مستمرة)" : "تاريخ نهاية الخدمة",
      formatDateAr(input.service_end_date),
    ],
    ...optionalRow("القطاع", input.sector ? (input.sector === "public" ? "عام (الخميس والجمعة راحة)" : "خاص (الجمعة راحة)") : undefined),
    ...optionalRow("ساعات العمل اليومية الفعلية", input.daily_hours ? `${input.daily_hours} ساعة` : undefined),
    ...optionalRow("وقت العمل", input.work_start_time && input.work_end_time ? `${input.work_start_time} — ${input.work_end_time}` : undefined),
    ["ساعات إضافية نهارية", `${input.day_overtime_hours} ساعة`],
    ["ساعات إضافية ليلية", `${input.night_overtime_hours} ساعة`],
    ...optionalRow("العمل الليلي (20:00–05:00)", input.has_night_shift ? `نعم — ${input.night_hours_per_day ?? 0} ساعة يومياً` : undefined),
    ...optionalRow("ساعات العمل في يوم الجمعة", input.friday_worked_hours ? `${input.friday_worked_hours} ساعة` : undefined),
    ...optionalRow("بدل الجمعة المستلم", input.friday_pay_received ? formatCurrency(input.friday_pay_received, cur) : undefined),
    ...optionalRow("أيام الإجازات الرسمية المعمولة", input.holiday_days_worked ? `${input.holiday_days_worked} يوم` : undefined),
    ...optionalRow("حالة الإجازات السنوية", input.annual_leave_status ? LEAVE_STATUS_LABELS[input.annual_leave_status] ?? input.annual_leave_status : undefined),
    ["أيام إجازات غير مستخدمة", `${input.unused_leave_days} يوم`],
    ...optionalRow("أيام الإجازات المرضية", input.sick_leave_days ? `${input.sick_leave_days} يوم` : undefined),
    ...optionalRow("سبب انتهاء العلاقة", input.termination_reason ? TERMINATION_LABELS[input.termination_reason] ?? input.termination_reason : undefined),
    ...optionalRow("الإنذار الممنوح", input.notice_given === undefined ? undefined : input.notice_given ? `نعم — ${input.notice_months ?? 0} شهر` : "لا"),
    ...optionalRow("مكافأة نهاية خدمة مستلمة سابقاً", input.eosb_received ? formatCurrency(input.eosb_received, cur) : undefined),
    ...optionalRow("مشترك في التأمينات الاجتماعية", input.insured === undefined ? undefined : input.insured ? "نعم" : "لا"),
    ...optionalRow("جنس العامل", input.gender ? (input.gender === "female" ? "أنثى" : "ذكر") : undefined),
    ["حالة الفصل التعسفي", input.unfair_dismissal ? "نعم — مُطالب بتعويض تقديري" : "لا"],
  ]);


  const durationRows = rows([
    ["السنوات", `${result.years}`],
    ["الأشهر", `${result.months}`],
    ["الأيام", `${result.days}`],
    ["إجمالي الأيام", `${result.total_days} يوم`],
    ["إجمالي الأشهر", `${result.total_months} شهر`],
    ["المدة المحسوبة", formatServiceDuration(result)],
    ["المدة الكسرية (تستخدم في حساب نهاية الخدمة)", `${result.fractional_years.toFixed(4)} سنة`],
  ]);

  // سجل الرواتب: تُعرض جميع فترات الراتب التاريخية إن أدخلها المستخدم،
  // ويُعرض دائماً آخر راتب فعلي المستخدم في احتساب نهاية الخدمة.
  const periods = input.salary_periods ?? [];
  const salaryHistoryTable = `
    <table><thead>
      <tr><th>الفترة</th><th>الراتب الشهري</th><th>العملة</th><th>الاستخدام</th></tr>
    </thead><tbody>
      ${periods
        .map(
          (p) => `<tr>
        <td>${escapeHtml(formatDateAr(p.from))} — ${escapeHtml(formatDateAr(p.to))}</td>
        <td style="font-weight:700;">${escapeHtml(formatCurrency(p.salary, cur))}</td>
        <td>${escapeHtml(cur)} (${escapeHtml(suf)})</td>
        <td style="color:#555;">فترة راتب تاريخية — تُستخدم في احتساب الفترة المقابلة</td>
      </tr>`,
        )
        .join("")}
      <tr>
        <td>${escapeHtml(formatDateAr(input.service_start_date))} — ${escapeHtml(formatDateAr(input.service_end_date))}</td>
        <td style="font-weight:700;">${escapeHtml(formatCurrency(input.monthly_salary, cur))}</td>
        <td>${escapeHtml(cur)} (${escapeHtml(suf)})</td>
        <td style="color:#0F5132;font-weight:600;">آخر راتب فعلي — مستخدم في حساب نهاية الخدمة</td>
      </tr>
    </tbody></table>
  `;


  // Step-by-step calculation breakdown with explicit formulas so any lawyer
  // can re-derive every value from the inputs.
  const sFmt = (n: number) => escapeHtml(formatCurrency(n, cur));
  const stepRow = (title: string, formula: string, value: string) =>
    `<tr>
       <th style="width:38%;">${escapeHtml(title)}</th>
       <td style="width:42%;font-size:11px;color:#444;" dir="rtl">${formula}</td>
       <td style="width:20%;font-weight:700;text-align:left;direction:ltr;">${value}</td>
     </tr>`;

  // كل بند حسبته الحاسبة يُعرض هنا بقيمته كما هي — لا إعادة حساب في التقرير.
  const fr = result.female_rights;
  const stepEntries: { title: string; formula: string; amount: number }[] = [
    {
      title: "الأجر اليومي",
      formula: `الراتب الشهري ÷ 30 = ${sFmt(input.monthly_salary)} ÷ 30`,
      amount: result.daily_rate,
    },
    {
      title: "الأجر بالساعة",
      formula: `الأجر اليومي ÷ 8 = ${sFmt(result.daily_rate)} ÷ 8`,
      amount: result.hourly_rate,
    },
    {
      title: "مكافأة نهاية الخدمة",
      formula: `آخر راتب × المدة الكسرية = ${sFmt(input.monthly_salary)} × ${result.fractional_years.toFixed(4)}`,
      amount: result.eos_benefit,
    },
    {
      title: "العمل الإضافي النهاري (150%)",
      formula: `الساعات × الأجر بالساعة × 1.5 = ${input.day_overtime_hours} × ${sFmt(result.historical_hourly_rate || result.hourly_rate)} × 1.5`,
      amount: result.day_overtime_amount,
    },
    {
      title: "العمل الإضافي الليلي (200%)",
      formula: `الساعات × الأجر بالساعة × 2 = ${input.night_overtime_hours} × ${sFmt(result.historical_hourly_rate || result.hourly_rate)} × 2`,
      amount: result.night_overtime_amount,
    },
    {
      title: "بدل العمل في يوم الجمعة (200%)",
      formula: "ساعات الجمعة × الأجر بالساعة × 2 − ما استُلم عن الجمعة",
      amount: result.friday_compensation || 0,
    },
    {
      title: "أجر العمل في الإجازات الرسمية (200%)",
      formula: "أيام الإجازات المعمولة × الأجر اليومي × 2",
      amount: result.holiday_compensation || 0,
    },
    {
      title: "بدل الإنذار",
      formula: "أشهر الإنذار غير الممنوحة × الراتب الشهري",
      amount: result.notice_indemnity || 0,
    },
    {
      title: "بدل الإجازات السنوية غير المستخدمة",
      formula: `أيام غير مستخدمة × الأجر اليومي = ${result.total_days > 0 ? escapeHtml(String(input.unused_leave_days)) : "0"} × ${sFmt(result.daily_rate)}`,
      amount: result.leave_compensation || 0,
    },
    ...(fr?.applies
      ? [
          {
            title: "ساعات تجاوز الحد أثناء الحمل/الرضاعة (150%)",
            formula: `${fr.extra_hours_total.toFixed(2)} ساعة × ${sFmt(fr.hourly_rate)} × 1.5`,
            amount: fr.extra_hours_amount,
          },
          {
            title: "أجر إجازة الوضع",
            formula: `${fr.maternity_leave_days} يوم × الأجر اليومي${fr.maternity_leave_paid ? " (مدفوعة — لا مستحق)" : ""}`,
            amount: fr.maternity_leave_amount,
          },
        ]
      : []),
  ];

  const deductionEntries: { title: string; formula: string; amount: number }[] =
    (result.eosb_advance_deduction || 0) > 0
      ? [
          {
            title: "مكافأة نهاية خدمة مستلمة سابقاً (تُخصم)",
            formula: "مبلغ مُستلم من صاحب العمل يُخصم من الإجمالي",
            amount: -(result.eosb_advance_deduction || 0),
          },
        ]
      : [];

  const stepsTable = `
    <table><thead>
      <tr><th>البند</th><th>المعادلة / الخطوات</th><th>الناتج</th></tr>
    </thead><tbody>
      ${[...stepEntries, ...deductionEntries]
        .filter((e, i) => i < 2 || e.amount !== 0)
        .map((e) => stepRow(e.title, escapeHtml(e.formula), sFmt(e.amount)))
        .join("")}
      <tr style="background:#f1f8f3;">
        <th>إجمالي الحقوق المضمونة</th>
        <td style="font-size:11px;color:#444;">مجموع البنود المستحقة أعلاه بعد خصم ما استُلم مسبقاً</td>
        <td style="font-weight:700;text-align:left;direction:ltr;color:#0F5132;">${sFmt(result.total_due)}</td>
      </tr>
    </tbody></table>
  `;

  // مدة الخدمة والرواتب التاريخية المستخدمة فعلياً في الاحتساب.
  const eosBreakdownBlock = (result.eos_breakdown && result.eos_breakdown.length > 1)
    ? `<section class="card avoid-break" data-pdf-section>
         <h2>تفصيل مكافأة نهاية الخدمة بحسب فترات الراتب</h2>
         <table><thead>
           <tr><th>من</th><th>إلى</th><th>الراتب</th><th>السنوات</th><th>المستحق</th></tr>
         </thead><tbody>
           ${result.eos_breakdown.map((b) => `
             <tr>
               <td>${escapeHtml(formatDateAr(b.from))}</td>
               <td>${escapeHtml(formatDateAr(b.to))}</td>
               <td>${escapeHtml(formatCurrency(b.salary, cur))}</td>
               <td>${b.years.toFixed(4)}</td>
               <td style="font-weight:700;">${escapeHtml(formatCurrency(b.amount, cur))}</td>
             </tr>`).join("")}
         </tbody></table>
       </section>`
    : "";

  const holidayBreakdownBlock = (result.holiday_breakdown && result.holiday_breakdown.length > 0)
    ? `<section class="card" data-pdf-section>
         <h2>تفصيل الإجازات الرسمية المعمولة</h2>
         <table><thead>
           <tr><th>الإجازة</th><th>السنة</th><th>أيام الإجازة</th><th>أيام معمولة</th><th>ساعات/يوم</th><th>المستحق</th></tr>
         </thead><tbody>
           ${result.holiday_breakdown.map((h) => `
             <tr>
               <td>${escapeHtml(h.name)}</td>
               <td>${h.year}</td>
               <td>${h.totalDays}</td>
               <td>${h.daysWorked}</td>
               <td>${h.hoursPerDay}</td>
               <td style="font-weight:700;">${escapeHtml(formatCurrency(h.amount, cur))}</td>
             </tr>`).join("")}
         </tbody></table>
       </section>`
    : "";

  const femaleRightsBlock = fr?.applies
    ? `<section class="card avoid-break" data-pdf-section>
         <h2>حقوق المرأة العاملة — المواد (43–46)</h2>
         <table><tbody>
           <tr><th>تاريخ الوضع</th><td>${escapeHtml(formatDateAr(fr.birth_date))}</td></tr>
           <tr><th>نوع الوضع</th><td>${fr.birth_type === "complicated" ? "وضع متعسّر / توأم (80 يوماً)" : "وضع طبيعي (60 يوماً)"}</td></tr>
           <tr><th>نافذة الحماية</th><td>${escapeHtml(formatDateAr(fr.reduced_start))} — ${escapeHtml(formatDateAr(fr.reduced_end))}</td></tr>
           <tr><th>الحد القانوني لساعات العمل</th><td>${fr.legal_daily_hours} ساعة — الفعلي: ${fr.actual_daily_hours} ساعة</td></tr>
           <tr><th>أيام العمل أثناء الحمل / الرضاعة</th><td>${fr.pregnancy_days_worked} / ${fr.lactation_days_worked} يوم</td></tr>
           <tr><th>إجمالي الساعات الزائدة</th><td>${fr.extra_hours_total.toFixed(2)} ساعة</td></tr>
           <tr><th>أجر إجازة الوضع</th><td>${escapeHtml(formatCurrency(fr.maternity_leave_amount, cur))} (${fr.maternity_leave_days} يوم${fr.maternity_leave_paid ? " — مدفوعة" : " — غير مدفوعة"})</td></tr>
           <tr style="background:#f1f8f3;"><th>إجمالي حقوق المرأة العاملة</th><td style="font-weight:700;color:#0F5132;">${escapeHtml(formatCurrency(fr.total, cur))}</td></tr>
         </tbody></table>
       </section>`
    : "";


  const legalNotesBlock = (result.legal_notes && result.legal_notes.length > 0)
    ? `<section class="card avoid-break" data-pdf-section>
         <h2>10. ملاحظات قانونية (تقديرات لا تدخل ضمن الإجمالي)</h2>
         <table><tbody>${result.legal_notes.map((n) => `
           <tr>
             <th>${escapeHtml(n.title)}<br/><span style="font-weight:400;color:#6c757d;font-size:10px;">${escapeHtml(n.formula)}</span></th>
             <td>
               <div style="font-weight:700;">${escapeHtml(formatCurrency(n.amount, cur))}</div>
               <div style="font-size:10px;color:#92400e;margin-top:4px;">⚠ ${escapeHtml(n.warning)}</div>
             </td>
           </tr>`).join("")}</tbody></table>
       </section>`
    : "";

  // ---- Sick leave (Art. 80), statute of limitations (Art. 149) and the
  // full article-by-article legal commentary. All data is bundled locally so
  // the report renders identically offline.
  const sick = result.sick_leave;
  const sickBlock = sick?.applies
    ? `<section class="card avoid-break" data-pdf-section>
         <h2>الإجازات المرضية (${sick.days} يوماً) — المادة (80)</h2>
         <table><thead>
           <tr><th>الشريحة</th><th>الأيام</th><th>نسبة الأجر</th><th>المستحق</th><th>الخصم</th></tr>
         </thead><tbody>
           ${sick.tiers.map((tier) => `
             <tr>
               <td>${escapeHtml(tier.label)}</td>
               <td>${tier.days}</td>
               <td>${Math.round(tier.rate * 100)}%</td>
               <td style="font-weight:700;">${escapeHtml(formatCurrency(tier.amount, cur))}</td>
               <td style="color:#b91c1c;">${escapeHtml(formatCurrency(tier.deduction, cur))}</td>
             </tr>`).join("")}
           <tr style="background:#f1f8f3;">
             <td colspan="3" style="font-weight:700;">الإجمالي</td>
             <td style="font-weight:700;color:#0F5132;">${escapeHtml(formatCurrency(sick.paid_amount, cur))}</td>
             <td style="font-weight:700;color:#b91c1c;">${escapeHtml(formatCurrency(sick.deduction_amount, cur))}</td>
           </tr>
         </tbody></table>
         <p class="clauses" style="font-size:11px;color:#444;">
           ${escapeHtml(legalCitation("sick_leave"))} — ${escapeHtml(legalArticle("sick_leave").interpretation)}
         </p>
       </section>`
    : "";

  const lim = result.limitation;
  const limStatusText = !lim || lim.status === "not_started"
    ? "علاقة العمل ما زالت قائمة — لم تبدأ مدة التقادم بعد."
    : lim.status === "expired"
      ? "انتهت مدة التقادم — لا تُسمع الدعوى."
      : lim.status === "expiring"
        ? `تنبيه: تبقّى ${lim.days_remaining} يوماً فقط على انتهاء مدة التقادم.`
        : `الدعوى ما زالت مقبولة — تبقّى ${lim.days_remaining} يوماً.`;

  const limitationBlock = `<section class="card avoid-break" data-pdf-section>
      <h2>تقادم الدعوى العمالية — المادة (149)</h2>
      <table><tbody>
        <tr><th>تاريخ انتهاء الخدمة</th><td>${escapeHtml(lim && !lim.ongoing && lim.end_date ? formatDateAr(lim.end_date) : "مستمر")}</td></tr>
        <tr><th>آخر موعد لرفع الدعوى</th><td>${escapeHtml(lim?.deadline ? formatDateAr(lim.deadline) : "—")}</td></tr>
        <tr><th>الأيام المتبقية</th><td>${lim?.days_remaining === null || lim === undefined ? "—" : lim.days_remaining < 0 ? "منتهية" : String(lim.days_remaining)}</td></tr>
        <tr><th>الحالة</th><td style="font-weight:700;">${escapeHtml(limStatusText)}</td></tr>
      </tbody></table>
      <p class="clauses" style="font-size:11px;color:#444;">
        ${escapeHtml(legalCitation("limitation"))} — ${escapeHtml(legalArticle("limitation").text)}
      </p>
    </section>`;

  const articlesBlock = `<section class="card" data-pdf-section>
      <h2>التقرير القانوني التفصيلي — نص المواد وتفسيرها</h2>
      <table><thead>
        <tr><th style="width:22%;">الحق</th><th style="width:18%;">المرجع</th><th>النص والتفسير</th></tr>
      </thead><tbody>
        ${Object.values(LEGAL_ARTICLES).map((a) => `
          <tr>
            <td style="font-weight:700;">${escapeHtml(a.right)}</td>
            <td style="font-size:10px;color:#0F5132;">${escapeHtml(`المادة (${a.article_number}) من ${a.law_name} رقم (${a.law_number}) لسنة ${a.law_year}م`)}</td>
            <td style="font-size:11px;">
              <div style="color:#444;">${escapeHtml(a.text)}</div>
              <div style="margin-top:4px;color:#0F5132;">التفسير: ${escapeHtml(a.interpretation)}</div>
            </td>
          </tr>`).join("")}
      </tbody></table>
    </section>`;

  const approvedRefs = await fetchApprovedLegalReferences();
  const legalList = approvedRefs.length > 0
    ? approvedRefs.map((r) => `<li>${escapeHtml(formatLegalReference(r))}</li>`).join("")
    : `<li><em>${escapeHtml(PENDING_REFERENCE_NOTICE)}</em></li>`;


  const clausesBlock = meta.customClauses?.trim()
    ? `<section class="card avoid-break" data-pdf-section>
         <h2>بنود إضافية</h2>
         <p class="clauses">${escapeHtml(meta.customClauses).replace(/\n/g, "<br/>")}</p>
       </section>`
    : "";

  const footerBlock = branding.footer?.trim()
    ? `<div class="custom-footer" data-pdf-section>${escapeHtml(branding.footer).replace(/\n/g, "<br/>")}</div>`
    : "";

  const logoHtml = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="logo" crossorigin="anonymous" />`
    : `<div class="logo-placeholder">شعار</div>`;

  // A4 @ 96dpi ≈ 794×1123 px. We render at exactly 794px width; export code
  // below scales standard reports to a single page when safe, and otherwise
  // paginates only between full `[data-pdf-section]` blocks.
  const html = `
<div id="pdf-root" dir="rtl" lang="ar">
  <style>
    /* All PDF styling is scoped under #pdf-root so it never leaks to the app. */
    /* أنماط التطبيق العامة تفرض خطاً آخر وتضييق تتبّع على العناوين، وهو ما يقطع
       ربط الحروف العربية داخل صورة التصدير — نعيد فرض Cairo وتتبّعاً طبيعياً. */
    #pdf-root, #pdf-root * {
      font-family: "Cairo", "Noto Naskh Arabic", "Tahoma", "Arial", sans-serif;
      letter-spacing: normal;
    }
    #pdf-root .serial-box .num { letter-spacing: 0.5px; }
    #pdf-root {
      font-family: "Cairo", "Noto Naskh Arabic", "Tahoma", "Arial", sans-serif;
      font-weight: 400;
      color: #212529;
      direction: rtl;
      text-align: right;
      padding: 20px 24px;
      background: #ffffff;
      width: 794px;
      box-sizing: border-box;
      line-height: 1.55;
      font-feature-settings: "kern", "liga", "calt";
      font-kerning: normal;
      text-rendering: optimizeLegibility;
    }
    #pdf-root * { box-sizing: border-box; }
    /* Keep every logical block together; pagination is handled in JS below. */
    #pdf-root .avoid-break,
    #pdf-root table,
    #pdf-root .total,
    #pdf-root .footer,
    #pdf-root .header,
    #pdf-root tr { page-break-inside: avoid; break-inside: avoid; }

    #pdf-root .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      background: #0F5132;
      color: #fff;
      border-radius: 10px;
    }
    #pdf-root .header img,
    #pdf-root .logo-placeholder {
      width: 56px; height: 56px;
      border-radius: 8px;
      background: #ffffff22;
      display: flex; align-items: center; justify-content: center;
      object-fit: contain;
      font-size: 11px; color: #fff;
      border: 1px solid #ffffff33;
      flex-shrink: 0;
    }
    #pdf-root .header .title { flex: 1; min-width: 0; }
    #pdf-root .header h1 {
      margin: 0 0 3px; font-size: 18px; font-weight: 600; line-height: 1.3;
    }
    #pdf-root .header .sub { font-size: 11px; opacity: 0.92; font-weight: 400; }
    #pdf-root .serial-box {
      text-align: center; font-size: 10px; padding: 6px 10px;
      background: #ffffff15; border-radius: 8px; min-width: 120px;
      flex-shrink: 0;
    }
    #pdf-root .serial-box .num {
      font-size: 13px; font-weight: 700; letter-spacing: 0.5px;
      direction: ltr; margin-top: 2px;
    }
    #pdf-root .meta-row {
      display: flex; justify-content: space-between;
      font-size: 10.5px; color: #555; margin-top: 10px;
      border-bottom: 1px solid #e9ecef; padding-bottom: 8px;
    }
    #pdf-root h2 {
      font-size: 13px; color: #0F5132; margin: 12px 0 6px;
      border-right: 3px solid #0F5132; padding-right: 8px;
      font-weight: 600;
    }
    #pdf-root table {
      width: 100%; border-collapse: collapse; font-size: 11.5px;
      background: #fafbfc; border-radius: 8px; overflow: hidden;
    }
    #pdf-root th, #pdf-root td {
      padding: 6px 12px; border-bottom: 1px solid #eef0f2;
      text-align: right;
      vertical-align: middle;
    }
    #pdf-root tr:last-child th, #pdf-root tr:last-child td { border-bottom: 0; }
    #pdf-root th {
      background: #f1f3f5; font-weight: 600; width: 50%;
      color: #495057;
    }
    /* Currency / numeric cells: keep digit grouping tight and aligned in RTL. */
    #pdf-root td {
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum" 1;
    }
    #pdf-root .total {
      margin-top: 12px; padding: 12px 16px;
      background: #0F5132;
      color: #fff; border-radius: 10px;
      display: flex; justify-content: space-between; align-items: center;
    }
    #pdf-root .total .label { font-size: 12.5px; font-weight: 600; opacity: 0.95; }
    #pdf-root .total .value {
      font-size: 20px; font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    #pdf-root .card {
      margin-top: 10px; padding: 10px 12px;
      background: #fafbfc; border: 1px solid #eef0f2; border-radius: 8px;
      font-size: 11px;
    }
    #pdf-root .card h2 {
      margin: 0 0 6px; border: 0; padding: 0;
      font-size: 12.5px;
    }
    #pdf-root .clauses { white-space: pre-wrap; line-height: 1.6; }
    #pdf-root ul { margin: 2px 0; padding-right: 18px; font-size: 10.5px; color: #555; }
    #pdf-root ul li { margin-bottom: 2px; }

    /* Footer (disclaimer + QR + verify URL) — designed to stay on page 1.    */
    /* Compact heights, small QR, single block kept intact via avoid-break.   */
    #pdf-root .footer {
      margin-top: 12px;
      display: flex;
      justify-content: space-between; align-items: stretch;
      gap: 14px; border-top: 1px solid #e9ecef; padding-top: 10px;
    }
    #pdf-root .footer .disclaimer {
      flex: 1; font-size: 9.5px; color: #6c757d; line-height: 1.65;
    }
    #pdf-root .footer .disclaimer strong { color: #495057; }
    #pdf-root .footer .qr {
      text-align: center; font-size: 9px; color: #6c757d;
      display: flex; flex-direction: column; align-items: center;
      gap: 3px; min-width: 110px;
    }
    #pdf-root .footer .qr img {
      width: 84px; height: 84px; display: block;
      border: 1px solid #e9ecef; border-radius: 4px; padding: 2px;
      background: #fff;
    }
    #pdf-root .verify-link {
      direction: ltr; font-family: "Courier New", monospace; font-size: 8px;
      color: #0F5132; word-break: break-all; max-width: 110px; line-height: 1.4;
    }
    #pdf-root .custom-footer {
      margin-top: 8px; padding: 8px 12px; font-size: 10px;
      color: #495057; background: #f1f3f5; border-radius: 6px;
      text-align: center; white-space: pre-wrap;
    }
    #pdf-root .watermark-line {
      margin-top: 6px; text-align: center; font-size: 8.5px;
      color: #adb5bd; letter-spacing: 0;
    }
  </style>

  <div class="header avoid-break" data-pdf-section>
    ${logoHtml}
    <div class="title">
      <h1>${escapeHtml(branding.platformName)}</h1>
      <div class="sub">تقرير احتساب الحقوق العمالية</div>
    </div>
    <div class="serial-box">
      <div>رقم الملف</div>
      <div class="num">${escapeHtml(meta.serial)}</div>
    </div>
  </div>

  <div class="meta-row avoid-break" data-pdf-section>
    <div>تاريخ الإصدار: <strong>${formatDateTimeAr(meta.issuedAt)}</strong></div>
    <div>وقت الإصدار: <strong>${formatTimeAr(meta.issuedAt)}</strong></div>
  </div>

  <div class="avoid-break" data-pdf-section>
    <h2>1. بيانات العامل</h2>
    <table><tbody>${workerRows}</tbody></table>
  </div>

  <div class="avoid-break" data-pdf-section>
    <h2>2. بيانات صاحب العمل</h2>
    <table><tbody>${employerRows}</tbody></table>
  </div>

  <div class="avoid-break" data-pdf-section>
    <h2>3. بيانات الخدمة</h2>
    <table><tbody>${employmentRows}</tbody></table>
  </div>

  <div class="avoid-break" data-pdf-section>
    <h2>4. مدة الخدمة (محسوبة تلقائياً)</h2>
    <table><tbody>${durationRows}</tbody></table>
  </div>

  <div class="avoid-break" data-pdf-section>
    <h2>5. سجل الرواتب</h2>
    ${salaryHistoryTable}
    <p style="margin-top:6px;font-size:10.5px;color:#555;">
      يحتفظ النظام بالراتب الأخير الفعلي فقط؛ تُحفظ الفترات السابقة (إن وُجدت) للأرشيف والتدقيق ولا تُستخدم في الحساب.
    </p>
  </div>

  <div class="avoid-break" data-pdf-section style="margin-top:10px;padding:10px 14px;background:#f6faf7;border:2px solid #0F5132;border-radius:8px;">
    <div style="font-size:11.5px;color:#0F5132;font-weight:700;margin-bottom:4px;">
      6. الراتب المستخدم في حساب مكافأة نهاية الخدمة
    </div>
    <div style="font-size:14px;font-weight:700;color:#212529;">
      ${escapeHtml(formatCurrency(input.monthly_salary, cur))} — آخر راتب فعلي قبل انتهاء الخدمة
    </div>
    <div style="font-size:10.5px;color:#555;margin-top:4px;">
      7. عملة الراتب: <strong>${escapeHtml(cur)} (${escapeHtml(suf)})</strong> — بدون أي تحويل تلقائي للعملات.
    </div>
  </div>

  <div class="avoid-break" data-pdf-section>
    <h2>8. خطوات الاحتساب التفصيلية</h2>
    ${stepsTable}
    <p style="margin-top:8px;font-size:11px;color:#555;border-right:3px solid #0F5132;padding:6px 10px;background:#f6faf7;">
      جميع المعادلات أعلاه قابلة لإعادة التحقق يدوياً من المدخلات. لا توجد حسابات مخفية أو معاملات داخلية غير معروضة.
    </p>
  </div>


  <div class="total avoid-break" data-pdf-section>
    <div class="label">إجمالي الحقوق المضمونة</div>
    <div class="value">${escapeHtml(formatCurrency(result.total_due, cur))}</div>
  </div>

  ${eosBreakdownBlock}

  ${holidayBreakdownBlock}

  ${femaleRightsBlock}

  ${sickBlock}

  ${limitationBlock}

  ${legalNotesBlock}

  ${articlesBlock}

  ${clausesBlock}

  <section class="card avoid-break" data-pdf-section>
    <h2>9. المراجع القانونية</h2>
    <ul>${legalList}</ul>
  </section>

  ${meta.template?.signatureBlock?.trim()
    ? `<section class="card avoid-break" data-pdf-section><h2>التوقيع</h2><div class="clauses">${escapeHtml(meta.template.signatureBlock)}</div></section>`
    : ""}

  <div class="footer avoid-break" data-pdf-section>
    <div class="disclaimer">
      <strong>إخلاء مسؤولية:</strong> ${escapeHtml(meta.template?.disclaimer?.trim() || "هذا التقرير لأغراض معلوماتية ولا يُعد بديلاً عن الاستشارة القانونية الرسمية.")}
      <br/>
      ${escapeHtml(meta.template?.verificationStatement?.trim() || "يمكن التحقق من صحة هذا الملف بمسح رمز الاستجابة السريعة أو إدخال الرقم التسلسلي في صفحة التحقق.")}
    </div>
    <div class="qr">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : ""}
      <div>للتحقق</div>
      <div class="verify-link">${escapeHtml(verifyUrl)}</div>
    </div>
  </div>

  ${meta.template?.watermark?.trim()
    ? `<div class="watermark-line" data-pdf-section>${escapeHtml(meta.template.watermark)}</div>`
    : ""}

  ${footerBlock}
</div>
`;

  // إرجاع HTML فقط (للمعاينة الداخلية والفحص الآلي) — نفس HTML المستخدم في PDF.
  if (opts?.returnHtml) return html;

  // التحويل إلى PDF يتم في المحرك المشترك: ترقيم صفحات، هوامش،
  // تقسيم على حدود الأقسام، وتذييل عربي برقم الصفحة.
  return renderHtmlToPdf({
    html,
    filename: meta.serial,
    footerLabel: `${branding.platformName} • ${meta.serial}`,
    returnBlob: opts?.returnBlob ?? false,
    fast: opts?.fast,
    onStats: opts?.onStats,
  });
}

