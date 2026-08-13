const KEY = "ylr_documents_v1";

export interface LocalDocRecord {
  serial: string;
  employee_name: string;
  employer_name: string;
  total_amount: number;
  currency?: string;
  issued_at: string; // ISO
}

export function getLocalDocs(): LocalDocRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function addLocalDoc(rec: LocalDocRecord) {
  const all = getLocalDocs();
  if (all.find((r) => r.serial === rec.serial)) return;
  all.unshift(rec);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
}

export function findLocalDoc(serial: string): LocalDocRecord | undefined {
  return getLocalDocs().find(
    (r) => r.serial.toUpperCase() === serial.trim().toUpperCase(),
  );
}
