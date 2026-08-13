// ============================================================================
// فحص آلي لجودة تصدير PDF (بدون أي منطق حسابي)
// ----------------------------------------------------------------------------
// يتحقق من ثلاثة أمور على نفس HTML الذي يُصوَّر داخل الـ PDF:
//   1. الخط العربي مُحمَّل فعلياً (Cairo) والحروف مُشكَّلة/مربوطة وليست مربعات.
//   2. الاتجاه RTL والمحاذاة والجداول سليمة ولا يوجد فيضان أفقي أو خلايا فارغة.
//   3. القيم المالية في التقرير تطابق نتيجة الحاسبة 100 % (بنود + إجماليات).
// ============================================================================

import { PDF_FONT_SPECS, arabicFontsReady, ensureArabicFonts } from "./pdf-engine";

export interface CheckResult {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface AmountExpectation {
  label: string;
  amount: number;
}

/* ------------------------------ أدوات مساعدة ------------------------------ */

function mountOffscreen(html: string) {
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;width:820px;z-index:-1;";
  holder.innerHTML = html;
  document.body.appendChild(holder);
  return holder;
}

/** يقيس عرض نص عربي بخط معيّن — يكشف السقوط على خط بديل. */
function measure(text: string, font: string): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

const ARABIC_SAMPLE = "إجمالي الحقوق المستحقة للعامل";

/** كل الأرقام الظاهرة في التقرير كنص (بعد إزالة الوسوم). */
export function extractNumbers(html: string): number[] {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ");
  const out: number[] = [];
  for (const m of text.matchAll(/-?\d[\d,\u066C\u0660-\u0669]*(?:\.\d+)?/g)) {
    const normalized = m[0]
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[,\u066C]/g, "");
    const n = Number(normalized);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* --------------------------- 1) الخط والتشكيل --------------------------- */

export async function checkArabicTypography(html: string): Promise<CheckResult[]> {
  await ensureArabicFonts();
  const checks: CheckResult[] = [];

  checks.push({
    id: "font-loaded",
    label: "خط Cairo محمَّل بكل الأوزان",
    pass: arabicFontsReady(),
    detail: PDF_FONT_SPECS.join(" · "),
  });

  const cairoWidth = measure(ARABIC_SAMPLE, '700 14px "Cairo"');
  const fallbackWidth = measure(ARABIC_SAMPLE, "700 14px monospace");
  checks.push({
    id: "font-applied",
    label: "النص العربي يُرسم بخط Cairo لا بخط بديل",
    pass: cairoWidth > 0 && Math.abs(cairoWidth - fallbackWidth) > 1,
    detail: `Cairo=${cairoWidth.toFixed(1)}px · بديل=${fallbackWidth.toFixed(1)}px`,
  });

  // ربط الحروف: عرض الكلمة الموصولة أقل من مجموع أعراض حروفها منفردة.
  const joined = measure("مكافأة", '400 14px "Cairo"');
  const separated = "مكافأة".split("").reduce((s, ch) => s + measure(ch, '400 14px "Cairo"'), 0);
  checks.push({
    id: "font-shaping",
    label: "الحروف العربية مربوطة (Shaping) وليست منفصلة",
    pass: joined > 0 && joined < separated * 0.95,
    detail: `موصول=${joined.toFixed(1)}px < منفصل=${separated.toFixed(1)}px`,
  });

  const holder = mountOffscreen(html);
  try {
    const root = holder.firstElementChild as HTMLElement | null;
    const target =
      root?.querySelector<HTMLElement>("h1, h2, td, th, div") ?? (root as HTMLElement | null);
    const family = target ? getComputedStyle(target).fontFamily : "";
    checks.push({
      id: "font-family-html",
      label: "HTML التقرير يعلن Cairo كخط أساسي",
      pass: /cairo/i.test(family) || /cairo/i.test(html),
      detail: family || "—",
    });
  } finally {
    holder.remove();
  }

  return checks;
}

/* --------------------------- 2) RTL والمحاذاة --------------------------- */

export function checkRtlLayout(html: string): CheckResult[] {
  const checks: CheckResult[] = [];
  const holder = mountOffscreen(html);
  try {
    const root = holder.firstElementChild as HTMLElement;
    if (!root) {
      return [{ id: "rtl-root", label: "جذر التقرير موجود", pass: false, detail: "HTML فارغ" }];
    }

    const dir = getComputedStyle(root).direction;
    checks.push({
      id: "rtl-direction",
      label: "اتجاه التقرير RTL",
      pass: dir === "rtl" || /dir="rtl"|direction:\s*rtl/i.test(html),
      detail: `direction=${dir}`,
    });

    const cells = Array.from(root.querySelectorAll<HTMLElement>("th, td"));
    // في RTL المحاذاة المقبولة للنص العربي: right / start / center.
    // الخلايا المعلَّنة LTR (أرقام، معادلات، أرقام تقارير) يُسمح لها بمحاذاة يسار.
    const rtlCells = cells.filter(
      (c) =>
        /[\u0621-\u064A]/.test(c.textContent ?? "") && getComputedStyle(c).direction === "rtl",
    );
    const misaligned = rtlCells.filter((c) => getComputedStyle(c).textAlign === "left");
    checks.push({
      id: "rtl-align",
      label: "محاذاة خلايا الجداول العربية متوافقة مع RTL",
      pass: misaligned.length === 0,
      detail: `${cells.length} خلية (${rtlCells.length} عربية RTL) · ${misaligned.length} بمحاذاة يسار`,
    });

    const tables = Array.from(root.querySelectorAll("table"));
    const emptyTables = tables.filter((t) => t.querySelectorAll("tr").length === 0);
    checks.push({
      id: "tables-rows",
      label: "كل الجداول تحتوي صفوفاً",
      pass: tables.length > 0 && emptyTables.length === 0,
      detail: `${tables.length} جدول · ${emptyTables.length} فارغ`,
    });

    const rootWidth = root.getBoundingClientRect().width;
    const overflowing = Array.from(root.querySelectorAll<HTMLElement>("table, section, div")).filter(
      (el) => el.scrollWidth > Math.ceil(el.clientWidth) + 2,
    );
    checks.push({
      id: "no-overflow",
      label: "لا يوجد فيضان أفقي يقطع النص",
      pass: overflowing.length === 0,
      detail: `عرض التقرير ${Math.round(rootWidth)}px · ${overflowing.length} عنصر فائض`,
    });

    const sections = root.querySelectorAll("[data-pdf-section]");
    checks.push({
      id: "sections",
      label: "أقسام التقسيم الآمن للصفحات معرَّفة",
      pass: sections.length > 0,
      detail: `${sections.length} قسم [data-pdf-section]`,
    });

    const arabicChars = (root.textContent ?? "").match(/[\u0621-\u064A]/g)?.length ?? 0;
    checks.push({
      id: "arabic-content",
      label: "التقرير يحتوي نصاً عربياً فعلياً",
      pass: arabicChars > 100,
      detail: `${arabicChars} حرفاً عربياً`,
    });

    const tofu = (root.textContent ?? "").match(/[\uFFFD\u25A1]/g)?.length ?? 0;
    checks.push({
      id: "no-tofu",
      label: "لا رموز مفقودة (□ / �) في النص",
      pass: tofu === 0,
      detail: `${tofu} رمز مفقود`,
    });

    return checks;
  } finally {
    holder.remove();
  }
}

/* ------------------- 3) مطابقة القيم مع نتيجة الحاسبة ------------------- */

/**
 * يتحقق أن كل بند/إجمالي في نتيجة الحاسبة ظاهر حرفياً داخل HTML التصدير،
 * وأن مجموع البنود يساوي الإجمالي المعروض (بفارق ≤ 0.05 لتقريب العرض).
 */
export function checkAmountsMatch(
  html: string,
  items: AmountExpectation[],
  total?: AmountExpectation,
  extras: AmountExpectation[] = [],
): CheckResult[] {
  const numbers = new Set(extractNumbers(html).map(round2));
  // الخصومات تُعرض في التقرير كأرقام موجبة داخل جدول «الخصومات»، لذا نقبل القيمة المطلقة.
  const present = (amount: number) =>
    [amount, Math.abs(amount)].some(
      (v) =>
        numbers.has(round2(v)) ||
        numbers.has(round2(Math.round(v))) ||
        Array.from(numbers).some((n) => Math.abs(n - v) <= 0.05),
    );

  const checks: CheckResult[] = [...items, ...extras].map((item) => ({
    id: `amount:${item.label}`,
    label: `البند «${item.label}» ظاهر بقيمته`,
    pass: present(item.amount),
    detail: `${item.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
  }));

  if (total) {
    const sum = items.reduce((s, i) => s + i.amount, 0);
    checks.push({
      id: "total-present",
      label: `الإجمالي «${total.label}» ظاهر في التصدير`,
      pass: present(total.amount),
      detail: `${total.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    });
    checks.push({
      id: "total-consistent",
      label: "مجموع البنود = الإجمالي المعروض",
      pass: Math.abs(sum - total.amount) <= 0.05,
      detail: `مجموع البنود ${round2(sum)} مقابل ${round2(total.amount)}`,
    });
  }

  return checks;
}

/** يشغّل كل الفحوص على تقرير واحد. */
export async function verifyReportExport(params: {
  html: string;
  items: AmountExpectation[];
  total?: AmountExpectation;
  /** بنود تُفحص كوجود فقط ولا تدخل في مجموع الإجمالي. */
  extras?: AmountExpectation[];
}): Promise<CheckResult[]> {
  return [
    ...(await checkArabicTypography(params.html)),
    ...checkRtlLayout(params.html),
    ...checkAmountsMatch(params.html, params.items, params.total, params.extras),
  ];
}
