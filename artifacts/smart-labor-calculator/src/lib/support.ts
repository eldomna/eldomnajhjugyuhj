// بيانات التواصل الرسمية — المصدر الوحيد، وتُعرض فقط في صفحة الدعم الفني.
export const SUPPORT_EMAIL = "smartlaborcalculator@gmail.com";

export interface SupportChannel {
  /** رقم الاتصال بالصيغة الدولية. */
  phone: string;
  /** نفس الرقم بدون رموز لاستخدامه في رابط واتساب. */
  whatsapp: string;
  /** صيغة العرض المقروءة. */
  display: string;
  labelAr: string;
  labelEn: string;
  noteAr: string;
  noteEn: string;
}

export const SUPPORT_CHANNELS: SupportChannel[] = [
  {
    phone: "+966542152395",
    whatsapp: "966542152395",
    display: "+966 54 215 2395",
    labelAr: "الدعم في السعودية",
    labelEn: "Support — Saudi Arabia",
    noteAr: "اتصال أو واتساب — للاستفسارات المتعلقة بنظام العمل السعودي.",
    noteEn: "Call or WhatsApp — for Saudi labour law enquiries.",
  },
  {
    phone: "+967730762713",
    whatsapp: "967730762713",
    display: "+967 730 762 713",
    labelAr: "الدعم في اليمن",
    labelEn: "Support — Yemen",
    noteAr: "اتصال أو واتساب — للاستفسارات المتعلقة بقانون العمل اليمني.",
    noteEn: "Call or WhatsApp — for Yemeni labour law enquiries.",
  },
];
