// بيانات التواصل الرسمية — المصدر الوحيد، وتُعرض فقط في صفحة الدعم الفني.
// الدعم الفني عبر البريد الإلكتروني فقط (لا أرقام هواتف معروضة).
export const SUPPORT_EMAIL = "support@laborcalculator.app";

export interface SupportChannel {
  phone: string;
  whatsapp: string;
  display: string;
  labelAr: string;
  labelEn: string;
  noteAr: string;
  noteEn: string;
}

// لا قنوات هاتف/واتساب حالياً — الدعم عبر البريد الإلكتروني فقط.
export const SUPPORT_CHANNELS: SupportChannel[] = [];
