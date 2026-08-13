// Multi-step Yemeni Labor-Rights calculator wizard.
//
// Design goals (from product spec):
//   • Accessible to non-experts; full Arabic RTL flow.
//   • No login, no employee/employer name required to compute.
//   • Currency is chosen first and locked across the whole calculation.
//   • Wizard exposes: service dates, salary (single or period-based),
//     working hours, night shift, Friday treatment, annual leave,
//     insurance, termination reason, notice, EOSB advance — then a
//     review screen before the final compute.
//   • All monetary amounts displayed in English digits, no decimals,
//     comma thousands separators (handled by lib/calculator.formatCurrency).

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarIcon, ChevronRight, ChevronLeft, Calculator, Plus, Trash2, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CURRENCIES,
  calculate,
  computeServiceDuration,
  currencySuffix,
  formatDateAr,
  formatServiceDuration,
  parseDateOnly,
  toDateOnlyString,
  type CalculatorInput,
  type Currency,
  type SalaryPeriod,
  type TerminationReason,
  type AnnualLeaveStatus,
  type HolidayWorkEntry,
  type Gender,
  type BirthType,
} from "@/lib/calculator";

import { buildHolidayInstances, type Sector } from "@/lib/holidays";
import { useCalculatorStore } from "@/store/calculator";

interface WizardState {
  gender: Gender;
  currency: Currency;
  sector: Sector;
  start: string;
  still_working: boolean;
  end: string;
  monthly_salary: number;
  salary_changed: boolean;
  salary_periods: SalaryPeriod[];
  daily_hours: number;
  work_start_time: string;
  work_end_time: string;
  has_night_shift: boolean;
  night_hours_per_day: number;
  friday_off: boolean;
  friday_worked_hours: number;
  friday_paid: boolean;
  friday_pay_received: number;
  annual_leave_status: AnnualLeaveStatus;
  annual_leave_days_received: number;
  sick_leave_days: number;
  insured: boolean;
  employment_ended: boolean;
  termination_reason: TerminationReason;
  notice_given: boolean;
  notice_months: number;
  eosb_received: number;
  ramadan_days_by_year: Record<string, number>;
  ramadan_hours_by_year: Record<string, number>;
  /** Map keyed by HolidayInstance.id → user-supplied work data. */
  holiday_work: Record<string, { worked: boolean; daysWorked: number; hoursPerDay: number }>;
  /** Per-holiday-kind scope: did the worker work this kind in some / all / none of the years? */
  holiday_scope: Record<string, "none" | "all" | "some">;
  // ---- Women-workers module (only used when gender === "female") ----
  had_pregnancy: boolean;
  birth_date: string;
  birth_type: BirthType;
  maternity_leave_paid: boolean;
  reduced_period_daily_hours: number;
  pregnancy_days_worked: number;
  lactation_days_worked: number;
}

const initialState: WizardState = {
  gender: "male",
  currency: "YER",
  sector: "private",
  start: "",
  still_working: false,
  end: "",
  monthly_salary: 0,
  salary_changed: false,
  salary_periods: [],
  daily_hours: 0,
  work_start_time: "",
  work_end_time: "",
  has_night_shift: false,
  night_hours_per_day: 0,
  friday_off: true,
  friday_worked_hours: 0,
  friday_paid: false,
  friday_pay_received: 0,
  annual_leave_status: "full",
  annual_leave_days_received: 0,
  sick_leave_days: 0,
  insured: false,
  employment_ended: false,
  termination_reason: "mutual",
  notice_given: false,
  notice_months: 0,
  eosb_received: 0,
  ramadan_days_by_year: {},
  ramadan_hours_by_year: {},
  holiday_work: {},
  holiday_scope: {},
  had_pregnancy: false,
  birth_date: "",
  birth_type: "normal",
  maternity_leave_paid: true,
  reduced_period_daily_hours: 0,
  pregnancy_days_worked: 0,
  lactation_days_worked: 0,
};

type StepKey =
  | "gender" | "service" | "salary" | "hours" | "friday"
  | "leave" | "female" | "termination" | "review";

const STEP_LABELS: Record<StepKey, string> = {
  gender: "بيانات العامل",
  service: "مدة العمل",
  salary: "الراتب",
  hours: "ساعات العمل",
  friday: "يوم الجمعة",
  leave: "الإجازات",
  female: "حقوق المرأة العاملة",
  termination: "إنهاء العمل",
  review: "المراجعة",
};

const TERMINATION_LABELS: Record<TerminationReason, string> = {
  mutual: "بالتراضي",
  resignation: "استقالة",
  dismissal: "فصل من صاحب العمل",
  unfair: "فصل تعسفي",
  dismissal_pregnancy: "فصل بسبب الحمل",
  dismissal_lactation: "فصل أثناء إجازة الوضع/الرضاعة",
  other: "سبب آخر",
};


function serviceYearsRange(start: string, end: string): number[] {
  const s = parseDateOnly(start);
  const e = parseDateOnly(end);
  if (!s || !e || e.getTime() < s.getTime()) return [];
  const out: number[] = [];
  for (let y = s.getFullYear(); y <= e.getFullYear(); y++) out.push(y);
  return out;
}


interface Props {
  onComputed?: () => void;
  /** When true the wizard renders without an outer Card wrapper (used on the home hero). */
  embedded?: boolean;
}

