// عرض وتصدير مستند التقرير النهائي المخزَّن — الواجهة تعرض فقط، ولا تحسب شيئاً.
import QRCode from "qrcode";
import { renderHtmlToPdf, type PdfRenderStats } from "@/lib/pdf-engine";
import type { SaReportDocument, SaReportMoneyRow } from "./report-types";

const money = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);


function moneyTable(title: string, rows: SaReportMoneyRow[], showRefs: boolean) {
  if (!rows.length) return "";
  const body = rows
    .map(
      (l) => `<tr>
        <td style="padding:6px 8px;border:1px solid #d8dee6">
          <div style="font-weight:700">${l.label}</div>
          <div style="font-size:11px;color:#334155;line-height:1.7">${l.explanation}</div>
          ${showRefs ? `<div style="font-size:11px;color:#0f766e">${l.legalRef}</div>` : ""}
        </td>
        <td style="padding:6px 8px;border:1px solid #d8dee6;font-size:11px;color:#475569;font-family:monospace;direction:ltr;text-align:left">${l.formula}</td>
        <td style="padding:6px 8px;border:1px solid #d8dee6;font-family:monospace;direction:ltr;text-align:left;white-space:nowrap">${money(l.amount)}</td>
      </tr>`,
    )
    .join("");
  return `<h2 style="font-size:15px;margin:14px 0 6px">${title}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#f1f5f9">
      <th style="padding:6px 8px;border:1px solid #d8dee6;text-align:right">البند والتفسير</th>
      <th style="padding:6px 8px;border:1px solid #d8dee6;text-align:right">المعادلة</th>
      <th style="padding:6px 8px;border:1px solid #d8dee6;text-align:right">المبلغ</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

export function renderSaReportHtml(doc: SaReportDocument, opts?: { checksum?: string; qrDataUrl?: string }) {
  const h = doc.header;
  const showRefs = doc.legalBasis.visible;
  const contract = doc.contract.rows
    .map(
      (r) => `<tr>
      <td style="padding:5px 8px;border:1px solid #e2e8f0;color:#475569;width:38%">${r.label}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:600">${r.value}</td></tr>`,
    )
    .join("");

  const alerts = doc.alerts.length
    ? `<section data-pdf-section><h2 style="font-size:15px;margin:14px 0 6px">التنبيهات الذكية</h2>` +
      doc.alerts
        .map((a) => {
          const c = a.severity === "error" ? "#b91c1c" : a.severity === "warning" ? "#b45309" : "#0f766e";
          return `<div style="border-right:3px solid ${c};background:#f8fafc;padding:6px 10px;margin-bottom:6px;font-size:12px">
            <span style="font-weight:700;color:${c}">${a.label}:</span> ${a.message}</div>`;
        })
        .join("") +
      `</section>`
    : "";

  const legal = doc.legalBasis.visible && doc.legalBasis.items.length
    ? `<section data-pdf-section><h2 style="font-size:15px;margin:14px 0 6px">الأساس النظامي</h2>
       <ul style="font-size:12px;color:#334155;line-height:1.9;padding-right:18px;margin:0">
         ${doc.legalBasis.items.map((i) => `<li><b>${i.label}:</b> ${i.text}</li>`).join("")}
       </ul>
       <div style="font-size:11px;color:#64748b;margin-top:4px">إصدار الإعدادات النظامية: ${doc.legalBasis.settingsVersion}</div></section>`
    : "";

  const issued = new Date(h.issuedAt);
  const issuedDate = issued.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const issuedTime = issued.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  return `<div id="sa-pdf-root" dir="rtl" style="width:820px;padding:30px;background:#fff;color:#0f172a;
      font-family:Cairo,'Noto Naskh Arabic',Tahoma,system-ui,sans-serif;line-height:1.65;
      font-feature-settings:'kern','liga','calt'">
    <style>
      /* إعادة فرض Cairo وتتبّع طبيعي على العناوين حتى لا تفقد الحروف العربية ترابطها. */
      #sa-pdf-root, #sa-pdf-root h1, #sa-pdf-root h2, #sa-pdf-root h3, #sa-pdf-root th, #sa-pdf-root b {
        font-family: Cairo, 'Noto Naskh Arabic', Tahoma, system-ui, sans-serif;
        letter-spacing: normal;
      }
    </style>
    <div data-pdf-section style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;
        border-bottom:2px solid #0f766e;padding-bottom:12px;margin-bottom:6px">
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${h.logoUrl
          ? `<img src="${h.logoUrl}" alt="logo" crossorigin="anonymous" style="width:54px;height:54px;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0;padding:3px" />`
          : `<div style="width:54px;height:54px;border-radius:8px;background:#ecfdf5;border:1px solid #99f6e4;display:flex;align-items:center;justify-content:center;font-size:11px;color:#0f766e">شعار</div>`}
        <div>
          <div style="font-size:13px;color:#0f766e;font-weight:800">${h.platformName}</div>
          <div style="font-size:11.5px;color:#475569">الحاسبة السعودية — نظام العمل السعودي</div>
          <h1 style="font-size:20px;margin:4px 0 0">${h.title}</h1>
        </div>
      </div>
      <div style="text-align:left;font-size:11px;color:#475569;line-height:1.9;min-width:210px">
        <div>رقم التقرير: <b dir="ltr">${h.reportNumber}</b></div>
        ${h.caseId ? `<div>رقم الحسبة: <span dir="ltr">${h.caseId}</span></div>` : ""}
        <div>الإصدار: ${h.version}</div>
        <div>تاريخ الإصدار: ${issuedDate}</div>
        <div>وقت الإصدار: ${issuedTime}</div>
        ${opts?.checksum ? `<div>بصمة التحقق: <span dir="ltr">${opts.checksum.slice(0, 20)}…</span></div>` : ""}
        ${opts?.qrDataUrl
          ? `<img src="${opts.qrDataUrl}" alt="QR" style="width:78px;height:78px;margin-top:6px;border:1px solid #e2e8f0;padding:2px;background:#fff" />`
          : ""}
      </div>
    </div>

    <section data-pdf-section>
      <h2 style="font-size:15px;margin:12px 0 6px">أطراف العلاقة العمالية</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${doc.parties.employeeProvided || doc.parties.employee
          ? `<tr><td style="padding:5px 8px;border:1px solid #e2e8f0;width:38%;color:#475569">العامل</td><td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:600">${doc.parties.employee}</td></tr>`
          : ""}
        ${doc.parties.employerProvided || doc.parties.employer
          ? `<tr><td style="padding:5px 8px;border:1px solid #e2e8f0;color:#475569">المنشأة</td><td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:600">${doc.parties.employer}</td></tr>`
          : ""}
      </table>
    </section>

    <section data-pdf-section>
      <h2 style="font-size:15px;margin:14px 0 6px">الملخص المالي</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:6px 8px;border:1px solid #e2e8f0">إجمالي المستحقات قبل الخصومات</td><td style="padding:6px 8px;border:1px solid #e2e8f0;direction:ltr;text-align:left">${money(doc.summary.grossTotal)}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #e2e8f0">إجمالي الخصومات والمخالصات</td><td style="padding:6px 8px;border:1px solid #e2e8f0;direction:ltr;text-align:left">${money(doc.summary.deductionsTotal)}</td></tr>
        <tr style="background:#ecfdf5;font-weight:800"><td style="padding:8px;border:1px solid #d8dee6">صافي المستحق (${doc.summary.currency})</td><td style="padding:8px;border:1px solid #d8dee6;direction:ltr;text-align:left">${money(doc.summary.netTotal)}</td></tr>
      </table>
      <div style="font-size:11px;color:#64748b;margin-top:4px">نوع التقرير: ${doc.summary.reportType} — الباقة: ${doc.summary.planCode}</div>
    </section>

    <section data-pdf-section>
      <h2 style="font-size:15px;margin:14px 0 6px">البيانات التعاقدية</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">${contract}</table>
    </section>

    ${doc.financialDetails.visible
      ? `<section data-pdf-section>${moneyTable("تفاصيل المستحقات", doc.financialDetails.entitlements, showRefs)}</section>
         <section data-pdf-section>${moneyTable("الخصومات والمخالصات", doc.financialDetails.deductions, showRefs)}</section>`
      : `<section data-pdf-section><div style="margin-top:14px;padding:10px;border:1px dashed #cbd5e1;border-radius:8px;font-size:12px;color:#64748b">
          التفاصيل المالية والمواد النظامية غير متاحة في هذه الباقة.
        </div></section>`}

    ${legal}
    ${alerts}

    <section data-pdf-section style="margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;line-height:1.8">
      ${doc.disclaimer}
      ${opts?.checksum ? `<div>بصمة التحقق الكاملة: <span dir="ltr">${opts.checksum}</span></div>` : ""}
    </section>
  </div>`;
}

export async function downloadSaReportDocument(
  doc: SaReportDocument,
  checksum: string,
  opts?: { fast?: boolean; returnBlob?: boolean; onStats?: (s: PdfRenderStats) => void },
) {
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(
      `SLC|SA|${doc.header.reportNumber}|${checksum}`,
      { margin: 1, width: 200 },
    );
  } catch {
    /* تجاهل: التقرير يبقى صالحاً بدون رمز QR */
  }
  return renderHtmlToPdf({
    html: renderSaReportHtml(doc, { checksum, qrDataUrl }),
    filename: doc.header.reportNumber,
    footerLabel: `${doc.header.platformName} • ${doc.header.reportNumber}`,
    fast: opts?.fast,
    returnBlob: opts?.returnBlob,
    onStats: opts?.onStats,
  });
}

