// ============================================================================
// Yemen Labor Rights Calculator
// ----------------------------------------------------------------------------
// Implements the core monetary computations based on the Yemeni Labour Law
// (Law No. 5 of 1995, as commonly applied in practice):
//
//   • End-of-Service Benefit (EOSB) — Art. 119: one month's wage for each
//     year of effective service, prorated for fractions of a year. If the
//     salary changed over time the calculation is done period-by-period
//     using the actual salary in force during each period (sum of
//     period_salary × period_fractional_years). When no period history is
//     provided we fall back to the final salary × total fractional years.
//
//   • Statutory working hours — Art. 71: 8 hours/day or 48 hours/week
//     (6 hours/day in Ramadan).
//
//   • Overtime — Art. 73: +50 % premium during the day (150 %), and night
//     work (20:00–05:00) is compensated at 200 % of the hourly wage.
//     When an overtime hour falls in the night window the 200 % rate
//     applies and is NOT combined with the day premium.
//
//   • Weekly rest day (Friday) — Art. 76: working on the weekly rest day
//     without compensatory time off entitles the worker to double pay
//     (200 % of the daily wage). When the employer paid an explicit Friday
//     allowance we deduct it.
//
//   • Annual leave — Art. 79: 30 days of fully-paid leave per year of
//     effective service. Unused days are compensated at the daily wage.
//
//   • Notice indemnity — Art. 36: at least one month's notice. If the
//     employer terminated without notice, the worker is owed one month's
//     salary in lieu (or more if a longer notice period was contractually
//     agreed). Resignation by the worker without notice does NOT entitle
//     notice indemnity.
//
//   • Unfair dismissal — Art. 36/115: the court determines fair
//     compensation; we surface a conservative estimate (last salary × 6)
//     as a legal note ONLY — never as a guaranteed amount.
//
//   • Advance EOSB received — deducted from the final guaranteed total.
//
// Currencies are NEVER converted automatically. All amounts stay in the
// currency the user selected at the start of the wizard.
// ============================================================================

export type Currency = "YER" | "SAR" | "USD";

export const CURRENCIES: { value: Currency; label: string; suffix: string }[] = [
  { value: "YER", label: "ريال يمني (YER)", suffix: "ر.ي" },
  { value: "SAR", label: "ريال سعودي (SAR)", suffix: "ر.س" },
  { value: "USD", label: "دولار أمريكي (USD)", suffix: "$" },
];

/** Per-holiday work entry collected from the wizard. */
export interface HolidayWorkEntry {
  /** Stable id from holidays.buildHolidayInstances(). */
  id: string;
  /** Display name e.g. "عيد الفطر". */
  name: string;
  /** Gregorian year (or first year for cross-year cases). */
  year: number;
  /** ISO start date. */
  start: string;
  /** ISO end date (after weekly-rest compensation). */
  end: string;
  /** Total entitled days (base + compensation). */
  totalDays: number;
  /** Did the worker actually work during this holiday? */
  worked: boolean;
  /** Days actually worked (cap = totalDays). */
  daysWorked: number;
  /** Hours per worked day — 200 % is applied per hour. */
  hoursPerDay: number;
}

/** A salary that applied during a specific date range (inclusive). */
export interface SalaryPeriod {
  /** ISO date YYYY-MM-DD */
  from: string;
  /** ISO date YYYY-MM-DD */
  to: string;
  /** Monthly salary in the input's chosen currency. */
  salary: number;
}

export type TerminationReason =
  | "mutual"
  | "resignation"
  | "dismissal"
  | "unfair"
  | "dismissal_pregnancy"
  | "dismissal_lactation"
  | "other";

/** Worker gender — drives the isolated women's-rights module. */
export type Gender = "male" | "female";

/** Birth type — Art. 45 maternity leave duration. */
export type BirthType = "normal" | "complicated";

export type EmploymentStatus = "ongoing" | "ended";

export type AnnualLeaveStatus =
  | "full"          // received 30 days fully paid every year
  | "partial"       // received some days — user supplies received total
  | "none";         // received nothing


