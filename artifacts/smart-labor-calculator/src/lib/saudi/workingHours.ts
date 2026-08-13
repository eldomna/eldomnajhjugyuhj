// الخطوة 5: تحليل ساعات العمل والساعات الإضافية والعمل في أيام الراحة والإجازات الرسمية.
// جميع القيم المالية تُحتسب تلقائياً من أجر الساعة المحسوب في الخطوة 4 (لا يُدخله المستخدم).

export const OVERTIME_MULTIPLIER = 1.5;

export type ShiftType = "morning" | "evening" | "shifts" | "flexible" | "mixed";

export const SHIFT_TYPES: { value: ShiftType; label: string }[] = [
  { value: "morning", label: "صباحي" },
  { value: "evening", label: "مسائي" },
  { value: "shifts", label: "مناوبات" },
  { value: "flexible", label: "مرن" },
  { value: "mixed", label: "مختلط" },
];

export type OvertimeMode = "total" | "monthly" | "periods";

export const OVERTIME_MODES: { value: OvertimeMode; label: string; hint: string }[] = [
  { value: "total", label: "إجمالي عدد الساعات", hint: "إدخال رقم واحد لإجمالي الساعات الإضافية" },
  { value: "monthly", label: "حسب كل شهر", hint: "سطر لكل شهر مع عدد ساعاته" },
  { value: "periods", label: "حسب فترة محددة", hint: "عدد غير محدود من الفترات (من تاريخ إلى تاريخ)" },
];

export type WorkingHoursSettings = {
  daily_hours: number;
  weekly_days: number;
  shift_type: ShiftType;
  fingerprint_system: boolean;
  attendance_system: boolean;
  has_overtime: boolean;
  overtime_entry_mode: OvertimeMode;
  overtime_total_hours: number;
  has_weekend_work: boolean;
  has_holiday_work: boolean;
};

export const defaultSettings: WorkingHoursSettings = {
  daily_hours: 8,
  weekly_days: 6,
  shift_type: "morning",
  fingerprint_system: false,
  attendance_system: false,
  has_overtime: false,
  overtime_entry_mode: "total",
  overtime_total_hours: 0,
  has_weekend_work: false,
  has_holiday_work: false,
};

export type OvertimeRow = {
  id?: string;
  start_date: string;
  end_date: string;
  period_label: string;
  hours: number | string;
  reason: string;
  notes: string;
};

export type WeekendRow = {
  id?: string;
  start_date: string;
  end_date: string;
  days: number | string;
  hours: number | string;
  notes: string;
};

export type HolidayRow = {
  id?: string;
  holiday_name: string;
  holiday_date: string;
  end_date: string;
  days: number | string;
  hours: number | string;
  compensated: boolean;
  notes: string;
};

export const emptyOvertime = (): OvertimeRow => ({
  start_date: "",
  end_date: "",
  period_label: "",
  hours: "",
  reason: "",
  notes: "",
});

export const emptyWeekend = (): WeekendRow => ({
  start_date: "",
  end_date: "",
  days: "",
  hours: "",
  notes: "",
});

export const emptyHoliday = (): HolidayRow => ({
  holiday_name: "",
  holiday_date: "",
  end_date: "",
  days: "",
  hours: "",
  compensated: false,
  notes: "",
});

const num = (v: number | string | null | undefined) => {
  const n = Number(String(v ?? "").trim() || 0);
  return Number.isFinite(n) ? n : NaN;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const DAY = 86400000;

const days = (a: string, b: string) =>
  !a || !b ? 0 : Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY) + 1;

const overlaps = (a1: string, a2: string, b1: string, b2: string) => {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return new Date(a1) <= new Date(b2) && new Date(b1) <= new Date(a2);
};

const keyOf = (r: { start_date?: string; end_date?: string; hours?: number | string }) =>
  `${r.start_date ?? ""}|${r.end_date ?? ""}|${num(r.hours) || 0}`;

/** إزالة التكرار الكامل (نفس التواريخ ونفس الساعات) */
export function dedupe<T extends { start_date?: string; end_date?: string; hours?: number | string }>(
  rows: T[],
): { rows: T[]; removed: number } {
  const seen = new Set<string>();
  const out: T[] = [];
  rows.forEach((r) => {
    const k = keyOf(r);
    if (k !== "||0" && seen.has(k)) return;
    seen.add(k);
    out.push(r);
  });
  return { rows: out, removed: rows.length - out.length };
}

