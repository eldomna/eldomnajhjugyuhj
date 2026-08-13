import type { SaReportDocument } from "./report-types";

export interface SaStoredReport {
  id: string;
  reportNumber: string;
  version: number;
  caseId: string | null;
  planCode: string;
  netTotal: number;
  currency: string;
  checksum: string;
  downloads: number;
  archived: boolean;
  createdAt: string;
  document: SaReportDocument;
}

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function mapStoredReport(r: any): SaStoredReport {
  return {
    id: r.id,
    reportNumber: r.report_number,
    version: r.version,
    caseId: r.case_id ?? null,
    planCode: r.plan_code,
    netTotal: Number(r.net_total ?? 0),
    currency: r.currency ?? "SAR",
    checksum: r.checksum,
    downloads: r.downloads ?? 0,
    archived: !!r.archived,
    createdAt: r.created_at,
    document: r.document as SaReportDocument,
  };
}
