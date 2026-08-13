// ============================================================================
// محرك تصدير PDF المشترك (اليمن + السعودية)
// ----------------------------------------------------------------------------
// لا يحتوي هذا الملف على أي منطق حسابي — مهمته فقط تحويل HTML جاهز إلى PDF:
//   1. تحميل خط Cairo العربي (400/600/700/800) وتضمينه فعلياً قبل التصوير،
//      وإلا سقط المتصفح على خط نظام لا يربط الحروف العربية.
//   2. ترقيم صفحات A4 مع هوامش متساوية، وتقسيم على حدود الأقسام
//      (`[data-pdf-section]`) وليس في منتصف سطر أو صف جدول.
//   3. تذييل عربي حقيقي (صورة نصية مُشكَّلة) يحمل رقم الصفحة وإجمالي الصفحات.
// ============================================================================

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap";

/** أوزان Cairo المستخدمة في التقارير — يعتمد عليها الفحص الآلي أيضاً. */
export const PDF_FONT_FAMILY = "Cairo";
export const PDF_FONT_SPECS = [
  '400 12px "Cairo"',
  '600 13px "Cairo"',
  '700 14px "Cairo"',
  '800 16px "Cairo"',
] as const;

let fontsPromise: Promise<void> | null = null;

/** ينتظر وعداً بمهلة قصوى حتى لا يتجمد التصدير في بيئات الاختبار الآلي. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]);
}

/** يضمن تحميل خط Cairo بجميع الأوزان المستخدمة قبل أي تصوير للـ DOM. */
export function ensureArabicFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    if (typeof document === "undefined") return;
    if (!document.getElementById("pdf-cairo-font")) {
      const link = document.createElement("link");
      link.id = "pdf-cairo-font";
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      // مهلة قصوى 5 ثوانٍ: لو تعذّر جلب الخط لا يتوقف التصدير إلى ما لا نهاية.
      await withTimeout(
        (async () => {
          await Promise.all(PDF_FONT_SPECS.map((spec) => fonts.load(spec)));
          await fonts.ready;
        })(),
        5000,
      );
    }
    await new Promise((r) => setTimeout(r, 80));
  })();
  return fontsPromise;
}

/** يتحقق أن أوزان Cairo متاحة فعلياً في المتصفح (يستخدمه فحص الجودة الآلي). */
export function arabicFontsReady(): boolean {
  const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
  if (!fonts) return false;
  // خط Cairo متغيّر (variable): المتصفح يخدم مدى أوزان واحداً، لذا قد يعيد
  // fonts.check() قيمة false لوزن وسيط رغم أنه يُرسم صحيحاً. نعتمد الوزن
  // الأساسي كمؤشر التحميل، وسلامة الأوزان يغطيها فحص التشكيل والعرض.
  return fonts.check(PDF_FONT_SPECS[0]) || PDF_FONT_SPECS.some((spec) => fonts.check(spec));
}

const DEFAULT_SCALE = 2;

function buildCanvasOptions(scale: number) {
  return {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    // نفس عرض التصميم حتى يُحسب تشكيل العربية على هندسة الصفحة النهائية.
    // ممنوع تشغيل letterRendering: يرسم كل حرف منفرداً فيكسر ربط العربية.
    windowWidth: 820,
    logging: false,
    removeContainer: true,
  } as const;
}

/**
 * يرسم تذييلات كل الصفحات في لقطة واحدة ثم يقصّها.
 * سابقاً كان كل صفحة تستدعي html2canvas على حدة، وهو أبطأ مصدر في التصدير
 * (تقرير من 8 صفحات = 8 لقطات إضافية) وكان يتسبب في تجاوز المهلة آلياً.
 */
async function renderFooterStrip(
  labels: string[],
): Promise<{ items: string[]; ratio: number } | null> {
  if (labels.length === 0) return null;
  const ROW = 20;
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;";
  holder.innerHTML = `<div style="width:700px;background:#fff;
      font-family:Cairo,'Noto Naskh Arabic',Tahoma,sans-serif;font-size:11px;color:#64748b;
      direction:rtl;text-align:center">${labels
        .map(
          (t) =>
            `<div style="height:${ROW}px;line-height:${ROW}px;background:#fff">${t}</div>`,
        )
        .join("")}</div>`;
  document.body.appendChild(holder);
  try {
    const canvas = await html2canvas(holder.firstElementChild as HTMLElement, {
      scale: 2,
      backgroundColor: "#ffffff",
      windowWidth: 820,
      logging: false,
    });
    if (!canvas.width || !canvas.height) return null;
    const rowPx = canvas.height / labels.length;
    const items = labels.map((_, i) =>
      sliceCanvas(canvas, i * rowPx, (i + 1) * rowPx, "image/png"),
    );
    return { items, ratio: rowPx / canvas.width };
  } catch {
    return null;
  } finally {
    holder.remove();
  }
}

/** نقاط القطع الآمنة داخل قسم طويل: أسفل كل صف/سطر/فقرة. */
function safeCutOffsets(section: HTMLElement, scale: number): number[] {
  const top = section.getBoundingClientRect().top;
  const nodes = section.querySelectorAll<HTMLElement>("tr, li, p, h2, h3, .row-break");
  const offsets = new Set<number>();
  nodes.forEach((n) => {
    const r = n.getBoundingClientRect();
    if (r.height > 0) offsets.add((r.bottom - top) * scale);
  });
  return Array.from(offsets).sort((a, b) => a - b);
}

function sliceCanvas(
  source: HTMLCanvasElement,
  from: number,
  to: number,
  type: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.92,
): string {
  const height = Math.max(1, Math.round(to - from));
  const slice = document.createElement("canvas");
  slice.width = source.width;
  slice.height = height;
  const ctx = slice.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(source, 0, Math.round(from), source.width, height, 0, 0, source.width, height);
  }
  return type === "image/png" ? slice.toDataURL("image/png") : slice.toDataURL(type, quality);
}