export interface CalculatorInput {
  /** Optional — only required at PDF time. */
  employee_name: string;
  /** Optional — only required at PDF time. */
  employer_name: string;
  monthly_salary: number;
  currency: Currency;
  /** ISO date YYYY-MM-DD */
  service_start_date: string;
  /** ISO date YYYY-MM-DD — when still_working is true this is "today". */
  service_end_date: string;
  /** True when the worker is still employed; end date is then today. */
  still_working?: boolean;

  /** Optional salary history. When present and non-empty, EOSB is
   * computed period-by-period; uncovered gaps fall back to monthly_salary. */
  salary_periods?: SalaryPeriod[];

  /** Actual daily working hours the worker performed (e.g. 8, 10, 12). */
  daily_hours?: number;
  /** "HH:MM" — work start time. */
  work_start_time?: string;
  /** "HH:MM" — work end time. */
  work_end_time?: string;

  /** Direct overtime hours over the whole service period. Kept for back-compat
   *  and used directly when the wizard cannot derive them. */
  day_overtime_hours: number;
  night_overtime_hours: number;

  /** Night shift toggle and the daily portion that falls in 20:00–05:00. */
  has_night_shift?: boolean;
  night_hours_per_day?: number;

  /** Sector: private (Friday off) vs public (Thu+Fri off). Drives holiday
   *  overlap compensation and weekly working-days math. */
  sector?: "private" | "public";

  /** Per-holiday work entries (preferred input — see HolidayWorkEntry). */
  holiday_entries?: HolidayWorkEntry[];

  /** Friday treatment. */
  friday_off?: boolean;
  friday_worked_hours?: number;
  friday_paid?: boolean;
  /** Total Friday allowance already paid by the employer. */
  friday_pay_received?: number;

  /** Annual leave situation — see AnnualLeaveStatus. */
  annual_leave_status?: AnnualLeaveStatus;
  /** When status="partial", the total leave days actually received. */
  annual_leave_days_received?: number;
  /** Medically-certified sick-leave days taken within the year (Art. 80). */
  sick_leave_days?: number;
  /** Raw unused-leave-days override (used when the wizard pre-computes them
   *  or when older saved inputs are loaded). */
  unused_leave_days: number;


  /** Social-insurance enrollment (informational — not a monetary input). */
  insured?: boolean;

  /** Employment status and termination details. */
  employment_status?: EmploymentStatus;
  termination_reason?: TerminationReason;

  /** Notice period the employer actually gave. */
  notice_given?: boolean;
  /** Months of notice given (0, 1, 2, ...). */
  notice_months?: number;

  /** EOSB already paid by employer — subtracted from total. */
  eosb_received?: number;

  /** Calendar used at input time (informational; dates always stored ISO). */
  calendar_type?: "gregorian" | "hijri";

  /** Total official-holiday days the worker actually worked across service.
   *  Each day is paid at 200 % of the daily rate. */
  holiday_days_worked?: number;



  // ---------------------------------------------------------------------
  // Women-workers module (isolated — only evaluated when gender="female").
  // Yemeni Labour Law: Art. 43–46 (working women protections).
  // ---------------------------------------------------------------------
  /** Worker gender. Defaults to "male" for legacy saved inputs. */
  gender?: Gender;
  /** Did the worker experience pregnancy/childbirth during service? */
  had_pregnancy?: boolean;
  /** ISO date of childbirth (actual or expected). */
  birth_date?: string;
  /** Normal (60 days) vs complicated/twins (80 days) — Art. 45. */
  birth_type?: BirthType;
  /** Was the maternity leave granted with full pay? */
  maternity_leave_paid?: boolean;
  /** Actual daily working hours during the protection window (legal cap 5h). */
  reduced_period_daily_hours?: number;
  /** Days actually worked from the 6th pregnancy month until childbirth. */
  pregnancy_days_worked?: number;
  /** Days actually worked during the 6 months following childbirth (nursing). */
  lactation_days_worked?: number;

  /** Legacy flag — kept so older saved calculations still type-check. */
  unfair_dismissal: boolean;
}


export interface ServiceDuration {
  years: number;
  months: number;
  days: number;
  total_days: number;
  total_months: number;
  fractional_years: number;
}