export type Analysis = {
  overtime: { hours: number; days: number; avgPerDay: number; amount: number; hourlyRate: number };
  weekend: { days: number; hours: number; amount: number };
  holiday: { count: number; days: number; hours: number; compensatedDays: number; amount: number };
  totalAmount: number;
  duplicatesRemoved: number;
  conflicts: string[];
};

export function analyzeWorkingHours(args: {
  settings: WorkingHoursSettings;
  overtime: OvertimeRow[];
  weekend: WeekendRow[];
  holiday: HolidayRow[];
  hourlyRate: number;
}): Analysis {
  const { settings, hourlyRate } = args;
  const rate = Number.isFinite(hourlyRate) ? hourlyRate : 0;
  const dailyHours = num(settings.daily_hours) || 8;
  const conflicts: string[] = [];

  const ot = dedupe(args.overtime);
  const wk = dedupe(args.weekend.map((r) => ({ ...r })));
  const hd = dedupe(
    args.holiday.map((r) => ({ ...r, start_date: r.holiday_date, end_date: r.end_date || r.holiday_date })),
  );
  const duplicatesRemoved = ot.removed + wk.removed + hd.removed;

  // تعارض الفترات داخل كل قسم
  const checkOverlap = (rows: { start_date?: string; end_date?: string }[], label: string) => {
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        if (overlaps(rows[i].start_date ?? "", rows[i].end_date ?? "", rows[j].start_date ?? "", rows[j].end_date ?? "")) {
          conflicts.push(`${label}: تداخل بين الفترة ${i + 1} والفترة ${j + 1}`);
        }
      }
    }
  };
  if (settings.overtime_entry_mode !== "total") checkOverlap(ot.rows, "الساعات الإضافية");
  checkOverlap(wk.rows, "أيام الراحة");
  checkOverlap(hd.rows, "الإجازات الرسمية");

  // تكرار نفس اليوم في الإجازات الرسمية
  const holidayDates = new Set<string>();
  hd.rows.forEach((r) => {
    if (!r.holiday_date) return;
    if (holidayDates.has(r.holiday_date)) conflicts.push(`الإجازات الرسمية: تكرار نفس التاريخ ${r.holiday_date}`);
    holidayDates.add(r.holiday_date);
  });

  // الساعات الإضافية
  let otHours = 0;
  let otDays = 0;
  if (settings.has_overtime) {
    if (settings.overtime_entry_mode === "total") {
      otHours = num(settings.overtime_total_hours) || 0;
      otDays = dailyHours > 0 ? otHours / dailyHours : 0;
    } else {
      ot.rows.forEach((r) => {
        otHours += num(r.hours) || 0;
        otDays += days(r.start_date, r.end_date);
      });
    }
  }
  const otAmount = otHours * rate * OVERTIME_MULTIPLIER;

  // أيام الراحة الأسبوعية
  let wkDays = 0;
  let wkHours = 0;
  if (settings.has_weekend_work) {
    wk.rows.forEach((r) => {
      const d = num(r.days) || days(r.start_date, r.end_date);
      wkDays += d;
      wkHours += num(r.hours) || d * dailyHours;
    });
  }
  const wkAmount = wkHours * rate * OVERTIME_MULTIPLIER;

  // الإجازات الرسمية
  let hdDays = 0;
  let hdHours = 0;
  let hdCompensated = 0;
  let hdAmount = 0;
  if (settings.has_holiday_work) {
    hd.rows.forEach((r) => {
      const d = num(r.days) || days(r.holiday_date, r.end_date || r.holiday_date) || 1;
      const h = num(r.hours) || d * dailyHours;
      hdDays += d;
      hdHours += h;
      if (r.compensated) hdCompensated += d;
      else hdAmount += h * rate * OVERTIME_MULTIPLIER;
    });
  }

  const total = otAmount + wkAmount + hdAmount;
  return {
    overtime: {
      hours: r2(otHours),
      days: r2(otDays),
      avgPerDay: r2(otDays > 0 ? otHours / otDays : 0),
      amount: r2(otAmount),
      hourlyRate: r2(rate),
    },
    weekend: { days: r2(wkDays), hours: r2(wkHours), amount: r2(wkAmount) },
    holiday: {
      count: hd.rows.length,
      days: r2(hdDays),
      hours: r2(hdHours),
      compensatedDays: r2(hdCompensated),
      amount: r2(hdAmount),
    },
    totalAmount: r2(total),
    duplicatesRemoved,
    conflicts,
  };
}

