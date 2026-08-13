/**
 * التحقق الصارم من ملفات إيصالات التحويل قبل رفعها.
 * يمنع الملفات غير المسموحة ويقيّد الحجم والامتداد.
 */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export const RECEIPT_ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const RECEIPT_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

export type ReceiptCheck =
  | { ok: true; ext: string; contentType: string }
  | { ok: false; error: string };

export function validateReceiptFile(file: File): ReceiptCheck {
  if (file.size === 0) return { ok: false, error: "الملف فارغ أو تالف." };
  if (file.size > RECEIPT_MAX_BYTES) {
    return { ok: false, error: "حجم الملف يتجاوز 5 ميجابايت. اضغط الصورة ثم أعد المحاولة." };
  }

  const type = (file.type || "").toLowerCase();
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, error: "امتداد غير مسموح. المسموح: JPG أو PNG أو WEBP أو PDF فقط." };
  }
  if (!RECEIPT_ALLOWED_TYPES[type]) {
    return { ok: false, error: "نوع الملف غير مسموح. المسموح: صور JPG/PNG/WEBP أو ملف PDF." };
  }
  // منع تعارض الامتداد مع نوع الملف الحقيقي (مثل ملف تنفيذي بامتداد صورة).
  const expected = RECEIPT_ALLOWED_TYPES[type];
  const normalized = ext === "jpeg" ? "jpg" : ext;
  if (expected !== normalized) {
    return { ok: false, error: "امتداد الملف لا يطابق محتواه الفعلي." };
  }

  return { ok: true, ext: normalized, contentType: type };
}

/** مسار تخزين آمن داخل مجلد المستخدم فقط. */
export function receiptStoragePath(userId: string, ext: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${userId}/${Date.now()}-${rand}.${ext}`;
}