export interface LegalNote {
  key: "unfair_dismissal" | "unused_leave" | "pregnancy_dismissal";
  title: string;
  amount: number;
  formula: string;
  warning: string;
}

/** Isolated result block for the women-workers module (Art. 43–46). */
export interface FemaleRightsResult {
  applies: boolean;
  birth_date: string;
  birth_type: BirthType;
  /** Start of the reduced-hours window (6th month of pregnancy ≈ birth − 90d). */
  reduced_start: string;
  /** End of the nursing window (6 months after childbirth). */
  reduced_end: string;
  /** Legal daily cap during the window. */
  legal_daily_hours: number;
  actual_daily_hours: number;
  extra_hours_per_day: number;
  pregnancy_days_worked: number;
  lactation_days_worked: number;
  extra_hours_total: number;
  /** Hourly wage in force during the window (historical salary aware). */
  hourly_rate: number;
  /** Extra hours beyond the 5-hour cap, paid at 150 %. */
  extra_hours_amount: number;
  maternity_leave_days: number;
  maternity_leave_paid: boolean;
  /** Unpaid maternity leave is owed at full pay (Art. 45). */
  maternity_leave_amount: number;
  total: number;
}

/** One tier of the statutory sick-leave pay scale (Art. 80). */
export interface SickLeaveTier {
  label: string;
  /** Days falling inside this tier. */
  days: number;
  /** Paid percentage of the daily wage (1 = 100 %). */
  rate: number;
  /** Amount actually due for those days. */
  amount: number;
  /** Wage withheld for those days (full pay − amount). */
  deduction: number;
}

/** Sick-leave block (Art. 80) — tiered pay across a single year. */
export interface SickLeaveResult {
  applies: boolean;
  days: number;
  daily_rate: number;
  tiers: SickLeaveTier[];
  /** Total wage due for the sick-leave days. */
  paid_amount: number;
  /** Total wage withheld versus full pay. */
  deduction_amount: number;
  /** paid_amount − deduction_amount is NOT used; net = paid_amount. */
  full_pay_amount: number;
}

/** Statute of limitations block (Art. 149) — one Gregorian year after service end. */
export interface LimitationResult {
  /** Employment still running → the clock has not started. */
  ongoing: boolean;
  end_date: string | null;
  /** Deadline = end_date + 1 Gregorian year. */
  deadline: string | null;
  days_remaining: number | null;
  status: "not_started" | "valid" | "expiring" | "expired";
}

export interface CalculatorResult extends ServiceDuration {

  daily_rate: number;
  hourly_rate: number;
  /** Time-weighted historical daily/hourly wage used for overtime & rest-day pay. */
  historical_daily_rate: number;
  historical_hourly_rate: number;
  total_service_years: number;
  eos_benefit: number;
  /** Sum across salary periods, useful for the PDF breakdown. */
  eos_breakdown?: { from: string; to: string; salary: number; years: number; amount: number }[];
  day_overtime_amount: number;
  night_overtime_amount: number;
  friday_compensation: number;
  /** Compensation for working official public holidays (200 %). */
  holiday_compensation: number;
  /** Per-holiday breakdown for the report. */
  holiday_breakdown?: {
    id: string; name: string; year: number;
    start: string; end: string;
    totalDays: number; daysWorked: number;
    hoursPerDay: number; amount: number;
    /** Monthly salary in force on the holiday date. */
    salary?: number;
  }[];
  notice_indemnity: number;
  leave_compensation: number;
  unfair_dismissal_compensation: number;
  eosb_advance_deduction: number;
  /** Women-workers module result — null for male workers. */
  female_rights: FemaleRightsResult | null;
  /** Sick-leave block (Art. 80) — null when no sick days were entered. */
  sick_leave: SickLeaveResult | null;
  /** Statute-of-limitations evaluation (Art. 149). */
  limitation: LimitationResult;

  legal_notes: LegalNote[];
  /** Guaranteed rights net of advance — EOSB + OT + Friday + holidays + notice + leave + women's rights − advance. */
  total_due: number;
}


// ----------------------------------------------------------------------------
// Date helpers
// ----------------------------------------------------------------------------

