// PART 1E — منطق الرواتب المتأخرة والمبالغ غير المسددة
// لا يعدّل محركي الحساب السعودي/اليمني — يوفّر مخرجات جاهزة للمحرك والتقرير.

export type PaymentStatus = "unpaid" | "paid" | "partial";

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: "unpaid", label: "لا (غير مسدد)" },
  { value: "paid", label: "نعم (تم السداد)" },
  { value: "partial", label: "سداد جزئي" },
];

export const PAYMENT_METHODS = [
  "تحويل بنكي",
  "نقداً",
  "شيك",
  "مسير رواتب",
  "منصة حماية الأجور",
  "طريقة أخرى",
] as const;

export const PROOF_TYPES = [
  "كشف حساب",
  "حوالة",
  "إيصال",
  "سند قبض",
  "كشف حماية الأجور (WPS)",
  "مستند آخر",
] as const;

export const MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export type UnpaidRow = {
  id?: string;
  month: number | "";
  year: number | "";
  due_date: string;
  salary_type: string;
  amount: number | "";
  currency: string;
  payment_status: PaymentStatus;
  paid_amount: number | "";
  payment_date: string;
  payment_method: string;
  proof_type: string;
  proof_file: string;
  notes: string;
};

export const emptyUnpaidRow = (currency = "SAR"): UnpaidRow => ({
  month: "",
  year: new Date().getFullYear(),
  due_date: "",
  salary_type: "monthly_salary",
  amount: "",
  currency,
  payment_status: "unpaid",
  paid_amount: "",
  payment_date: "",
  payment_method: "",
  proof_type: "",
  proof_file: "",
  notes: "",
});

const n = (v: number | "" | null | undefined) => (v === "" || v == null ? 0 : Number(v) || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** المتبقي = المستحق − المسدد (مع اعتبار غياب الإثبات) */
export function rowRemaining(row: UnpaidRow): number {
  const amount = n(row.amount);
  if (row.payment_status === "unpaid") return r2(amount);
  const paid = row.payment_status === "paid" ? amount : n(row.paid_amount);
  const hasProof = !!row.proof_file || !!row.proof_type;
  // سداد مُدّعى بدون إثبات لا يُستبعد تلقائياً
  if (!hasProof || !row.payment_date) return r2(amount);
  return r2(Math.max(0, amount - paid));
}

export function rowPaidAmount(row: UnpaidRow): number {
  const amount = n(row.amount);
  if (row.payment_status === "unpaid") return 0;
  return row.payment_status === "paid" ? amount : r2(Math.min(amount, n(row.paid_amount)));
}

export function rowStatusLabel(row: UnpaidRow): string {
  const remaining = rowRemaining(row);
  if (row.payment_status === "unpaid") return "غير مسدد";
  const hasProof = !!row.proof_file || !!row.proof_type;
  if (!hasProof || !row.payment_date) return "سداد بدون إثبات";
  if (remaining <= 0) return "مسدد (مستبعد)";
  return "سداد جزئي";
}

export type UnpaidAnalysis = {
  totalDue: number;
  totalPaidProven: number;
  totalRemaining: number;
  excludedCount: number;
  unprovenCount: number;
  currency: string;
  rows: {
    month: number | "";
    year: number | "";
    salary_type: string;
    amount: number;
    paid: number;
    remaining: number;
    status: string;
    excluded: boolean;
  }[];
  warnings: string[];
};

export function analyzeUnpaid(rows: UnpaidRow[], currency = "SAR"): UnpaidAnalysis {
  let totalDue = 0;
  let totalPaidProven = 0;
  let totalRemaining = 0;
  let excludedCount = 0;
  let unprovenCount = 0;
  const warnings: string[] = [];

  const detail = rows.map((row) => {
    const amount = n(row.amount);
    const remaining = rowRemaining(row);
    const hasProof = (!!row.proof_file || !!row.proof_type) && !!row.payment_date;
    const paidProven = hasProof ? Math.min(amount, rowPaidAmount(row)) : 0;
    const excluded = remaining <= 0 && row.payment_status !== "unpaid";

    totalDue += amount;
    totalPaidProven += paidProven;
    totalRemaining += remaining;
    if (excluded) excludedCount += 1;
    if (row.payment_status !== "unpaid" && !hasProof) unprovenCount += 1;

    return {
      month: row.month,
      year: row.year,
      salary_type: row.salary_type,
      amount: r2(amount),
      paid: r2(paidProven),
      remaining,
      status: rowStatusLabel(row),
      excluded,
    };
  });

  if (unprovenCount > 0) {
    warnings.push(
      "تم إدخال وجود سداد دون وجود إثبات، وقد يكون هذا محل نظر أمام الجهة القضائية.",
    );
  }

  // تحذير تكرار نفس الشهر
  const seen = new Map<string, number>();
  rows.forEach((row) => {
    if (row.month === "" || row.year === "") return;
    const key = `${row.year}-${row.month}-${row.salary_type}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  });
  for (const [key, count] of seen) {
    if (count > 1) {
      const [year, month] = key.split("-");
      warnings.push(`تكرار نفس الشهر: ${MONTHS[Number(month) - 1] ?? month} ${year}`);
    }
  }

  return {
    totalDue: r2(totalDue),
    totalPaidProven: r2(totalPaidProven),
    totalRemaining: r2(totalRemaining),
    excludedCount,
    unprovenCount,
    currency,
    rows: detail,
    warnings,
  };
}

export function validateUnpaid(
  rows: UnpaidRow[],
  opts: { currency: string; serviceStart?: string | null; serviceEnd?: string | null },
): string[] {
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  rows.forEach((row, i) => {
    const label = `السجل ${i + 1}`;
    if (n(row.amount) <= 0) errors.push(`${label}: قيمة المستحق يجب أن تكون أكبر من صفر.`);
    if (row.month === "" || row.year === "") errors.push(`${label}: يجب تحديد الشهر والسنة.`);
    if (row.due_date && row.due_date > today) errors.push(`${label}: لا يمكن إدخال تاريخ استحقاق مستقبلي.`);
    if (row.payment_date && row.payment_date > today) errors.push(`${label}: لا يمكن إدخال تاريخ سداد مستقبلي.`);
    if (row.currency && opts.currency && row.currency !== opts.currency) {
      errors.push(`${label}: العملة لا تتوافق مع عملة القضية (${opts.currency}).`);
    }
    if (row.payment_status === "partial") {
      const paid = n(row.paid_amount);
      if (paid <= 0) errors.push(`${label}: يجب إدخال القيمة المسددة في السداد الجزئي.`);
      if (paid > n(row.amount)) errors.push(`${label}: قيمة السداد أكبر من قيمة المستحق.`);
    }
    if (row.payment_status !== "unpaid" && !row.payment_date) {
      errors.push(`${label}: يجب إدخال تاريخ السداد.`);
    }
    if (row.payment_date) {
      if (opts.serviceStart && row.payment_date < opts.serviceStart) {
        errors.push(`${label}: تاريخ السداد قبل بداية مدة الخدمة.`);
      }
    }
  });

  return errors;
}