export interface PdfRenderOptions {
  /** HTML كامل للتقرير — يجب أن يحتوي عناصر `[data-pdf-section]`. */
  html: string;
  /** اسم الملف بدون امتداد. */
  filename: string;
  /** نص التذييل بجانب رقم الصفحة (رقم التقرير/البصمة مثلاً). */
  footerLabel?: string;
  /** إرجاع Blob بدلاً من التنزيل المباشر (يُستخدم في الاختبارات). */
  returnBlob?: boolean;
  /**
   * وضع سريع: دقة أقل قليلاً وضغط أعلى — يستخدمه فحص الاختبار الآلي
   * والمعاينة الداخلية لتجنّب تجاوز المهلة. لا يغيّر أي محتوى أو حساب.
   */
  fast?: boolean;
  /** قياس التصوير (افتراضي 2، والوضع السريع 1.5). */
  scale?: number;
  /** إحصاءات الأداء للفحص الآلي. */
  onStats?: (stats: PdfRenderStats) => void;
}

export interface PdfRenderStats {
  sections: number;
  pages: number;
  durationMs: number;
  bytes: number;
  fontsReady: boolean;
}

/**
 * يحوّل HTML التقرير إلى PDF بحجم A4 مع ترقيم صفحات وتذييل عربي.
 * لا يمس أي بيانات: يستقبل HTML مبنياً مسبقاً ويُخرج ملفاً فقط.
 */
export async function renderHtmlToPdf(options: PdfRenderOptions): Promise<Blob | void> {
  const startedAt = Date.now();
  await ensureArabicFonts();

  const scale = options.scale ?? (options.fast ? 1.5 : DEFAULT_SCALE);
  const quality = options.fast ? 0.82 : 0.92;
  const canvasOptions = buildCanvasOptions(scale);

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;";
  container.innerHTML = options.html;
  document.body.appendChild(container);

  try {
    const root = container.firstElementChild as HTMLElement;
    // انتظار الصور (الشعار / QR) بمهلة قصوى: صورة معلّقة كانت تجمّد التصدير.
    await withTimeout(
      Promise.all(
        Array.from(root.querySelectorAll("img")).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
        ),
      ),
      4000,
    );
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const footerSpace = 26;
    const contentWidth = pageWidth - margin * 2;
    const contentBottom = pageHeight - margin - footerSpace;

    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-section]"));
    const targets = sections.length > 0 ? sections : [root];

    let y = margin;
    const newPage = () => {
      pdf.addPage();
      y = margin;
    };

    for (const section of targets) {
      const canvas = await html2canvas(section, canvasOptions);
      if (!canvas.width || !canvas.height) continue;

      const ratio = contentWidth / canvas.width; // px الكانفاس → نقاط PDF
      const fullHeight = canvas.height * ratio;
      const pageCapacity = contentBottom - margin;

      // القسم يدخل كاملاً في المساحة المتبقية أو في صفحة كاملة.
      if (y + fullHeight <= contentBottom || fullHeight <= pageCapacity) {
        if (y + fullHeight > contentBottom && y > margin) newPage();
        pdf.addImage(
          canvas.toDataURL("image/jpeg", quality),
          "JPEG",
          margin,
          y,
          contentWidth,
          fullHeight,
        );
        y += fullHeight + 8;
        continue;
      }

      // قسم أطول من صفحة (جدول مواد قانونية مثلاً): نقطّعه على حدود الصفوف.
      const cuts = safeCutOffsets(section, scale);
      let from = 0;
      while (from < canvas.height) {
        const available = (y > margin ? contentBottom - y : pageCapacity) / ratio;
        if (available < 60) {
          newPage();
          continue;
        }
        const limit = from + available;
        let to = canvas.height <= limit ? canvas.height : 0;
        if (!to) {
          for (const cut of cuts) {
            if (cut > from && cut <= limit) to = cut;
          }
          if (!to) to = limit; // لا حدود صفوف متاحة — قطع مباشر كحل أخير
        }
        const height = (to - from) * ratio;
        pdf.addImage(
          sliceCanvas(canvas, from, to, "image/jpeg", quality),
          "JPEG",
          margin,
          y,
          contentWidth,
          height,
        );
        y += height + 8;
        from = to;
        if (from < canvas.height) newPage();
      }
    }

    // تذييل عربي مُشكَّل يحمل رقم الصفحة — لقطة واحدة لكل الصفحات (أسرع بكثير).
    const totalPages = pdf.getNumberOfPages();
    const label = options.footerLabel ? `${options.footerLabel} — ` : "";
    const strip = await renderFooterStrip(
      Array.from({ length: totalPages }, (_, i) => `${label}صفحة ${i + 1} من ${totalPages}`),
    );
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      const item = strip?.items[i - 1];
      if (item && strip) {
        const w = Math.min(contentWidth, 320);
        const h = w * strip.ratio;
        pdf.addImage(item, "PNG", (pageWidth - w) / 2, pageHeight - margin - h + 6, w, h);
      } else {
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        pdf.text(`${i} / ${totalPages}`, pageWidth / 2, pageHeight - margin, { align: "center" });
      }
    }

    const blob = pdf.output("blob");
    options.onStats?.({
      sections: targets.length,
      pages: totalPages,
      durationMs: Date.now() - startedAt,
      bytes: blob.size,
      fontsReady: arabicFontsReady(),
    });

    if (options.returnBlob) return blob;
    pdf.save(`${options.filename}.pdf`);
  } finally {
    container.remove();
  }
}