export function parseDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function toDateOnlyString(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Civil reckoning of years/months/days. The end date is counted as a
 * worked day, so the day component is increased by one. `fractional_years`
 * uses 365.25 days/year and drives EOSB math.
 */
export function computeServiceDuration(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): ServiceDuration {
  const s = start instanceof Date ? start : parseDateOnly(start ?? "");
  const e = end instanceof Date ? end : parseDateOnly(end ?? "");
  if (!s || !e || e.getTime() < s.getTime()) {
    return { years: 0, months: 0, days: 0, total_days: 0, total_months: 0, fractional_years: 0 };
  }
  const total_days = Math.floor((e.getTime() - s.getTime()) / MS_PER_DAY) + 1;

  let years = e.getFullYear() - s.getFullYear();
  let months = e.getMonth() - s.getMonth();
  let days = e.getDate() - s.getDate() + 1;

  if (days <= 0) {
    months -= 1;
    const prev = new Date(e.getFullYear(), e.getMonth(), 0);
    days += prev.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) { years = 0; months = 0; days = 0; }

  return {
    years, months, days, total_days,
    total_months: years * 12 + months,
    fractional_years: total_days / 365.25,
  };
}

// ----------------------------------------------------------------------------
// Legal notes (warnings)
// ----------------------------------------------------------------------------

export const UNFAIR_DISMISSAL_WARNING =
  "التعويض النهائي يحدده القضاء أو الجهة المختصة ولا يعتبر استحقاقاً نهائياً.";
export const UNUSED_LEAVE_WARNING =
  "بدل الإجازات تقدير قائم على المعطيات المُدخلة؛ قد تعدّله الجهة المختصة.";

// ----------------------------------------------------------------------------
// Core calculation
// ----------------------------------------------------------------------------

/** Normalise salary periods: clip to [start,end], drop invalid, sort. */
function normalisePeriods(
  s: Date,
  e: Date,
  periods: SalaryPeriod[] | undefined,
): { from: Date; to: Date; salary: number }[] {
  if (!periods || periods.length === 0) return [];
  return periods
    .map((p) => {
      const pf = parseDateOnly(p.from);
      const pt = parseDateOnly(p.to);
      if (!pf || !pt || pt.getTime() < pf.getTime()) return null;
      const from = pf.getTime() < s.getTime() ? s : pf;
      const to = pt.getTime() > e.getTime() ? e : pt;
      if (to.getTime() < from.getTime()) return null;
      return { from, to, salary: Number(p.salary) || 0 };
    })
    .filter((x): x is { from: Date; to: Date; salary: number } => !!x)
    .sort((a, b) => a.from.getTime() - b.from.getTime());
}

/**
 * EOSB (Art. 120) — ALWAYS based on the LAST actual monthly salary before
 * the end of service, multiplied by the fractional years of service.
 * Salary history is never averaged and never used here; it only affects
 * period-based entitlements (overtime, rest days, holidays).
 */
function computeEosb(
  startISO: string,
  endISO: string,
  finalSalary: number,
): { total: number; breakdown: CalculatorResult["eos_breakdown"] } {
  const s = parseDateOnly(startISO);
  const e = parseDateOnly(endISO);
  if (!s || !e || e.getTime() < s.getTime()) return { total: 0, breakdown: [] };
  const dur = computeServiceDuration(s, e);
  const total = finalSalary * dur.fractional_years;
  return {
    total,
    breakdown: [{
      from: startISO,
      to: endISO,
      salary: finalSalary,
      years: dur.fractional_years,
      amount: total,
    }],
  };
}

/** Monthly salary in force on a given date (falls back to the last salary). */
function salaryOnDate(
  dateISO: string,
  norm: { from: Date; to: Date; salary: number }[],
  finalSalary: number,
): number {
  const d = parseDateOnly(dateISO);
  if (!d) return finalSalary;
  for (const p of norm) {
    if (d.getTime() >= p.from.getTime() && d.getTime() <= p.to.getTime()) return p.salary;
  }
  return finalSalary;
}

/**
 * Time-weighted average monthly salary over the whole service. Used for
 * entitlements that accrue continuously (overtime hours, weekly-rest work)
 * where the wage in force during each period must be respected.
 */
function weightedAverageSalary(
  s: Date,
  e: Date,
  norm: { from: Date; to: Date; salary: number }[],
  finalSalary: number,
): number {
  const totalDays = Math.floor((e.getTime() - s.getTime()) / MS_PER_DAY) + 1;
  if (totalDays <= 0) return finalSalary;
  if (norm.length === 0) return finalSalary;
  let covered = 0;
  let weighted = 0;
  for (const p of norm) {
    const days = Math.floor((p.to.getTime() - p.from.getTime()) / MS_PER_DAY) + 1;
    covered += days;
    weighted += p.salary * days;
  }
  const gap = Math.max(0, totalDays - covered);
  weighted += finalSalary * gap;
  return weighted / totalDays;
}

/**
 * Women-workers module (Art. 43–46) — fully isolated: it is only evaluated
 * when gender === "female" and never alters the male calculation path.
 *
 *  • From the 6th month of pregnancy until 6 months after childbirth the
 *    legal working day is capped at 5 hours. Hours worked beyond that cap
 *    are overtime at 150 % of the hourly wage in force at the time.
 *  • Maternity leave: 60 days (normal birth) or 80 days (complicated birth
 *    or twins) at FULL pay. When the employer did not pay it, it is owed.
 */
function computeFemaleRights(
  input: CalculatorInput,
  norm: { from: Date; to: Date; salary: number }[],
  finalSalary: number,
): FemaleRightsResult | null {
  if (input.gender !== "female" || !input.had_pregnancy || !input.birth_date) return null;
  const birth = parseDateOnly(input.birth_date);
  if (!birth) return null;

  const reducedStart = new Date(birth.getTime());
  reducedStart.setMonth(reducedStart.getMonth() - 3); // ≈ start of 6th month
  const reducedEnd = new Date(birth.getTime());
  reducedEnd.setMonth(reducedEnd.getMonth() + 6); // nursing window

  const LEGAL_HOURS = 5;
  const actual = Math.max(0, Number(input.reduced_period_daily_hours) || 0);
  const extraPerDay = Math.max(0, actual - LEGAL_HOURS);
  const pregDays = Math.max(0, Number(input.pregnancy_days_worked) || 0);
  const lactDays = Math.max(0, Number(input.lactation_days_worked) || 0);
  const extraHours = extraPerDay * (pregDays + lactDays);

  const periodSalary = salaryOnDate(input.birth_date, norm, finalSalary);
  const periodDaily = periodSalary / 30;
  const periodHourly = periodDaily / 8;
  const extraAmount = extraHours * periodHourly * 1.5;

  const maternityDays = input.birth_type === "complicated" ? 80 : 60;
  const paid = input.maternity_leave_paid !== false;
  const maternityAmount = paid ? 0 : maternityDays * periodDaily;

  return {
    applies: true,
    birth_date: input.birth_date,
    birth_type: input.birth_type ?? "normal",
    reduced_start: toDateOnlyString(reducedStart),
    reduced_end: toDateOnlyString(reducedEnd),
    legal_daily_hours: LEGAL_HOURS,
    actual_daily_hours: actual,
    extra_hours_per_day: extraPerDay,
    pregnancy_days_worked: pregDays,
    lactation_days_worked: lactDays,
    extra_hours_total: extraHours,
    hourly_rate: periodHourly,
    extra_hours_amount: extraAmount,
    maternity_leave_days: maternityDays,
    maternity_leave_paid: paid,
    maternity_leave_amount: maternityAmount,
    total: extraAmount + maternityAmount,
  };
}


export function calculate(input: CalculatorInput): CalculatorResult {
  const finalSalary = Number(input.monthly_salary) || 0;
  const dur = computeServiceDuration(input.service_start_date, input.service_end_date);

  // Statutory base rates from the LAST salary: monthly ÷ 30 → daily, ÷ 8 → hourly.
  const daily_rate = finalSalary / 30;
  const hourly_rate = daily_rate / 8;

  // Historical wage basis — overtime and rest-day work are valued with the
  // wage actually in force during each period, not with the final salary.
  const _s = parseDateOnly(input.service_start_date);
  const _e = parseDateOnly(input.service_end_date);
  const norm = _s && _e ? normalisePeriods(_s, _e, input.salary_periods) : [];
  const avgSalary = _s && _e
    ? weightedAverageSalary(_s, _e, norm, finalSalary)
    : finalSalary;
  const historical_daily_rate = avgSalary / 30;
  const historical_hourly_rate = historical_daily_rate / 8;

  // -------- EOSB (Art. 120) — LAST salary only ------------------------------
  const eos = computeEosb(
    input.service_start_date,
    input.service_end_date,
    finalSalary,
  );
  const eos_benefit = eos.total;

  // -------- Overtime (Art. 56) ----------------------------------------------
  // Day overtime = 150 %, Night overtime = 200 % (no compounding), valued at
  // the historical (period-weighted) hourly wage.
  const day_overtime_amount =
    (Number(input.day_overtime_hours) || 0) * historical_hourly_rate * 1.5;
  const night_overtime_amount =
    (Number(input.night_overtime_hours) || 0) * historical_hourly_rate * 2.0;

  // -------- Friday / weekly rest (Art. 77) ----------------------------------
  // If the worker worked on Friday without compensatory rest, double pay is
  // owed. We assume one Friday per week over the whole service, capped by the
  // hours actually worked on Fridays as supplied by the user.
  let friday_compensation = 0;
  if (input.friday_off === false && (input.friday_worked_hours ?? 0) > 0) {
    const fridaysWorked = Math.floor(dur.total_days / 7);
    const hoursPerFriday = Number(input.friday_worked_hours) || 0;
    // 200 % rate = base + 100 % premium.
    const gross = fridaysWorked * hoursPerFriday * historical_hourly_rate * 2;
    const alreadyPaid = input.friday_paid
      ? (Number(input.friday_pay_received) || 0)
      : 0;
    friday_compensation = Math.max(0, gross - alreadyPaid);
  }


  // -------- Notice indemnity (Art. 35) --------------------------------------
  // Owed when the employer terminated (dismissal / unfair / dismissal during
  // pregnancy or nursing) without giving sufficient notice. Resignation by
  // the worker is excluded.
  let notice_indemnity = 0;
  const employerTerminated =
    input.termination_reason === "dismissal" ||
    input.termination_reason === "unfair" ||
    input.termination_reason === "dismissal_pregnancy" ||
    input.termination_reason === "dismissal_lactation";
  if (employerTerminated) {
    const monthsGiven = input.notice_given ? Number(input.notice_months) || 0 : 0;
    const shortfall = Math.max(0, 1 - monthsGiven); // statutory minimum: 1 month
    notice_indemnity = finalSalary * shortfall;
  }

  // -------- Annual leave (Art. 79) ------------------------------------------
  // Derive unused days from the wizard's status if provided, otherwise use
  // the explicit unused_leave_days field (back-compat).
  let unused_days = Number(input.unused_leave_days) || 0;
  if (input.annual_leave_status) {
    const entitled = 30 * dur.fractional_years;
    if (input.annual_leave_status === "full") unused_days = 0;
    else if (input.annual_leave_status === "none") unused_days = Math.round(entitled);
    else if (input.annual_leave_status === "partial") {
      const received = Number(input.annual_leave_days_received) || 0;
      unused_days = Math.max(0, Math.round(entitled - received));
    }
  }
  const leave_compensation = unused_days * daily_rate;

  // -------- Sick leave (Art. 80) --------------------------------------------
  const sick_leave = computeSickLeave(Number(input.sick_leave_days) || 0, daily_rate);

  // -------- Statute of limitations (Art. 149) -------------------------------
  const limitation = computeLimitation(input);



  // -------- Unfair-dismissal estimate (court determined) --------------------
  const pregnancyDismissal =
    input.gender === "female" &&
    (input.termination_reason === "dismissal_pregnancy" ||
      input.termination_reason === "dismissal_lactation");
  const claimsUnfair =
    input.termination_reason === "unfair" ||
    input.unfair_dismissal === true ||
    pregnancyDismissal;
  const unfair_dismissal_compensation = claimsUnfair ? finalSalary * 6 : 0;

  // -------- EOSB advance deduction ------------------------------------------
  const eosb_advance_deduction = Math.max(0, Number(input.eosb_received) || 0);

  // -------- Women-workers module (isolated) ---------------------------------
  const female_rights = computeFemaleRights(input, norm, finalSalary);

  // -------- Legal notes ------------------------------------------------------
  const legal_notes: LegalNote[] = [];
  if (claimsUnfair) {
    legal_notes.push({
      key: "unfair_dismissal",
      title: "تعويض الفصل التعسفي — المادة 39",
      amount: unfair_dismissal_compensation,
      formula: "آخر راتب شهري × 6",
      warning: UNFAIR_DISMISSAL_WARNING,
    });
  }
  if (pregnancyDismissal) {
    legal_notes.push({
      key: "pregnancy_dismissal",
      title:
        input.termination_reason === "dismissal_pregnancy"
          ? "الفصل أثناء الحمل — المادة 46"
          : "الفصل أثناء إجازة الوضع/الرضاعة — المادة 46",
      amount: unfair_dismissal_compensation,
      formula: "آخر راتب شهري × 6 (تقدير استرشادي)",
      warning:
        "يحظر قانون العمل اليمني فصل العاملة بسبب الحمل أو الولادة أو أثناء إجازة الوضع؛ يعتبر الفصل باطلاً ويستوجب التعويض بتقدير القضاء.",
    });
  }

  // -------- Official holiday work (200 %) -----------------------------------
  // Preferred path: per-holiday entries valued with the wage in force on the
  // holiday date. Falls back to the legacy aggregate `holiday_days_worked`.
  let holiday_compensation = 0;
  const holiday_breakdown: NonNullable<CalculatorResult["holiday_breakdown"]> = [];
  if (Array.isArray(input.holiday_entries) && input.holiday_entries.length > 0) {
    for (const h of input.holiday_entries) {
      if (!h.worked || h.daysWorked <= 0) continue;
      const days = Math.min(h.daysWorked, h.totalDays);
      const hrs = Math.max(0, h.hoursPerDay);
      const salaryThen = salaryOnDate(h.start, norm, finalSalary);
      const dailyThen = salaryThen / 30;
      const hourlyThen = dailyThen / 8;
      const amount = hrs > 0
        ? days * hrs * hourlyThen * 2
        : days * dailyThen * 2;
      holiday_compensation += amount;
      holiday_breakdown.push({
        id: h.id, name: h.name, year: h.year,
        start: h.start, end: h.end,
        totalDays: h.totalDays,
        daysWorked: days,
        hoursPerDay: hrs,
        amount,
        salary: salaryThen,
      });
    }
  } else {
    const holiday_days_worked = Math.max(0, Number(input.holiday_days_worked) || 0);
    holiday_compensation = holiday_days_worked * historical_daily_rate * 2;
  }

  // -------- Total ------------------------------------------------------------
  // Guaranteed rights only. Unfair-dismissal estimate is excluded and shown
  // separately in legal_notes. EOSB advance already received is subtracted.
  const gross_due =
    eos_benefit +
    day_overtime_amount +
    night_overtime_amount +
    friday_compensation +
    holiday_compensation +
    notice_indemnity +
    leave_compensation +
    (female_rights?.total || 0);
  const total_due = Math.max(0, gross_due - eosb_advance_deduction);

  return {
    ...dur,
    daily_rate,
    hourly_rate,
    historical_daily_rate,
    historical_hourly_rate,
    total_service_years: dur.fractional_years,
    eos_benefit,
    eos_breakdown: eos.breakdown,
    day_overtime_amount,
    night_overtime_amount,
    friday_compensation,
    holiday_compensation,
    holiday_breakdown,
    notice_indemnity,
    leave_compensation,
    unfair_dismissal_compensation,
    eosb_advance_deduction,
    female_rights,
    sick_leave,
    limitation,
    legal_notes,
    total_due,

  };
}


// ----------------------------------------------------------------------------
// Sick leave — Yemeni Labour Law No. (5) of 1995, Art. 80
// ----------------------------------------------------------------------------

/** Statutory pay scale: first 60 d at 100 %, then 85 %, 75 %, 50 %, then unpaid. */
export const SICK_LEAVE_TIERS: { label: string; length: number; rate: number }[] = [
  { label: "من اليوم 1 إلى 60", length: 60, rate: 1 },
  { label: "من اليوم 61 إلى 120", length: 60, rate: 0.85 },
  { label: "من اليوم 121 إلى 180", length: 60, rate: 0.75 },
  { label: "من اليوم 181 إلى 240", length: 60, rate: 0.5 },
];

/**
 * Tiered sick-leave pay for a single year. Pure and offline-safe.
 * Days beyond 240 are unpaid (100 % deduction).
 */
export function computeSickLeave(days: number, daily_rate: number): SickLeaveResult | null {
  const total = Math.max(0, Math.floor(Number(days) || 0));
  if (total <= 0) return null;

  const tiers: SickLeaveTier[] = [];
  let remaining = total;
  for (const t of SICK_LEAVE_TIERS) {
    if (remaining <= 0) break;
    const d = Math.min(remaining, t.length);
    remaining -= d;
    const full = d * daily_rate;
    const amount = full * t.rate;
    tiers.push({ label: t.label, days: d, rate: t.rate, amount, deduction: full - amount });
  }
  if (remaining > 0) {
    const full = remaining * daily_rate;
    tiers.push({
      label: "ما زاد عن 240 يوماً",
      days: remaining,
      rate: 0,
      amount: 0,
      deduction: full,
    });
  }

  const paid_amount = tiers.reduce((s, t) => s + t.amount, 0);
  const deduction_amount = tiers.reduce((s, t) => s + t.deduction, 0);
  return {
    applies: true,
    days: total,
    daily_rate,
    tiers,
    paid_amount,
    deduction_amount,
    full_pay_amount: total * daily_rate,
  };
}


// ----------------------------------------------------------------------------
// Statute of limitations — one Gregorian year after the employment ends
// ----------------------------------------------------------------------------

export function computeLimitation(
  input: Pick<CalculatorInput, "employment_status" | "service_end_date">,
  today: Date = new Date(),
): LimitationResult {
  const ongoing = input.employment_status === "ongoing";
  const end = parseDateOnly(input.service_end_date);
  if (ongoing || !end) {
    return {
      ongoing: true,
      end_date: input.service_end_date || null,
      deadline: null,
      days_remaining: null,
      status: "not_started",
    };
  }
  const deadline = new Date(end);
  deadline.setFullYear(deadline.getFullYear() + 1);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days_remaining = Math.ceil(
    (startOfDay(deadline).getTime() - startOfDay(today).getTime()) / 86400000,
  );
  const status: LimitationResult["status"] =
    days_remaining < 0 ? "expired" : days_remaining <= 30 ? "expiring" : "valid";
  return {
    ongoing: false,
    end_date: toDateOnlyString(end),
    deadline: toDateOnlyString(deadline),
    days_remaining,
    status,
  };
}



// ----------------------------------------------------------------------------
// Formatting helpers
// ----------------------------------------------------------------------------

export function formatServiceDuration(d: ServiceDuration): string {
  if (d.total_days <= 0) return "—";
  const parts: string[] = [];
  if (d.years > 0) parts.push(`${d.years} سنة`);
  if (d.months > 0) parts.push(`${d.months} شهر`);
  if (d.days > 0) parts.push(`${d.days} يوم`);
  return parts.join(" و ") || "—";
}

export function currencySuffix(c: Currency | string | null | undefined): string {
  const found = CURRENCIES.find((x) => x.value === c);
  return found?.suffix ?? "ر.ي";
}

/**
 * Format a monetary amount as an English-digit number with thousands
 * separators and NO decimals — applied uniformly across UI, PDF and
 * verification surfaces.
 */
export function formatCurrency(n: number, c: Currency | string | null | undefined = "YER"): string {
  const safe = Number.isFinite(n) ? n : 0;
  const rounded = Math.round(safe);
  const value = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(rounded);
  return `${value} ${currencySuffix(c)}`;
}

/** @deprecated Use formatCurrency(n, currency) instead. */
export function formatYER(n: number): string {
  return formatCurrency(n, "YER");
}

export function formatDateAr(s: string | Date | null | undefined): string {
  const d = s instanceof Date ? s : parseDateOnly(s ?? "");
  if (!d) return "—";
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}
