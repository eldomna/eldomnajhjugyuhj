// PART 1O — تصدير التقرير القانوني النهائي: HTML / PDF / DOCX / XLSX / JSON.
import QRCode from "qrcode";
import type { FinalReportDocument, ReportBlock, ReportSection } from "./finalReport";

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/* ============================ HTML ============================ */

function blockHtml(b: ReportBlock): string {
  const title = b.title ? `<h3 style="font-size:14px;margin:12px 0 6px;color:#0f766e">${esc(b.title)}</h3>` : "";
  if (b.kind === "text") return `${title}<p style="font-size:12.5px;line-height:2;color:#334155;margin:0 0 8px">${esc(b.text)}</p>`;
  if (b.kind === "list")
    return `${title}<ul style="font-size:12.5px;line-height:2;color:#334155;padding-inline-start:18px;margin:0 0 8px">${b.items
      .map((i) => `<li>${esc(i)}</li>`)
      .join("")}</ul>`;
  if (b.kind === "kv")
    return `${title}<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:10px">${b.rows
      .map(
        (r) =>
          `<tr><td style="padding:5px 8px;border:1px solid #e2e8f0;color:#475569;width:36%">${esc(
            r.label,
          )}</td><td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:600">${esc(r.value)}</td></tr>`,
      )
      .join("")}</table>`;
  return `${title}<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px">
    <thead><tr style="background:#f1f5f9">${b.head
      .map((h) => `<th style="padding:6px 8px;border:1px solid #d8dee6;text-align:right">${esc(h)}</th>`)
      .join("")}</tr></thead>
    <tbody>${b.rows
      .map(
        (r) =>
          `<tr>${r
            .map((c) => `<td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(c)}</td>`)
            .join("")}</tr>`,
      )
      .join("")}
      ${
        b.totalRow
          ? `<tr style="background:#ecfdf5;font-weight:800">${b.totalRow
              .map((c) => `<td style="padding:7px 8px;border:1px solid #d8dee6">${esc(c)}</td>`)
              .join("")}</tr>`
          : ""
      }
    </tbody></table>`;
}

function sectionHtml(s: ReportSection, index: number): string {
  return `<section data-pdf-section style="margin-bottom:18px">
    <h2 style="font-size:16px;margin:0 0 8px;padding-bottom:4px;border-bottom:1px solid #cbd5e1">${index}. ${esc(
      s.name,
    )}</h2>
    ${s.blocks.map(blockHtml).join("")}
  </section>`;
}

export function renderFinalReportHtml(doc: FinalReportDocument, qrDataUrl?: string): string {
  const h = doc.header;
  const watermark = doc.watermark
    ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
        <div style="transform:rotate(-30deg);font-size:52px;font-weight:800;color:rgba(15,118,110,0.10)">${esc(
          doc.watermark,
        )}</div></div>`
    : "";

  return `<div dir="rtl" style="position:relative;width:820px;padding:32px;background:#fff;color:#0f172a;font-family:Cairo,'Noto Naskh Arabic',Tahoma,system-ui,sans-serif">
    ${watermark}
    <div data-pdf-section style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #0f766e;padding-bottom:12px;margin-bottom:16px">
      <div>
        ${h.logoUrl ? `<img src="${esc(h.logoUrl)}" alt="${esc(h.platformName)}" style="height:38px;margin-bottom:6px" />` : ""}
        <div style="font-size:13px;color:#0f766e;font-weight:800">${esc(h.platformName)}</div>
        <h1 style="font-size:21px;margin:4px 0 0">${esc(h.title)}</h1>
        <div style="font-size:11.5px;color:#475569;margin-top:4px">${esc(h.reportTypeLabel)} • ${esc(h.authority)}</div>
      </div>
      <div style="text-align:left;font-size:11px;color:#475569;line-height:1.9">
        <div>رقم التقرير: <b dir="ltr">${esc(h.reportNumber)}</b></div>
        <div>رقم القضية: <span dir="ltr">${esc(h.caseId ?? "—")}</span></div>
        <div>تاريخ الإصدار: <span dir="ltr">${new Date(h.issuedAt).toLocaleString("en-GB")}</span></div>
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:84px;height:84px;margin-top:6px" />` : ""}
      </div>
    </div>

    <div data-pdf-section style="display:flex;gap:8px;margin-bottom:16px;font-size:12px">
      ${[
        ["إجمالي الحقوق", doc.totals.totalRights],
        ["المسدد", doc.totals.totalPaid],
        ["المستبعد", doc.totals.totalExcluded],
        ["الرصيد النهائي", doc.totals.finalBalance],
      ]
        .map(
          ([l, v]) =>
            `<div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center">
              <div style="color:#64748b;font-size:11px">${esc(String(l))}</div>
              <div style="font-weight:800;direction:ltr">${new Intl.NumberFormat("en-US", {
                maximumFractionDigits: 2,
              }).format(Number(v))} ${esc(doc.totals.currency)}</div>
            </div>`,
        )
        .join("")}
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center">
        <div style="color:#64748b;font-size:11px">اكتمال البيانات</div>
        <div style="font-weight:800">${doc.totals.confidenceScore}%</div>
      </div>
    </div>

    ${doc.sections.map((s, i) => sectionHtml(s, i + 1)).join("")}

    <div data-pdf-section style="margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;line-height:1.9">
      <div>نوع التقرير: ${esc(h.reportTypeLabel)}</div>
      ${
        doc.signature
          ? `<div>التوقيع الرقمي: <span dir="ltr">${esc(doc.signature.hash.slice(0, 32))}</span> — ${esc(
              doc.signature.signedBy,
            )}</div>`
          : ""
      }
      <div>بصمة التحقق (QR): <span dir="ltr">${esc(h.qrHash.slice(0, 32))}</span></div>
      <div>رابط التحقق: <span dir="ltr">${esc(h.verifyUrl)}</span></div>
    </div>
  </div>`;
}

export async function buildQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 200 });
  } catch {
    return "";
  }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ============================ HTML file ============================ */

export async function downloadReportHtml(doc: FinalReportDocument) {
  const qr = await buildQrDataUrl(doc.header.verifyUrl);
  const body = renderFinalReportHtml(doc, qr);
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
  <title>${esc(doc.header.reportNumber)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head><body style="margin:0;background:#f1f5f9;display:flex;justify-content:center;padding:20px">${body}</body></html>`;
  download(new Blob([html], { type: "text/html;charset=utf-8" }), `${doc.header.reportNumber}.html`);
}