export function validateWorkingHours(args: {
  settings: WorkingHoursSettings;
  overtime: OvertimeRow[];
  weekend: WeekendRow[];
  holiday: HolidayRow[];
}): string[] {
  const errors: string[] = [];
  const { settings } = args;

  const dh = num(settings.daily_hours);
  if (!Number.isFinite(dh) || dh <= 0 || dh > 24) errors.push("عدد ساعات العمل اليومية يجب أن يكون بين 1 و 24");
  const wd = num(settings.weekly_days);
  if (!Number.isFinite(wd) || wd <= 0 || wd > 7) errors.push("عدد أيام العمل الأسبوعية يجب أن يكون بين 1 و 7");

  if (settings.has_overtime) {
    if (settings.overtime_entry_mode === "total") {
      const h = num(settings.overtime_total_hours);
      if (!Number.isFinite(h) || h < 0) errors.push("إجمالي الساعات الإضافية غير صحيح أو سالب");
      if (h === 0) errors.push("أدخل إجمالي الساعات الإضافية أو اختر «لا» في سؤال العمل الإضافي");
    } else {
      if (args.overtime.length === 0) errors.push("أضف فترة واحدة على الأقل للساعات الإضافية");
      args.overtime.forEach((r, i) => {
        const h = num(r.hours);
        if (!Number.isFinite(h) || h < 0) errors.push(`الساعات الإضافية — الفترة ${i + 1}: عدد ساعات غير صحيح أو سالب`);
        if (!r.start_date || !r.end_date) errors.push(`الساعات الإضافية — الفترة ${i + 1}: التواريخ مطلوبة`);
        else if (new Date(r.end_date) < new Date(r.start_date))
          errors.push(`الساعات الإضافية — الفترة ${i + 1}: تاريخ النهاية قبل تاريخ البداية`);
      });
    }
  }

  if (settings.has_weekend_work) {
    if (args.weekend.length === 0) errors.push("أضف فترة واحدة على الأقل للعمل في أيام الراحة");
    args.weekend.forEach((r, i) => {
      const d = num(r.days);
      const h = num(r.hours);
      if (!Number.isFinite(d) || d < 0) errors.push(`أيام الراحة — الفترة ${i + 1}: عدد أيام غير صحيح أو سالب`);
      if (!Number.isFinite(h) || h < 0) errors.push(`أيام الراحة — الفترة ${i + 1}: عدد ساعات غير صحيح أو سالب`);
      if (!r.start_date) errors.push(`أيام الراحة — الفترة ${i + 1}: تاريخ البداية مطلوب`);
      if (r.start_date && r.end_date && new Date(r.end_date) < new Date(r.start_date))
        errors.push(`أيام الراحة — الفترة ${i + 1}: تاريخ النهاية قبل تاريخ البداية`);
      if (!d && !r.end_date) errors.push(`أيام الراحة — الفترة ${i + 1}: أدخل عدد الأيام أو تاريخ النهاية`);
    });
  }

  if (settings.has_holiday_work) {
    if (args.holiday.length === 0) errors.push("أضف إجازة واحدة على الأقل");
    args.holiday.forEach((r, i) => {
      const d = num(r.days);
      const h = num(r.hours);
      if (!r.holiday_name.trim()) errors.push(`الإجازات الرسمية — السطر ${i + 1}: اسم الإجازة مطلوب`);
      if (!r.holiday_date) errors.push(`الإجازات الرسمية — السطر ${i + 1}: تاريخ الإجازة مطلوب`);
      if (!Number.isFinite(d) || d < 0) errors.push(`الإجازات الرسمية — السطر ${i + 1}: عدد أيام غير صحيح أو سالب`);
      if (!Number.isFinite(h) || h < 0) errors.push(`الإجازات الرسمية — السطر ${i + 1}: عدد ساعات غير صحيح أو سالب`);
      if (r.end_date && new Date(r.end_date) < new Date(r.holiday_date))
        errors.push(`الإجازات الرسمية — السطر ${i + 1}: تاريخ النهاية قبل تاريخ الإجازة`);
    });
  }

  return errors;
}
