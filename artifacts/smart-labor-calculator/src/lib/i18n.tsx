import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ar" | "en";

const STORAGE_KEY = "lang";
const FALLBACK: Lang = "ar";

/**
 * قاموس الترجمة — العربية هي المصدر والإنجليزية ترجمة كاملة.
 * القواعد: لا نص ثابت داخل المكوّنات، وكل مفتاح موجود في اللغتين.
 * الصيغ المدعومة: {{param}} للاستبدال، و key_one / key_other للجمع.
 */
const AR: Record<string, string> = {
  // التنقل
  "nav.home": "الرئيسية",
  "nav.calculator": "الحاسبة",
  "nav.subscribe": "الاشتراك",
  "nav.dashboard": "لوحة التحكم",
  "nav.calculations": "سجل الحسابات",
  "nav.mySubscription": "اشتراكي",
  "nav.referrals": "الإحالات",
  "nav.admin": "الإدارة",
  "nav.support": "الدعم الفني",
  "nav.privacy": "الخصوصية",

  "nav.terms": "شروط الاستخدام",
  "nav.disclaimer": "إخلاء المسؤولية",
  "nav.login": "تسجيل الدخول",
  "nav.logout": "تسجيل الخروج",
  "nav.verify": "التحقق",
  "nav.selectCountry": "اختيار الدولة",

  // عام
  "common.whatsapp": "واتساب",
  "common.language": "English",
  "common.retry": "إعادة المحاولة",
  "common.loading": "جارٍ التحميل…",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.delete": "حذف",
  "common.edit": "تعديل",
  "common.close": "إغلاق",
  "common.back": "رجوع",
  "common.next": "التالي",
  "common.current": "الحالية",
  "common.phone": "هاتف",

  // الهوية
  "brand.name": "حاسبة العمال الذكية",
  "brand.nameLatin": "SMART LABOR CALCULATOR",
  "brand.tagline": "السعودية واليمن",
  "brand.logoAlt": "شعار حاسبة العمال الذكية",

  // الصفحة الرئيسية
  "home.meta.title": "حاسبة العمال الذكية — نظام العمل السعودي وقانون العمل اليمني",
  "home.meta.description":
    "حاسبة العمال الذكية: حساب الحقوق العمالية وإصدار التقارير القانونية وفق نظام العمل السعودي وقانون العمل اليمني، لخدمة الموظفين وأصحاب العمل.",
  "home.hero.badge": "منصة قانونية موثوقة • السعودية واليمن",
  "home.hero.titleSub": "نظام العمل السعودي وقانون العمل اليمني.",
  "home.hero.desc":
    "منصة متخصصة في حساب الحقوق العمالية وإصدار التقارير القانونية وفق نظام العمل في المملكة العربية السعودية وقانون العمل في الجمهورية اليمنية — لخدمة الموظفين وأصحاب العمل على حدٍّ سواء.",
  "home.hero.cta": "ابدأ الحساب الآن",
  "home.hero.pricingNote":
    "ابدأ الآن: أنشئ حسابك، اختر دولتك، واحصل على تقرير قانوني موثّق لحقوقك العمالية.",
  "home.trust.systems": "نظامان",
  "home.trust.systemsV": "السعودية 🇸🇦 واليمن 🇾🇪",
  "home.trust.refs": "مراجع نظامية",
  "home.trust.refsV": "لكل بند مادة قانونية",
  "home.trust.report": "تقرير موثّق",
  "home.trust.reportV": "رقم تسلسلي وبصمة تحقق",
  "home.trust.offline": "يعمل أوفلاين",
  "home.trust.offlineV": "تطبيق قابل للتثبيت",
  "home.features.title": "لماذا هذه المنصة؟",
  "home.features.calc.title": "حسابات دقيقة",
  "home.features.calc.desc":
    "مكافأة نهاية الخدمة، الإضافي النهاري والليلي، وبدل الإجازات وفق نصوص القانون المعمول به في الدولة المختارة.",
  "home.features.report.title": "تقرير قانوني احترافي",
  "home.features.report.desc":
    "تقرير يحوي رقماً تعريفياً وبصمة تحقق ومراجع نظامية وتوقيت إصدار.",
  "home.features.pwa.title": "يعمل كتطبيق هاتف",
  "home.features.pwa.desc":
    "ثبّت المنصة على هاتفك واستخدمها بالكامل حتى دون اتصال بالإنترنت.",
  "home.calc.badge": "الحاسبة الرسمية — تتطلب حساباً",
  "home.calc.title": "احسب حقوقك خطوة بخطوة",
  "home.calc.descSA":
    "مبنية على نظام العمل السعودي ولائحته التنفيذية — حسبة تجريبية مجانية واحدة، ثم اشتراك للوصول الكامل.",
  "home.calc.descYE":
    "مبنية على قانون العمل اليمني رقم 5 لسنة 1995 — الدفع المسبق مطلوب للوصول الكامل.",
  "home.calc.descGeneric":
    "اختر الدولة ثم أكمل الخطوات القانونية للحصول على تقرير حقوق كامل مع مراجعه النظامية.",
  "home.calc.subscribe": "اشترك الآن",
  "home.calc.open": "فتح الحاسبة",
  "home.calc.useTrial": "استخدم الحساب التجريبي المجاني",
  "home.calc.createAccount": "أنشئ حساباً وابدأ مجاناً",
  "home.verify.badge": "صفحة عامة • لا تتطلب تسجيل دخول",
  "home.verify.title": "التحقق من صحة الملفات",
  "home.verify.desc":
    "لأصحاب العمل والمحاكم: أدخل الرقم التسلسلي الظاهر في تقرير PDF للتأكد من صدوره عن المنصة وعدم التلاعب به.",
  "home.verify.label": "رقم الملف التسلسلي",
  "home.verify.submit": "تحقّق من الملف",
  "home.verify.full": "فتح صفحة التحقق الكاملة",
  "home.cta.title": "ابدأ خلال أقل من دقيقة",
  "home.cta.desc":
    "سجّل الدخول ثم اختر الدولة: 🇸🇦 المملكة العربية السعودية أو 🇾🇪 الجمهورية اليمنية.",
  "home.cta.button": "اختر الدولة وابدأ",
  "home.footer.rights": "© {{year}} حاسبة العمال الذكية — جميع الحقوق محفوظة.",
  "home.footer.logoAlt": "شعار المنصة",

  // اختيار الدولة
  "country.meta.title": "اختر الدولة • حاسبة العمال الذكية",
  "country.meta.description":
    "اختر نظام الحقوق العمالية المطلوب: المملكة العربية السعودية أو الجمهورية اليمنية.",
  "country.badge": "اختيار النظام القانوني",
  "country.title": "اختر الدولة",
  "country.desc":
    "لكل دولة محرك حسابي مستقل تماماً بمعادلاته ومراجعه النظامية الخاصة، وسيتم تحميل بيانات الدولة المختارة فقط.",
  "country.loadError": "تعذّر تحميل قائمة الدول",
  "country.empty": "لا توجد دول مفعّلة حالياً",
  "country.emptyDesc": "تتم إضافة الدول وتفعيلها من لوحة التحكم.",
  "country.open": "فتح الحاسبة",

  // التذييل والاتصال
  "footer.builtBy": "تم تصميم وتطوير الموقع بواسطة",
  "footer.company": "شركة أوسكار للبرمجيات والحلول الذكية",
  "footer.companyLogoAlt": "شعار أوسكار",

  // الأخطاء
  "error.notFound.title": "الصفحة غير موجودة",
  "error.notFound.desc": "الرابط الذي تبحث عنه غير متاح.",
  "error.notFound.home": "العودة للرئيسية",
  "error.unexpected.title": "حدث خطأ غير متوقع",
  "error.unexpected.desc": "حاول مجدداً أو عُد إلى الرئيسية.",
};