/* ============================ JSON ============================ */

export function downloadReportJson(doc: FinalReportDocument) {
  download(
    new Blob([JSON.stringify(doc, null, 2)], { type: "application/json;charset=utf-8" }),
    `${doc.header.reportNumber}.json`,
  );
}

/* ============================ PDF ============================ */

export async function downloadReportPdf(doc: FinalReportDocument, opts?: { fast?: boolean }) {
  const qr = await buildQrDataUrl(doc.header.verifyUrl);
  const { renderHtmlToPdf } = await import("@/lib/pdf-engine");
  await renderHtmlToPdf({
    html: renderFinalReportHtml(doc, qr),
    filename: doc.header.reportNumber,
    footerLabel: `${doc.header.platformName} • ${doc.header.reportNumber}`,
    fast: opts?.fast,
  });
}


/* ============================ DOCX ============================ */

export async function downloadReportDocx(doc: FinalReportDocument) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    BorderStyle,
  } = await import("docx");

  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text: string, opts: { bold?: boolean; fill?: string; width: number } = { width: 4680 }) =>
    new TableCell({
      borders,
      width: { size: opts.width, type: WidthType.DXA },
      ...(opts.fill ? { shading: { fill: opts.fill, type: ShadingType.CLEAR } } : {}),
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text, bold: opts.bold, rightToLeft: true })],
        }),
      ],
    });

  const table = (head: string[], rows: string[][], totalRow?: string[]) => {
    const cols = Math.max(head.length, 1);
    const w = Math.floor(9360 / cols);
    const widths = Array.from({ length: cols }, () => w);
    return new Table({
      width: { size: w * cols, type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        new TableRow({ children: head.map((t) => cell(t, { bold: true, fill: "E2E8F0", width: w })) }),
        ...rows.map((r) => new TableRow({ children: r.map((t) => cell(t, { width: w })) })),
        ...(totalRow
          ? [new TableRow({ children: totalRow.map((t) => cell(t, { bold: true, fill: "ECFDF5", width: w })) })]
          : []),
      ],
    });
  };

  const p = (text: string, opts: { bold?: boolean; size?: number; heading?: boolean } = {}) =>
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      ...(opts.heading ? { heading: HeadingLevel.HEADING_2 } : {}),
      spacing: { after: 120 },
      children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 24, rightToLeft: true })],
    });

  const children: unknown[] = [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: doc.header.platformName, bold: true, rightToLeft: true })],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: doc.header.title, bold: true, size: 32, rightToLeft: true })],
    }),
    table(
      ["البيان", "القيمة"],
      [
        ["رقم التقرير", doc.header.reportNumber],
        ["نوع التقرير", doc.header.reportTypeLabel],
        ["رقم القضية", doc.header.caseId ?? "—"],
        ["تاريخ الإصدار", new Date(doc.header.issuedAt).toLocaleString("en-GB")],
        ["بصمة التحقق", doc.header.qrHash.slice(0, 32)],
      ],
    ),
    p(""),
  ];

  doc.sections.forEach((s, i) => {
    children.push(p(`${i + 1}. ${s.name}`, { bold: true, heading: true }));
    s.blocks.forEach((b) => {
      if (b.title) children.push(p(b.title, { bold: true }));
      if (b.kind === "text") children.push(p(b.text));
      else if (b.kind === "list") b.items.forEach((it) => children.push(p(`• ${it}`)));
      else if (b.kind === "kv")
        children.push(table(["البيان", "القيمة"], b.rows.map((r) => [r.label, r.value])));
      else children.push(table(b.head, b.rows, b.totalRow));
      children.push(p(""));
    });
  });

  const file = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: children as never,
      },
    ],
  });

  const blob = await Packer.toBlob(file);
  download(blob, `${doc.header.reportNumber}.docx`);
}

