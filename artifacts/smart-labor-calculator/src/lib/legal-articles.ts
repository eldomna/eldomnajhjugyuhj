/**
 * Internal legal-reference database.
 *
 * Ships with the app bundle (no network) so the full legal report works
 * completely offline. Each entry carries the law identity, the article text
 * and a plain-language interpretation, plus the calculator rights it backs.
 */

export type RightKey =
  | "eos"
  | "day_overtime"
  | "night_overtime"
  | "friday"
  | "holiday"
  | "notice"
  | "annual_leave"
  | "sick_leave"
  | "working_hours"
  | "female_protection"
  | "female_hours"
  | "female_overtime"
  | "maternity"
  | "unfair_dismissal"
  | "limitation";

export interface LegalArticle {
  /** Human name of the right this article backs. */
  right: string;
  law_name: string;
  law_number: string;
  law_year: number;
  article_number: string;
  /** Article text (summarised statutory wording). */
  text: string;
  /** Plain-language interpretation for non-lawyers. */
  interpretation: string;
  /** Related calculator rights. */
  related: RightKey[];
}

const LAW = {
  law_name: "قانون العمل اليمني",
  law_number: "5",
  law_year: 1995,
} as const;

export const LEGAL_ARTICLES: Record<RightKey, LegalArticle> = {
  female_protection: {
    ...LAW,
    right: "حماية المرأة العاملة",
    article_number: "42",
    text:
      "تسري على المرأة العاملة جميع الأحكام المنظمة لتشغيل العمال دون تمييز بينها وبين الرجل في العمل المتماثل، وتتمتع بالحماية المقررة قانوناً.",
    interpretation:
      "تم تطبيق أحكام حماية ومساواة المرأة العاملة وفق قانون العمل اليمني: المرأة تتقاضى الأجر نفسه عن العمل المتماثل وتستفيد من الحمايات الخاصة بها.",
    related: ["female_protection"],
  },
  female_hours: {
    ...LAW,
    right: "ساعات عمل المرأة الحامل والمرضعة",
    article_number: "43",
    text:
      "لا يجوز تشغيل المرأة الحامل اعتباراً من الشهر السادس للحمل وحتى ستة أشهر بعد الوضع أكثر من خمس ساعات عمل يومياً.",
    interpretation:
      "من بداية الشهر السادس للحمل وحتى ستة أشهر بعد الولادة يكون الحد الأقصى لساعات العمل خمس ساعات يومياً، وما زاد عن ذلك يُعد عملاً خارج الحد القانوني ويستوجب المقابل.",
    related: ["female_hours"],
  },
  female_overtime: {
    ...LAW,
    right: "تشغيل المرأة ساعات إضافية",
    article_number: "44",
    text:
      "لا يجوز تشغيل المرأة الحامل أو المرضع ساعات عمل إضافية خلال فترة الحماية المقررة قانوناً.",
    interpretation:
      "تشغيل العاملة ساعات إضافية خلال فترة الحمل والرضاعة محظور قانوناً؛ وفي حال وقوع عمل فعلي زائد يُحتسب مقابله المالي بنسبة 150% من أجر الساعة.",
    related: ["female_overtime", "female_hours"],
  },
  maternity: {
    ...LAW,
    right: "إجازة الوضع",
    article_number: "45",
    text:
      "للمرأة العاملة الحق في إجازة وضع بأجر كامل مدتها ستون يوماً، وتُمدد إلى ثمانين يوماً في حالات الولادة المتعسرة أو ولادة التوأم.",
    interpretation:
      "إجازة الوضع مدفوعة الأجر بالكامل: 60 يوماً في الولادة الطبيعية و80 يوماً في الولادة المتعسرة أو التوأم؛ وإذا لم تُمنح أو مُنحت بدون أجر تُحتسب قيمتها ضمن المستحقات.",
    related: ["maternity"],
  },
  working_hours: {
    ...LAW,
    right: "ساعات العمل",
    article_number: "71",
    text:
      "لا يجوز أن تزيد ساعات العمل الفعلية على ثماني ساعات يومياً أو ثمان وأربعين ساعة أسبوعياً، وتُخفَّض بمقدار ساعتين يومياً خلال شهر رمضان للعمال المسلمين.",
    interpretation:
      "ساعات العمل الأساسية ثماني ساعات يومياً، وتصبح ست ساعات خلال شهر رمضان؛ وأي عمل يتجاوز ذلك يُحتسب عملاً إضافياً.",
    related: ["working_hours"],
  },
  day_overtime: {
    ...LAW,
    right: "العمل الإضافي النهاري",
    article_number: "56",
    text:
      "يستحق العامل عن ساعات العمل الإضافية أجراً إضافياً لا يقل عن 50% من أجره العادي، ويُضاعف الأجر عن العمل في الليل أو في أيام الراحة والإجازات الرسمية.",
    interpretation:
      "الساعة الإضافية النهارية تُحتسب بنسبة 150% من أجر الساعة العادي.",
    related: ["day_overtime"],
  },
  night_overtime: {
    ...LAW,
    right: "العمل الإضافي الليلي",
    article_number: "56",
    text:
      "يستحق العامل عن ساعات العمل الإضافية أجراً إضافياً لا يقل عن 50% من أجره العادي، ويُضاعف الأجر عن العمل في الليل أو في أيام الراحة والإجازات الرسمية.",
    interpretation:
      "العمل الليلي (من الساعة 20:00 حتى 05:00) وأيام الراحة والإجازات الرسمية تُحتسب بنسبة 200%؛ ولا تُجمع النسب عند التداخل بل تُطبَّق الأعلى.",
    related: ["night_overtime", "friday", "holiday"],
  },
  friday: {
    ...LAW,
    right: "العمل في يوم الراحة الأسبوعية",
    article_number: "56",
    text:
      "يُضاعف أجر العامل عن العمل في يوم الراحة الأسبوعية أو في الإجازات الرسمية.",
    interpretation:
      "العمل يوم الجمعة (الراحة الأسبوعية في القطاع الخاص) يُحتسب بنسبة 200% من الأجر.",
    related: ["friday"],
  },
  holiday: {
    ...LAW,
    right: "العمل في الإجازات الرسمية",
    article_number: "56",
    text:
      "يُضاعف أجر العامل عن العمل في يوم الراحة الأسبوعية أو في الإجازات الرسمية.",
    interpretation:
      "كل يوم عمل في إجازة رسمية يُحتسب بنسبة 200% من الأجر اليومي، ويُعوَّض تداخل الإجازة مع يوم الراحة الأسبوعية.",
    related: ["holiday"],
  },
  annual_leave: {
    ...LAW,
    right: "الإجازة السنوية",
    article_number: "79",
    text:
      "للعامل الحق في إجازة سنوية بأجر كامل لا تقل عن ثلاثين يوماً عن كل سنة خدمة، ويستحق مقابلاً نقدياً عن رصيد الإجازة الذي لم يحصل عليه عند انتهاء الخدمة.",
    interpretation:
      "يستحق العامل 30 يوم إجازة سنوية مدفوعة عن كل سنة خدمة؛ وما لم يُمنح منها يُصرف نقداً على أساس الأجر اليومي.",
    related: ["annual_leave"],
  },
  sick_leave: {
    ...LAW,
    right: "الإجازة المرضية",
    article_number: "80",
    text:
      "للعامل الحق في إجازة مرضية بشهادة طبية معتمدة خلال السنة الواحدة: الستون يوماً الأولى بأجر كامل، والستون التالية بنسبة 85%، ثم الستون التالية بنسبة 75%، ثم الستون التالية بنسبة 50%، وما زاد على ذلك بدون أجر.",
    interpretation:
      "يُدفع أجر الإجازة المرضية بشرائح متدرجة خلال السنة: 100% ثم 85% ثم 75% ثم 50%، وما زاد عن 240 يوماً يكون بدون أجر.",
    related: ["sick_leave"],
  },
  notice: {
    ...LAW,
    right: "بدل الإنذار",
    article_number: "35",
    text:
      "لا يجوز إنهاء عقد العمل غير محدد المدة إلا بإخطار كتابي قبل شهر على الأقل، وإلا التزم الطرف المنهي بأداء أجر مدة الإخطار.",
    interpretation:
      "إذا أنهى صاحب العمل العقد دون إخطار مسبق بشهر، يستحق العامل أجر شهر كامل كبدل إنذار.",
    related: ["notice"],
  },
  eos: {
    ...LAW,
    right: "مكافأة نهاية الخدمة",
    article_number: "120",
    text:
      "يستحق العامل عند انتهاء خدمته مكافأة نهاية خدمة تعادل أجر شهر عن كل سنة من سنوات الخدمة، وتُحسب على أساس آخر أجر تقاضاه، ويستحق عن كسور السنة بنسبتها.",
    interpretation:
      "مكافأة نهاية الخدمة = آخر راتب شهري × عدد سنوات الخدمة (بما فيها كسور السنة بالتناسب).",
    related: ["eos"],
  },
  unfair_dismissal: {
    ...LAW,
    right: "الفصل التعسفي",
    article_number: "39",
    text:
      "إذا كان إنهاء عقد العمل تعسفياً، استحق العامل تعويضاً تقدره المحكمة بما لا يجاوز أجر ستة أشهر، فضلاً عن مستحقاته القانونية الأخرى.",
    interpretation:
      "تعويض الفصل التعسفي تقدّره المحكمة ولا يتجاوز أجر ستة أشهر؛ وهو تقدير قضائي لا يدخل ضمن المستحقات المضمونة.",
    related: ["unfair_dismissal"],
  },
  limitation: {
    ...LAW,
    right: "تقادم الدعوى العمالية",
    article_number: "149",
    text:
      "لا تُسمع الدعاوى الناشئة عن عقد العمل بعد مضي سنة من تاريخ انتهاء علاقة العمل.",
    interpretation:
      "تبدأ مدة التقادم بعد انتهاء علاقة العمل وتستمر سنة ميلادية كاملة؛ وبعد انقضائها لا تُسمع الدعوى.",
    related: ["limitation"],
  },
};

export function legalArticle(key: RightKey): LegalArticle {
  return LEGAL_ARTICLES[key];
}

/** "قانون العمل اليمني رقم (5) لسنة 1995م — المادة (80)" */
export function legalCitation(key: RightKey): string {
  const a = LEGAL_ARTICLES[key];
  return `${a.law_name} رقم (${a.law_number}) لسنة ${a.law_year}م — المادة (${a.article_number})`;
}