const EN: Record<string, string> = {
  "nav.home": "Home",
  "nav.calculator": "Calculator",
  "nav.subscribe": "Subscription",
  "nav.dashboard": "Dashboard",
  "nav.calculations": "History",
  "nav.mySubscription": "My plan",
  "nav.referrals": "Referrals",
  "nav.admin": "Admin",
  "nav.support": "Technical support",
  "nav.privacy": "Privacy",

  "nav.terms": "Terms of use",
  "nav.disclaimer": "Disclaimer",
  "nav.login": "Sign in",
  "nav.logout": "Sign out",
  "nav.verify": "Verify",
  "nav.selectCountry": "Choose country",

  "common.whatsapp": "WhatsApp",
  "common.language": "العربية",
  "common.retry": "Try again",
  "common.loading": "Loading…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.close": "Close",
  "common.back": "Back",
  "common.next": "Next",
  "common.current": "Current",
  "common.phone": "Phone",

  "brand.name": "Smart Labor Calculator",
  "brand.nameLatin": "SMART LABOR CALCULATOR",
  "brand.tagline": "Saudi Arabia & Yemen",
  "brand.logoAlt": "Smart Labor Calculator logo",

  "home.meta.title": "Smart Labor Calculator — Saudi & Yemeni Labor Law",
  "home.meta.description":
    "Smart Labor Calculator: compute employee entitlements and issue legal reports under Saudi and Yemeni labor law, for both employees and employers.",
  "home.hero.badge": "Trusted legal platform • Saudi Arabia & Yemen",
  "home.hero.titleSub": "Saudi and Yemeni labor law.",
  "home.hero.desc":
    "A specialised platform for calculating labor entitlements and issuing legal reports under the labor law of the Kingdom of Saudi Arabia and the Republic of Yemen — serving employees and employers alike.",
  "home.hero.cta": "Start calculating",
  "home.hero.pricingNote":
    "Get started: create your account, choose your country, and receive a verified legal report of your labor entitlements.",
  "home.trust.systems": "Two systems",
  "home.trust.systemsV": "Saudi Arabia 🇸🇦 & Yemen 🇾🇪",
  "home.trust.refs": "Statutory references",
  "home.trust.refsV": "A legal article for every item",
  "home.trust.report": "Verified report",
  "home.trust.reportV": "Serial number and verification stamp",
  "home.trust.offline": "Works offline",
  "home.trust.offlineV": "Installable application",
  "home.features.title": "Why this platform?",
  "home.features.calc.title": "Accurate calculations",
  "home.features.calc.desc":
    "End-of-service award, day and night overtime, and leave allowances according to the law in force in the selected country.",
  "home.features.report.title": "Professional legal report",
  "home.features.report.desc":
    "A report with an identifier, verification stamp, statutory references and issue timestamp.",
  "home.features.pwa.title": "Works like a mobile app",
  "home.features.pwa.desc":
    "Install the platform on your phone and use it fully, even without an internet connection.",
  "home.calc.badge": "Official calculator — account required",
  "home.calc.title": "Calculate your entitlements step by step",
  "home.calc.descSA":
    "Built on the Saudi Labor Law and its implementing regulations — one free trial calculation, then a subscription for full access.",
  "home.calc.descYE":
    "Built on Yemeni Labor Law No. 5 of 1995 — prepayment is required for full access.",
  "home.calc.descGeneric":
    "Choose your country, then complete the legal steps to obtain a full entitlements report with its statutory references.",
  "home.calc.subscribe": "Subscribe now",
  "home.calc.open": "Open the calculator",
  "home.calc.useTrial": "Use the free trial calculation",
  "home.calc.createAccount": "Create an account and start free",
  "home.verify.badge": "Public page • no sign-in required",
  "home.verify.title": "Verify a document",
  "home.verify.desc":
    "For employers and courts: enter the serial number printed on the PDF report to confirm it was issued by this platform and has not been altered.",
  "home.verify.label": "Document serial number",
  "home.verify.submit": "Verify document",
  "home.verify.full": "Open the full verification page",
  "home.cta.title": "Get started in under a minute",
  "home.cta.desc":
    "Sign in, then choose your country: 🇸🇦 Kingdom of Saudi Arabia or 🇾🇪 Republic of Yemen.",
  "home.cta.button": "Choose a country and start",
  "home.footer.rights": "© {{year}} Smart Labor Calculator — All rights reserved.",
  "home.footer.logoAlt": "Platform logo",

  "country.meta.title": "Choose a country • Smart Labor Calculator",
  "country.meta.description":
    "Choose the labor rights system you need: Kingdom of Saudi Arabia or Republic of Yemen.",
  "country.badge": "Select the legal system",
  "country.title": "Choose a country",
  "country.desc":
    "Each country has a fully independent calculation engine with its own formulas and statutory references; only the selected country's data is loaded.",
  "country.loadError": "Could not load the country list",
  "country.empty": "No countries are enabled yet",
  "country.emptyDesc": "Countries are added and enabled from the admin dashboard.",
  "country.open": "Open the calculator",

  "footer.builtBy": "Designed and developed by",
  "footer.company": "Oskar Software & Smart Solutions",
  "footer.companyLogoAlt": "Oskar logo",

  "error.notFound.title": "Page not found",
  "error.notFound.desc": "The link you are looking for is not available.",
  "error.notFound.home": "Back to home",
  "error.unexpected.title": "Something went wrong",
  "error.unexpected.desc": "Try again or return to the home page.",
};