/* ============================ XLSX ============================ */

export async function downloadReportXlsx(doc: FinalReportDocument) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const cover: string[][] = [
    ["اسم النظام", doc.header.platformName],
    ["عنوان التقرير", doc.header.title],
    ["رقم التقرير", doc.header.reportNumber],
    ["نوع التقرير", doc.header.reportTypeLabel],
    ["رقم القضية", doc.header.caseId ?? "—"],
    ["تاريخ الإصدار", new Date(doc.header.issuedAt).toLocaleString("en-GB")],
    ["العملة", doc.totals.currency],
    ["إجمالي الحقوق", String(doc.totals.totalRights)],
    ["إجمالي المسدد", String(doc.totals.totalPaid)],
    ["إجمالي المستبعد", String(doc.totals.totalExcluded)],
    ["الرصيد النهائي", String(doc.totals.finalBalance)],
    ["درجة اكتمال البيانات", `${doc.totals.confidenceScore}%`],
    ["بصمة التحقق", doc.header.qrHash],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cover), "الغلاف");

  const used = new Set<string>(["الغلاف"]);
  doc.sections.forEach((s, idx) => {
    const aoa: string[][] = [];
    s.blocks.forEach((b) => {
      if (b.title) aoa.push([b.title]);
      if (b.kind === "text") aoa.push([b.text]);
      else if (b.kind === "list") b.items.forEach((i) => aoa.push([i]));
      else if (b.kind === "kv") b.rows.forEach((r) => aoa.push([r.label, r.value]));
      else {
        aoa.push(b.head);
        b.rows.forEach((r) => aoa.push(r));
        if (b.totalRow) aoa.push(b.totalRow);
      }
      aoa.push([]);
    });
    let name = `${idx + 1}-${s.name}`.replace(/[\\/*?:[\]]/g, "").slice(0, 28);
    while (used.has(name)) name = `${name}_`.slice(0, 31);
    used.add(name);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [[""]]), name);
  });

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${doc.header.reportNumber}.xlsx`,
  );
}