export function CalculatorWizard({ onComputed, embedded }: Props) {
  const setLast = useCalculatorStore((s) => s.setLast);
  const [step, setStep] = useState(0);
  const [s, setS] = useState<WizardState>(initialState);
  const upd = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  const effectiveEnd = s.still_working ? toDateOnlyString(new Date()) : s.end;
  const duration = useMemo(
    () => computeServiceDuration(s.start, effectiveEnd),
    [s.start, effectiveEnd],
  );

  // Auto-derive daily hours + night portion from work start/end times.
  // Night window: 20:00 — 05:00 (next day). Overnight shifts are supported.
  useMemo(() => {
    const a = s.work_start_time, b = s.work_end_time;
    if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) return;
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    let start = toMin(a);
    let end = toMin(b);
    if (end <= start) end += 24 * 60; // crosses midnight
    const total = (end - start) / 60;
    // Night minutes inside [20:00, 29:00] (i.e. next-day 05:00) within shift.
    const nightFrom = 20 * 60;
    const nightTo = (24 + 5) * 60;
    const overlap = Math.max(0, Math.min(end, nightTo) - Math.max(start, nightFrom));
    // Also account for early morning before 05:00 if the shift starts very early.
    const earlyOverlap =
      start < 5 * 60 ? Math.max(0, Math.min(end, 5 * 60) - start) : 0;
    const nightHrs = (overlap + earlyOverlap) / 60;
    if (Math.abs(total - s.daily_hours) > 0.01) {
      setS((p) => ({
        ...p,
        daily_hours: Number(total.toFixed(2)),
        night_hours_per_day: Number(nightHrs.toFixed(2)),
        has_night_shift: nightHrs > 0.01 ? true : p.has_night_shift,
      }));
    }
  }, [s.work_start_time, s.work_end_time]);

  // ---- Dynamic step list — the women's-rights step only exists for females.
  const stepKeys = useMemo<StepKey[]>(() => {
    const base: StepKey[] = ["gender", "service", "salary", "hours", "friday", "leave"];
    if (s.gender === "female") base.push("female");
    base.push("termination", "review");
    return base;
  }, [s.gender]);
  const currentKey = stepKeys[Math.min(step, stepKeys.length - 1)];

  // ---- Step validation ------------------------------------------------------
  const stepValid = (key: StepKey): string | null => {
    switch (key) {
      case "gender":
        if (!s.gender) return "اختر جنس العامل قبل المتابعة.";
        return s.currency ? null : "اختر العملة قبل المتابعة.";
      case "service":
        if (!s.start) return "أدخل تاريخ بداية العمل.";
        if (!s.still_working && !s.end) return "أدخل تاريخ نهاية العمل أو حدد أنك ما زلت تعمل.";
        if (duration.total_days <= 0) return "تاريخ النهاية يجب أن يكون بعد تاريخ البداية.";
        return null;
      case "salary":
        if (!(s.monthly_salary > 0)) return "أدخل قيمة الراتب الشهري.";
        if (s.salary_changed) {
          if (s.salary_periods.length === 0)
            return "أضف فترة راتب واحدة على الأقل أو ألغِ خيار تغيّر الراتب.";
          for (const p of s.salary_periods) {
            if (!p.from || !p.to || !(p.salary > 0))
              return "أكمل بيانات جميع فترات الراتب (التواريخ والمبلغ).";
            if (parseDateOnly(p.to)!.getTime() < parseDateOnly(p.from)!.getTime())
              return "تاريخ نهاية الفترة يجب أن يكون بعد تاريخ البداية.";
          }
        }
        return null;
      case "hours":
        if (!(s.daily_hours > 0)) return "أدخل عدد ساعات العمل اليومية.";
        if (s.has_night_shift && !(s.night_hours_per_day > 0))
          return "أدخل عدد الساعات الليلية اليومية.";
        return null;
      case "friday":
        if (!s.friday_off) {
          if (!(s.friday_worked_hours > 0)) return "أدخل عدد ساعات العمل يوم الجمعة.";
          if (s.friday_paid && !(s.friday_pay_received > 0))
            return "أدخل إجمالي بدل الجمعة المستلم.";
        }
        return null;
      case "leave":
        if (s.annual_leave_status === "partial" && !(s.annual_leave_days_received > 0))
          return "أدخل عدد أيام الإجازة المستلمة.";
        return null;
      case "female":
        if (s.had_pregnancy && !s.birth_date)
          return "أدخل تاريخ الولادة (الفعلي أو المتوقع).";
        return null;
      case "termination":
        if (s.employment_ended) {
          if (!s.termination_reason) return "اختر طريقة إنهاء العمل.";
        }
        if (s.notice_given && !(s.notice_months > 0))
          return "أدخل عدد أشهر الإنذار الذي حصلت عليه.";
        return null;
      default:
        return null;
    }
  };

  const next = () => {
    const err = stepValid(currentKey);
    if (err) { toast.error(err); return; }
    setStep((i) => Math.min(stepKeys.length - 1, i + 1));
  };
  const prev = () => setStep((i) => Math.max(0, i - 1));


  // ---- Salary changes whenever periods are toggled off — clear safely.
  const togglePeriods = (on: boolean) => {
    upd("salary_changed", on);
    if (!on) upd("salary_periods", []);
    else if (s.salary_periods.length === 0)
      upd("salary_periods", [{ from: s.start || "", to: effectiveEnd || "", salary: s.monthly_salary || 0 }]);
  };
  const addPeriod = () =>
    upd("salary_periods", [...s.salary_periods, { from: "", to: "", salary: 0 }]);
  const removePeriod = (i: number) =>
    upd("salary_periods", s.salary_periods.filter((_, k) => k !== i));
  const updatePeriod = (i: number, patch: Partial<SalaryPeriod>) =>
    upd("salary_periods", s.salary_periods.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  // ---- Submit ---------------------------------------------------------------
  const compute = () => {
    const err = stepKeys.map((k) => stepValid(k)).find(Boolean) ?? null;
    if (err) { toast.error(err); return; }


    // Derive overtime hours per day from actual daily hours.
    const otPerDay = Math.max(0, s.daily_hours - 8);
    const nightPerDay = s.has_night_shift ? Math.max(0, s.night_hours_per_day) : 0;
    // Approximation: 6 working days/week × number of weeks in service.
    const weeks = duration.total_days / 7;
    const workDays = Math.max(0, weeks * 6);
    let totalOtHours = otPerDay * workDays;
    // Night premium applies only to the night portion of those hours.
    let nightOtHours = Math.min(nightPerDay * workDays, totalOtHours);
    let dayOtHours = Math.max(0, totalOtHours - nightOtHours);

    // ----- Per-year Ramadan extras (Art. 71: 6h/day legal cap in Ramadan) ----
    // Add (hours-per-day − 6) × days for every Ramadan that the worker
    // confirmed working. Night portion uses the same ratio as the regular shift.
    let ramadanOtHours = 0;
    const years = serviceYearsRange(s.start, effectiveEnd);
    for (const y of years) {
      const k = String(y);
      const days = Number(s.ramadan_days_by_year[k]) || 0;
      const hrs = Number(s.ramadan_hours_by_year[k]) || 0;
      if (days > 0 && hrs > 6) ramadanOtHours += (hrs - 6) * days;
    }
    if (ramadanOtHours > 0) {
      const nightShare = s.daily_hours > 0 ? Math.min(1, nightPerDay / s.daily_hours) : 0;
      const nightExtra = ramadanOtHours * nightShare;
      const dayExtra = ramadanOtHours - nightExtra;
      dayOtHours += dayExtra;
      nightOtHours += nightExtra;
      totalOtHours += ramadanOtHours;
    }

    // ----- Per-holiday entries (worked days × hours × 2 × hourly) -----------
    const instances = buildHolidayInstances(s.start, effectiveEnd, s.sector);
    const holiday_entries: HolidayWorkEntry[] = instances.map((h) => {
      const w = s.holiday_work[h.id] || { worked: false, daysWorked: 0, hoursPerDay: 0 };
      return {
        id: h.id,
        name: h.name,
        year: h.year,
        start: h.start,
        end: h.end,
        totalDays: h.totalDays,
        worked: !!w.worked,
        daysWorked: Math.min(h.totalDays, Math.max(0, Number(w.daysWorked) || 0)),
        hoursPerDay: Math.max(0, Number(w.hoursPerDay) || 0),
      };
    });

    const input: CalculatorInput = {
      employee_name: "",
      employer_name: "",
      monthly_salary: s.monthly_salary,
      currency: s.currency,
      service_start_date: s.start,
      service_end_date: effectiveEnd,
      still_working: s.still_working,
      sector: s.sector,
      salary_periods: s.salary_changed ? s.salary_periods : undefined,
      daily_hours: s.daily_hours,
      work_start_time: s.work_start_time,
      work_end_time: s.work_end_time,
      day_overtime_hours: dayOtHours,
      night_overtime_hours: nightOtHours,
      has_night_shift: s.has_night_shift,
      night_hours_per_day: s.night_hours_per_day,
      friday_off: s.friday_off,
      friday_worked_hours: s.friday_worked_hours,
      friday_paid: s.friday_paid,
      friday_pay_received: s.friday_pay_received,
      annual_leave_status: s.annual_leave_status,
      annual_leave_days_received: s.annual_leave_days_received,
      sick_leave_days: s.sick_leave_days,
      unused_leave_days: 0,
      insured: s.insured,
      employment_status: s.employment_ended ? "ended" : "ongoing",
      termination_reason: s.termination_reason,
      notice_given: s.notice_given,
      notice_months: s.notice_months,
      eosb_received: s.eosb_received,
      holiday_entries,
      gender: s.gender,
      had_pregnancy: s.gender === "female" ? s.had_pregnancy : false,
      birth_date: s.gender === "female" ? s.birth_date : undefined,
      birth_type: s.birth_type,
      maternity_leave_paid: s.maternity_leave_paid,
      reduced_period_daily_hours: s.reduced_period_daily_hours,
      pregnancy_days_worked: s.pregnancy_days_worked,
      lactation_days_worked: s.lactation_days_worked,
      unfair_dismissal:
        s.termination_reason === "unfair" ||
        s.termination_reason === "dismissal_pregnancy" ||
        s.termination_reason === "dismissal_lactation",
    };

    const result = calculate(input);
    setLast(input, result);
    toast.success("تم احتساب حقوقك");
    onComputed?.();
  };

  // ---- Reusable inputs ------------------------------------------------------
  const dateField = (
    value: string,
    onChange: (v: string) => void,
    placeholder = "اختر التاريخ",
  ) => {
    const selected = parseDateOnly(value) ?? undefined;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-right font-normal",
              !selected && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="ms-0 me-2 h-4 w-4" />
            {selected ? formatDateAr(selected) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => onChange(toDateOnlyString(d ?? null))}
            captionLayout="dropdown"
            fromYear={1970}
            toYear={new Date().getFullYear() + 1}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    );
  };

  const numInput = (
    value: number,
    onChange: (v: number) => void,
    placeholder = "0",
  ) => (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      value={value || ""}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      placeholder={placeholder}
      dir="ltr"
      className="text-left"
    />
  );

  const curSuf = currencySuffix(s.currency);

  // ---- Step bodies ----------------------------------------------------------
  const renderStep = () => {
    switch (currentKey) {
      case "gender":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="font-semibold">جنس العامل</Label>
              <p className="text-xs text-muted-foreground">
                اختيار إلزامي — عند اختيار "أنثى" تُفعَّل حقوق المرأة العاملة (تخفيض ساعات العمل أثناء الحمل والرضاعة، وإجازة الوضع) وفق المواد 43–46 من قانون العمل اليمني.
              </p>
              <RadioGroup
                value={s.gender}
                onValueChange={(v) => { upd("gender", v as Gender); setStep(0); }}
                className="grid gap-2 sm:grid-cols-2"
              >
                <Label htmlFor="gender-male"
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
                  <RadioGroupItem id="gender-male" value="male" />
                  <span className="font-medium">ذكر</span>
                </Label>
                <Label htmlFor="gender-female"
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
                  <RadioGroupItem id="gender-female" value="female" />
                  <span className="font-medium">أنثى</span>
                </Label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">العملة</Label>

              <p className="text-xs text-muted-foreground">
                يتم تثبيت العملة في كامل الحاسبة دون أي تحويل تلقائي.
              </p>
              <RadioGroup
                value={s.currency}
                onValueChange={(v) => upd("currency", v as Currency)}
                className="grid gap-2"
              >
                {CURRENCIES.map((c) => (
                  <Label key={c.value} htmlFor={`cur-${c.value}`}
                    className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
                    <RadioGroupItem id={`cur-${c.value}`} value={c.value} />
                    <span className="font-medium">{c.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="rounded-md bg-muted/40 border px-3 py-2 text-xs text-muted-foreground">
              يتم تطبيق نظام القطاع الخاص تلقائياً: 6 أيام عمل أسبوعياً ويوم الجمعة عطلة، مع تعويض يوم عمل تالٍ عند تداخل الإجازات الرسمية مع الجمعة.
            </div>
          </div>
        );


      case "service":
        return (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>تاريخ بداية العمل</Label>
              {dateField(s.start, (v) => upd("start", v))}
            </div>
            <div className="space-y-2">
              <Label>هل ما زلت تعمل حتى الآن؟</Label>
              <RadioGroup
                value={s.still_working ? "yes" : "no"}
                onValueChange={(v) => upd("still_working", v === "yes")}
                className="flex gap-4"
              >
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="yes" /> نعم
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="no" /> لا
                </Label>
              </RadioGroup>
            </div>
            {!s.still_working && (
              <div className="space-y-1.5">
                <Label>تاريخ نهاية العمل</Label>
                {dateField(s.end, (v) => upd("end", v))}
              </div>
            )}
            {duration.total_days > 0 && (
              <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
                <p className="font-semibold mb-0.5">مدة الخدمة المحسوبة</p>
                <p className="tabular-nums">
                  {formatServiceDuration(duration)} — إجمالي {duration.total_days} يوم
                </p>
                <p className="opacity-75 mt-1">
                  كسور السنة تُحسب بدقة: كل يوم خدمة يُحتسب نسبياً (الإجمالي ÷ 365.25) في مكافأة نهاية الخدمة.
                </p>
              </div>
            )}
          </div>
        );

      case "salary":
        return (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>الراتب الشهري الحالي / آخر راتب ({curSuf})</Label>
              {numInput(s.monthly_salary, (v) => upd("monthly_salary", v))}
              <p className="text-xs text-muted-foreground">يُستخدم كأساس لحساب الأجر اليومي والساعة وللفترات غير المغطاة في جدول الرواتب.</p>
            </div>

            <div className="space-y-2">
              <Label>هل تغيّر الراتب خلال سنوات الخدمة؟</Label>
              <RadioGroup
                value={s.salary_changed ? "yes" : "no"}
                onValueChange={(v) => togglePeriods(v === "yes")}
                className="flex gap-4"
              >
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="no" /> لا، ثابت
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="yes" /> نعم، تغيّر
                </Label>
              </RadioGroup>
            </div>

            {s.salary_changed && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                {s.salary_periods.map((p, i) => (
                  <div key={i} className="rounded-md border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">الفترة {i + 1}</p>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePeriod(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">من</Label>
                        {dateField(p.from, (v) => updatePeriod(i, { from: v }))}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">إلى</Label>
                        {dateField(p.to, (v) => updatePeriod(i, { to: v }))}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">الراتب ({curSuf})</Label>
                        {numInput(p.salary, (v) => updatePeriod(i, { salary: v }))}
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPeriod} className="gap-2">
                  <Plus className="h-4 w-4" /> إضافة فترة
                </Button>
                <p className="text-xs text-muted-foreground">
                  تُحسب مكافأة نهاية الخدمة لكل فترة بالراتب الفعلي خلالها. الفترات غير المغطاة تُحسب بالراتب الحالي.
                </p>
              </div>
            )}
          </div>
        );

      case "hours":
        return (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>عدد ساعات العمل اليومية الفعلية</Label>
              {numInput(s.daily_hours, (v) => upd("daily_hours", v), "8")}
              <p className="text-xs text-muted-foreground">
                الحد القانوني في اليمن 8 ساعات/يوم أو 48 ساعة/أسبوع (6 ساعات في رمضان). الساعات فوق ذلك تُحتسب كعمل إضافي.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>وقت بداية الدوام</Label>
                <Input type="time" value={s.work_start_time}
                  onChange={(e) => upd("work_start_time", e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>وقت نهاية الدوام</Label>
                <Input type="time" value={s.work_end_time}
                  onChange={(e) => upd("work_end_time", e.target.value)} dir="ltr" />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label className="flex items-center gap-2">
                <Checkbox checked={s.has_night_shift}
                  onCheckedChange={(v) => upd("has_night_shift", !!v)} />
                هل يتضمن دوامك عملاً ليلياً (20:00 – 05:00)؟
              </Label>
              {s.has_night_shift && (
                <div className="space-y-1.5 pt-2">
                  <Label>عدد ساعات العمل الليلية يومياً</Label>
                  {numInput(s.night_hours_per_day, (v) => upd("night_hours_per_day", v))}
                  <p className="text-xs text-muted-foreground">تُحتسب بنسبة 200% من أجر الساعة.</p>
                </div>
              )}
            </div>
          </div>
        );

      case "friday":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>هل كان يوم الجمعة إجازة؟</Label>
              <RadioGroup
                value={s.friday_off ? "yes" : "no"}
                onValueChange={(v) => upd("friday_off", v === "yes")}
                className="flex gap-4"
              >
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="yes" /> نعم، إجازة
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="no" /> لا، كنت أعمل الجمعة
                </Label>
              </RadioGroup>
            </div>
            {!s.friday_off && (
              <>
                <div className="space-y-1.5">
                  <Label>عدد ساعات العمل في الجمعة الواحدة</Label>
                  {numInput(s.friday_worked_hours, (v) => upd("friday_worked_hours", v))}
                </div>
                <div className="space-y-2">
                  <Label>هل كنت تستلم أجر يوم الجمعة؟</Label>
                  <RadioGroup
                    value={s.friday_paid ? "yes" : "no"}
                    onValueChange={(v) => upd("friday_paid", v === "yes")}
                    className="flex gap-4"
                  >
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="no" /> لا
                    </Label>
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="yes" /> نعم
                    </Label>
                  </RadioGroup>
                </div>
                {s.friday_paid && (
                  <div className="space-y-1.5">
                    <Label>إجمالي بدل الجمعة المستلم خلال فترة العمل ({curSuf})</Label>
                    {numInput(s.friday_pay_received, (v) => upd("friday_pay_received", v))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  يُحتسب يوم الراحة الأسبوعي المُشتغل بأجر مضاعف (200%) وفق قانون العمل اليمني، مع خصم ما تم دفعه.
                </p>
              </>
            )}
          </div>
        );

      case "leave":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>الإجازة السنوية</Label>
              <RadioGroup
                value={s.annual_leave_status}
                onValueChange={(v) => upd("annual_leave_status", v as AnnualLeaveStatus)}
                className="grid gap-2"
              >
                <Label className="flex items-center gap-2 cursor-pointer rounded-md border p-3">
                  <RadioGroupItem value="full" /> حصلت على 30 يوم سنوياً بأجر كامل
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer rounded-md border p-3">
                  <RadioGroupItem value="partial" /> حصلت على بعض الأيام فقط
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer rounded-md border p-3">
                  <RadioGroupItem value="none" /> لم أحصل على أي إجازة
                </Label>
              </RadioGroup>
            </div>
            {s.annual_leave_status === "partial" && (
              <div className="space-y-1.5">
                <Label>إجمالي أيام الإجازة التي حصلت عليها خلال فترة العمل</Label>
                {numInput(s.annual_leave_days_received, (v) => upd("annual_leave_days_received", v))}
              </div>
            )}

            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-4">
              <Label htmlFor="sick_leave_days" className="font-semibold">
                عدد أيام الإجازات المرضية المعتمدة طبياً خلال السنة
              </Label>
              {numInput(s.sick_leave_days, (v) => upd("sick_leave_days", v))}
              <p className="text-xs text-muted-foreground leading-relaxed">
                المادة 80: أول 60 يوماً بأجر كامل، ثم 61–120 بنسبة 85%، و121–180 بنسبة 75%،
                و181–240 بنسبة 50%، وما زاد عن 240 يوماً بدون أجر.
              </p>
            </div>

            {/* Per-year Ramadan + per-holiday/per-year official holidays */}
            <YearlyRamadanHolidays
              years={serviceYearsRange(s.start, effectiveEnd)}
              ramadanDays={s.ramadan_days_by_year}
              ramadanHours={s.ramadan_hours_by_year}
              holidayInstances={buildHolidayInstances(s.start, effectiveEnd, s.sector)}
              holidayWork={s.holiday_work}
              holidayScope={s.holiday_scope}
              onRamadanDays={(y, v) =>
                upd("ramadan_days_by_year", { ...s.ramadan_days_by_year, [y]: v })
              }
              onRamadanHours={(y, v) =>
                upd("ramadan_hours_by_year", { ...s.ramadan_hours_by_year, [y]: v })
              }
              onHolidayWork={(id, patch) => {
                const prev = s.holiday_work[id] ?? { worked: false, daysWorked: 0, hoursPerDay: 0 };
                upd("holiday_work", { ...s.holiday_work, [id]: { ...prev, ...patch } });
              }}
              onHolidayScope={(kind, scope) =>
                upd("holiday_scope", { ...s.holiday_scope, [kind]: scope })
              }
            />

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label className="flex items-center gap-2">
                <Checkbox checked={s.insured}
                  onCheckedChange={(v) => upd("insured", !!v)} />
                أنا مسجّل في التأمينات الاجتماعية
              </Label>
              <p className="text-xs text-muted-foreground">
                معلومة استرشادية لا تؤثر مباشرة على الحساب لكنها تظهر في تقرير PDF.
              </p>
            </div>
          </div>
        );

      case "female":
        return (
          <div className="space-y-5">
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-primary leading-relaxed">
              <p className="font-semibold mb-1">حقوق المرأة العاملة — المواد 43–46</p>
              <p>
                من بداية الشهر السادس للحمل وحتى ستة أشهر بعد الولادة يكون الحد الأقصى لساعات العمل <b>5 ساعات يومياً</b>؛
                وما زاد عن ذلك يُحتسب عملاً إضافياً بنسبة <b>150%</b> من أجر الساعة. كما تستحق العاملة
                <b> إجازة وضع بأجر كامل</b>: 60 يوماً للولادة الطبيعية و80 يوماً للولادة المتعسرة أو التوأم.
              </p>
            </div>

            <div className="space-y-2">
              <Label>هل مررتِ بحمل أو ولادة خلال فترة العمل؟</Label>
              <RadioGroup
                value={s.had_pregnancy ? "yes" : "no"}
                onValueChange={(v) => upd("had_pregnancy", v === "yes")}
                className="flex gap-4"
              >
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="no" /> لا
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="yes" /> نعم
                </Label>
              </RadioGroup>
            </div>

            {s.had_pregnancy && (
              <>
                <div className="space-y-1.5">
                  <Label>تاريخ الولادة (الفعلي أو المتوقع)</Label>
                  {dateField(s.birth_date, (v) => upd("birth_date", v))}
                </div>

                <div className="space-y-2">
                  <Label>نوع الولادة</Label>
                  <RadioGroup
                    value={s.birth_type}
                    onValueChange={(v) => upd("birth_type", v as BirthType)}
                    className="grid gap-2"
                  >
                    <Label className="flex items-center gap-2 cursor-pointer rounded-md border p-3">
                      <RadioGroupItem value="normal" /> ولادة طبيعية — إجازة 60 يوماً
                    </Label>
                    <Label className="flex items-center gap-2 cursor-pointer rounded-md border p-3">
                      <RadioGroupItem value="complicated" /> ولادة متعسرة أو توأم — إجازة 80 يوماً
                    </Label>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>هل حصلتِ على إجازة الوضع بأجر كامل؟</Label>
                  <RadioGroup
                    value={s.maternity_leave_paid ? "yes" : "no"}
                    onValueChange={(v) => upd("maternity_leave_paid", v === "yes")}
                    className="flex gap-4"
                  >
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="yes" /> نعم
                    </Label>
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="no" /> لا
                    </Label>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    إذا لم تُمنح الإجازة أو مُنحت بدون أجر تُحتسب قيمتها ضمن المستحقات.
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-semibold">ساعات العمل خلال فترة الحماية</p>
                  <div className="space-y-1.5">
                    <Label>عدد ساعات العمل الفعلية يومياً خلال هذه الفترة</Label>
                    {numInput(s.reduced_period_daily_hours, (v) => upd("reduced_period_daily_hours", v), "5")}
                    <p className="text-xs text-muted-foreground">الحد القانوني 5 ساعات؛ الزائد يُحتسب 150%.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>أيام العمل من الشهر السادس للحمل حتى الولادة</Label>
                      {numInput(s.pregnancy_days_worked, (v) => upd("pregnancy_days_worked", v))}
                    </div>
                    <div className="space-y-1.5">
                      <Label>أيام العمل خلال 6 أشهر بعد الولادة (الرضاعة)</Label>
                      {numInput(s.lactation_days_worked, (v) => upd("lactation_days_worked", v))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case "termination":

        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>حالة العمل الحالية</Label>
              <RadioGroup
                value={s.employment_ended ? "ended" : "ongoing"}
                onValueChange={(v) => upd("employment_ended", v === "ended")}
                className="flex gap-4"
              >
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="ongoing" /> مستمر
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="ended" /> انتهى العمل
                </Label>
              </RadioGroup>
            </div>
            {s.employment_ended && (
              <div className="space-y-2">
                <Label>طريقة إنهاء العمل</Label>
                <Select
                  value={s.termination_reason}
                  onValueChange={(v) => upd("termination_reason", v as TerminationReason)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mutual">بالتراضي</SelectItem>
                    <SelectItem value="resignation">استقالة</SelectItem>
                    <SelectItem value="dismissal">فصل من صاحب العمل</SelectItem>
                    <SelectItem value="unfair">فصل تعسفي</SelectItem>
                    {s.gender === "female" && (
                      <SelectItem value="dismissal_pregnancy">فصل بسبب الحمل</SelectItem>
                    )}
                    {s.gender === "female" && (
                      <SelectItem value="dismissal_lactation">فصل أثناء إجازة الوضع/الرضاعة</SelectItem>
                    )}
                    <SelectItem value="other">سبب آخر</SelectItem>
                  </SelectContent>

                </Select>
                <p className="text-xs text-muted-foreground">
                  طريقة الإنهاء تؤثر على بدل الإنذار والتعويض المحتمل.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>هل تم إعطاؤك مهلة إنذار قبل انتهاء العمل؟</Label>
              <RadioGroup
                value={s.notice_given ? "yes" : "no"}
                onValueChange={(v) => upd("notice_given", v === "yes")}
                className="flex gap-4"
              >
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="no" /> لا
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="yes" /> نعم
                </Label>
              </RadioGroup>
              {s.notice_given && (
                <div className="space-y-1.5 pt-2">
                  <Label>عدد أشهر الإنذار</Label>
                  {numInput(s.notice_months, (v) => upd("notice_months", v), "1")}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>هل استلمت مكافأة نهاية الخدمة كلها أو جزء منها؟ ({curSuf})</Label>
              {numInput(s.eosb_received, (v) => upd("eosb_received", v))}
              <p className="text-xs text-muted-foreground">
                إن وُجد، يتم خصم هذا المبلغ من إجمالي الحقوق المستحقة.
              </p>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">راجع بياناتك قبل الحساب:</p>
            <ReviewRow label="العملة" value={CURRENCIES.find((c) => c.value === s.currency)?.label || s.currency} />
            <ReviewRow label="بداية العمل" value={formatDateAr(s.start)} />
            <ReviewRow label="نهاية العمل" value={s.still_working ? "ما زال يعمل" : formatDateAr(s.end)} />
            <ReviewRow label="مدة الخدمة" value={formatServiceDuration(duration)} />
            <ReviewRow label="الراتب الشهري" value={`${s.monthly_salary.toLocaleString("en-US")} ${curSuf}`} />
            {s.salary_changed && (
              <ReviewRow label="فترات الراتب" value={`${s.salary_periods.length} فترة`} />
            )}
            <ReviewRow label="ساعات العمل اليومية" value={`${s.daily_hours} ساعة`} />
            {s.has_night_shift && (
              <ReviewRow label="ساعات العمل الليلية" value={`${s.night_hours_per_day} ساعة/يوم`} />
            )}
            <ReviewRow label="يوم الجمعة" value={s.friday_off ? "إجازة" : `${s.friday_worked_hours} ساعة`} />
            <ReviewRow
              label="الإجازة السنوية"
              value={
                s.annual_leave_status === "full" ? "بأجر كامل" :
                s.annual_leave_status === "partial" ? `${s.annual_leave_days_received} يوم` :
                "لم تُمنح"
              }
            />
            {(() => {
              const totalWorked = Object.values(s.holiday_work)
                .filter((w) => w?.worked && w.daysWorked > 0)
                .reduce((sum, w) => sum + Number(w.daysWorked || 0), 0);
              return totalWorked > 0 ? (
                <ReviewRow label="أيام العمل في الإجازات الرسمية" value={`${totalWorked} يوم (200%)`} />
              ) : null;
            })()}
            {s.sick_leave_days > 0 && (
              <ReviewRow label="الإجازات المرضية" value={`${s.sick_leave_days} يوم (المادة 80)`} />
            )}
            <ReviewRow label="الجنس" value={s.gender === "female" ? "أنثى" : "ذكر"} />
            {s.gender === "female" && s.had_pregnancy && (
              <>
                <ReviewRow label="تاريخ الولادة" value={formatDateAr(s.birth_date)} />
                <ReviewRow
                  label="إجازة الوضع"
                  value={`${s.birth_type === "complicated" ? 80 : 60} يوم — ${s.maternity_leave_paid ? "مدفوعة" : "غير مدفوعة"}`}
                />
                {s.reduced_period_daily_hours > 5 && (
                  <ReviewRow
                    label="ساعات تتجاوز الحد (5 ساعات)"
                    value={`${(s.reduced_period_daily_hours - 5).toFixed(2)} ساعة/يوم`}
                  />
                )}
              </>
            )}
            <ReviewRow label="حالة العمل" value={s.employment_ended ? "انتهى" : "مستمر"} />
            {s.employment_ended && (
              <ReviewRow label="طريقة الإنهاء" value={TERMINATION_LABELS[s.termination_reason]} />
            )}
            <ReviewRow label="الإنذار" value={s.notice_given ? `${s.notice_months} شهر` : "لم يُمنح"} />
            {s.eosb_received > 0 && (
              <ReviewRow label="مكافأة مستلمة" value={`${s.eosb_received.toLocaleString("en-US")} ${curSuf}`} />
            )}

          </div>
        );
    }
  };

  const body = (
    <div className="space-y-6">
      {/* Step indicator + new-calculation button */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>الخطوة {step + 1} من {stepKeys.length}</span>
            <span className="font-medium text-foreground">{STEP_LABELS[currentKey]}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setS(initialState);
              setStep(0);
              useCalculatorStore.getState().newCalculation();
              toast.success("تم بدء حسبة جديدة");
            }}
            className="gap-1 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> حسبة جديدة
          </Button>
        </div>
        <Progress value={((step + 1) / stepKeys.length) * 100} />
      </div>


      {renderStep()}

      {/* Navigation */}
      <div className="flex flex-wrap gap-3 pt-2 border-t">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={prev} className="gap-1">
            <ChevronRight className="h-4 w-4" /> السابق
          </Button>
        )}
        {step < stepKeys.length - 1 ? (
          <Button type="button" onClick={next} className="gap-1 ms-auto">
            التالي <ChevronLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={compute} size="lg" className="gap-2 ms-auto">
            <Calculator className="h-4 w-4" /> احسب حقوقي
          </Button>
        )}
      </div>
    </div>
  );

  if (embedded) return body;
  return <Card className="p-5 sm:p-7 card-elev">{body}</Card>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

interface HolidayInstanceLite {
  id: string;
  name: string;
  year: number;
  start: string;
  end: string;
  baseDays: number;
  compDays: number;
  totalDays: number;
  overlapDates: string[];
}

interface YRHProps {
  years: number[];
  ramadanDays: Record<string, number>;
  ramadanHours: Record<string, number>;
  holidayInstances: HolidayInstanceLite[];
  holidayWork: Record<string, { worked: boolean; daysWorked: number; hoursPerDay: number }>;
  holidayScope: Record<string, "none" | "all" | "some">;
  onRamadanDays: (year: string, value: number) => void;
  onRamadanHours: (year: string, value: number) => void;
  onHolidayWork: (id: string, patch: Partial<{ worked: boolean; daysWorked: number; hoursPerDay: number }>) => void;
  onHolidayScope: (kind: string, scope: "none" | "all" | "some") => void;
}

function YearlyRamadanHolidays({
  years, ramadanDays, ramadanHours,
  holidayInstances, holidayWork, holidayScope,
  onRamadanDays, onRamadanHours, onHolidayWork, onHolidayScope,
}: YRHProps) {
  if (years.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
        أكمل تاريخي بداية ونهاية العمل لإظهار سنوات رمضان والإجازات الرسمية.
      </div>
    );
  }

  // Group holiday instances by kind (eid_fitr, eid_adha, …)
  const groups = new Map<string, HolidayInstanceLite[]>();
  for (const h of holidayInstances) {
    const kind = h.id.split("|")[0];
    const arr = groups.get(kind) ?? [];
    arr.push(h);
    groups.set(kind, arr);
  }

  return (
    <div className="space-y-3">
      {/* Ramadan */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
        <div className="text-sm font-semibold">رمضان لكل سنة</div>
        <p className="text-xs text-muted-foreground">
          الحد القانوني في رمضان: 6 ساعات/يوم. الساعات الزائدة تُحتسب إضافي (150% نهاراً / 200% ليلاً).
        </p>
        <div className="space-y-2">
          {years.map((y) => {
            const key = String(y);
            const days = ramadanDays[key] || 0;
            const hours = ramadanHours[key] || 0;
            const worked = days > 0;
            return (
              <div key={y} className="rounded-md border bg-card/50 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">رمضان {y}</span>
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={worked}
                      onCheckedChange={(v) => {
                        if (!v) { onRamadanDays(key, 0); onRamadanHours(key, 0); }
                        else { onRamadanDays(key, 30); onRamadanHours(key, 6); }
                      }}
                    />
                    داومت
                  </label>
                </div>
                {worked && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">عدد أيام الدوام</Label>
                      <Input type="number" min={0} max={30} dir="ltr"
                        value={days || ""}
                        placeholder="0"
                        onChange={(e) => onRamadanDays(key, e.target.value === "" ? 0 : Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">عدد ساعات الدوام يومياً</Label>
                      <Input type="number" min={0} max={16} dir="ltr"
                        value={hours || ""}
                        placeholder="0"
                        onChange={(e) => onRamadanHours(key, e.target.value === "" ? 0 : Number(e.target.value))} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Official holidays — grouped by kind, expandable per-year detail */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
        <div className="text-sm font-semibold">الإجازات الرسمية</div>
        <p className="text-xs text-muted-foreground">
          لكل إجازة: حدّد إن كنت قد عملت فيها، ثم سجّل أيام وساعات العمل لكل سنة على حدة. يُحتسب أجر العمل في الإجازة بنسبة <b>200%</b> من أجر الساعة. أيام تداخل الإجازة مع عطلتك الأسبوعية تُعوَّض بأيام تُضاف لنهاية الإجازة.
        </p>
        {groups.size === 0 && (
          <p className="text-xs text-muted-foreground">لا توجد إجازات رسمية ضمن فترة عملك.</p>
        )}
        {[...groups.entries()].map(([kind, list]) => {
          const name = list[0].name;
          const scope = holidayScope[kind] ?? "none";
          return (
            <div key={kind} className="rounded-md border bg-card/50 p-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-semibold">{name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {list.length} {list.length === 1 ? "سنة" : "سنوات"} ضمن فترة العمل
                </span>
              </div>
              <RadioGroup
                value={scope}
                onValueChange={(v) => {
                  const newScope = v as "none" | "all" | "some";
                  onHolidayScope(kind, newScope);
                  // Apply scope to all instances
                  if (newScope === "all") {
                    for (const h of list) {
                      onHolidayWork(h.id, { worked: true, daysWorked: h.totalDays, hoursPerDay: 8 });
                    }
                  } else if (newScope === "none") {
                    for (const h of list) {
                      onHolidayWork(h.id, { worked: false, daysWorked: 0, hoursPerDay: 0 });
                    }
                  }
                }}
                className="flex flex-wrap gap-3 text-xs"
              >
                <Label className="flex items-center gap-1.5 cursor-pointer">
                  <RadioGroupItem value="none" /> لم أداوم
                </Label>
                <Label className="flex items-center gap-1.5 cursor-pointer">
                  <RadioGroupItem value="all" /> داومت في جميع السنوات
                </Label>
                <Label className="flex items-center gap-1.5 cursor-pointer">
                  <RadioGroupItem value="some" /> داومت في بعض السنوات
                </Label>
              </RadioGroup>

              {(scope === "all" || scope === "some") && (
                <div className="space-y-2 pt-1">
                  {list.map((h) => {
                    const w = holidayWork[h.id] || { worked: false, daysWorked: 0, hoursPerDay: 0 };
                    const showFields = scope === "all" || w.worked;
                    return (
                      <div key={h.id} className="rounded-md border bg-background p-2.5 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="text-xs">
                            <div className="font-semibold">سنة {h.year}</div>
                            <div className="text-muted-foreground tabular-nums" dir="ltr">
                              {h.start} → {h.end}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {h.baseDays} يوم
                              {h.compDays > 0 && ` + ${h.compDays} يوم تعويض (تداخل مع العطلة الأسبوعية)`}
                              {" = "}{h.totalDays} يوم إجمالاً
                            </div>
                          </div>
                          {scope === "some" && (
                            <label className="flex items-center gap-1.5 text-xs">
                              <Checkbox
                                checked={w.worked}
                                onCheckedChange={(v) => onHolidayWork(h.id, { worked: !!v, daysWorked: v ? h.totalDays : 0, hoursPerDay: v ? 8 : 0 })}
                              />
                              داومت
                            </label>
                          )}
                        </div>
                        {showFields && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">عدد أيام العمل</Label>
                              <Input type="number" min={0} max={h.totalDays} dir="ltr"
                                value={w.daysWorked || ""}
                                placeholder="0"
                                onChange={(e) => onHolidayWork(h.id, { daysWorked: e.target.value === "" ? 0 : Number(e.target.value) })} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">ساعات العمل يومياً</Label>
                              <Input type="number" min={0} max={24} dir="ltr"
                                value={w.hoursPerDay || ""}
                                placeholder="0"
                                onChange={(e) => onHolidayWork(h.id, { hoursPerDay: e.target.value === "" ? 0 : Number(e.target.value) })} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