const DICTS: Record<Lang, Record<string, string>> = { ar: AR, en: EN };

export type TParams = Record<string, string | number>;

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) =>
    params[k] === undefined ? `{{${k}}}` : String(params[k]),
  );
}

function lookup(lang: Lang, key: string): string | undefined {
  return DICTS[lang][key] ?? (lang === FALLBACK ? undefined : DICTS[FALLBACK][key]);
}

export function translate(lang: Lang, key: string, params?: TParams): string {
  // الجمع: count => key_one / key_other ثم المفتاح الأساسي
  if (params && typeof params.count === "number") {
    const suffix = params.count === 1 ? "_one" : "_other";
    const plural = lookup(lang, key + suffix);
    if (plural) return interpolate(plural, params);
  }
  const raw = lookup(lang, key);
  if (raw === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key "${key}" (${lang})`);
    return key;
  }
  return interpolate(raw, params);
}

type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  locale: string;
  t: (key: string, params?: TParams) => string;
  /** يختار الحقل العربي أو الإنجليزي من صفوف قاعدة البيانات */
  pick: (ar: string | null | undefined, en: string | null | undefined) => string;
  formatNumber: (n: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (n: number, currency: string) => string;
  formatDate: (d: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LOCALES: Record<Lang, string> = { ar: "ar-SA", en: "en-US" };

function buildValue(lang: Lang, setLangState: (l: Lang) => void): Ctx {
  const locale = LOCALES[lang];
  return {
    lang,
    locale,
    dir: lang === "en" ? "ltr" : "rtl",
    t: (key, params) => translate(lang, key, params),
    pick: (ar, en) => (lang === "en" ? (en || ar || "") : (ar || en || "")),
    // الأرقام لاتينية في اللغتين لتوافق التقارير و PDF
    formatNumber: (n, options) => new Intl.NumberFormat("en-US", options).format(n),
    formatCurrency: (n, currency) =>
      `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)} ${currency}`,
    formatDate: (d, options) =>
      new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-SA-u-ca-gregory-nu-latn", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        ...options,
      }).format(new Date(d)),
    setLang: setLangState,
    toggle: () => setLangState(lang === "ar" ? "en" : "ar"),
  };
}

const I18nContext = createContext<Ctx>(buildValue(FALLBACK, () => {}));

export const LANG_INIT = `(function(){try{var l=localStorage.getItem('lang')==='en'?'en':'ar';var e=document.documentElement;e.lang=l;e.dir=l==='en'?'ltr':'rtl';}catch(e){}})();`;

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(FALLBACK);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "en") setLangState("en");
    } catch {
      /* تجاهل */
    }
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "en" ? "ltr" : "rtl";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* تجاهل */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const value = useMemo<Ctx>(() => buildValue(lang, setLang), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
