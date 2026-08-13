// ============================================================================
// Yemen public-holiday catalog with Hijri ↔ Gregorian conversion.
//
//   • Eid al-Fitr — 29 Ramadan (تحري) → 3 Shawwal (4 days)
//   • Eid al-Adha — 9 Dhul-Hijja (يوم عرفة) → 13 Dhul-Hijja (5 days)
//   • Hijri New Year — 1 Muharram (1 day)
//   • Mawlid — 12 Rabi' al-Awwal (1 day)
//   • Labor Day — 1 May (Gregorian, 1 day)
//   • 22 May, 26 Sept, 14 Oct, 30 Nov — Gregorian fixed (1 day each)
//
// Weekly rest depends on sector:
//   private  → Friday off (6 working days)
//   public   → Thursday + Friday off (5 working days)
//
// When a holiday day overlaps the weekly rest, the worker is compensated
// with an additional day appended to the end of the holiday (تعويض اليوم).
// ============================================================================

export type Sector = "private" | "public";

export interface HolidayInstance {
  /** Stable id: `${kind}|${year}`. */
  id: string;
  /** UI label like "عيد الفطر". */
  name: string;
  /** Calendar (Gregorian) year the holiday begins. */
  year: number;
  /** ISO YYYY-MM-DD — start of the holiday. */
  start: string;
  /** ISO YYYY-MM-DD — end of the holiday (inclusive, after compensation). */
  end: string;
  /** Original duration without compensation. */
  baseDays: number;
  /** Number of days appended because of weekly-rest overlap. */
  compDays: number;
  /** Total days = baseDays + compDays. */
  totalDays: number;
  /** Dates that fell on a weekly-rest day. */
  overlapDates: string[];
}

// ---------------------------------------------------------------------------
// Hijri converter using Intl.DateTimeFormat('islamic-umalqura').
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function hijriPartsOf(d: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
  let y = 0, m = 0, dd = 0;
  for (const p of fmt.formatToParts(d)) {
    if (p.type === "year") y = parseInt(p.value, 10);
    else if (p.type === "month") m = parseInt(p.value, 10);
    else if (p.type === "day") dd = parseInt(p.value, 10);
  }
  return { y, m, d: dd };
}

/** Convert a Hijri (Umm al-Qura) date to a Gregorian UTC Date. */
export function hijriToGregorian(hy: number, hm: number, hd: number): Date {
  // Coarse estimate — Hijri epoch ≈ 622-07-16 CE.
  const epoch = Date.UTC(622, 6, 16);
  const approx = (hy - 1) * 354.367 + (hm - 1) * 29.5 + (hd - 1);
  let d = new Date(epoch + Math.round(approx) * 86400000);
  // Two passes of coarse adjustment then a fine sweep.
  for (let i = 0; i < 5; i++) {
    const p = hijriPartsOf(d);
    const delta = (hy - p.y) * 354 + (hm - p.m) * 30 + (hd - p.d);
    if (delta === 0) break;
    d = new Date(d.getTime() + delta * 86400000);
  }
  for (let i = 0; i < 60; i++) {
    const p = hijriPartsOf(d);
    if (p.y === hy && p.m === hm && p.d === hd) return d;
    const cmp = (p.y - hy) * 1_000_000 + (p.m - hm) * 1_000 + (p.d - hd);
    d = new Date(d.getTime() + (cmp > 0 ? -1 : 1) * 86400000);
  }
  return d;
}

// ---------------------------------------------------------------------------
// Holiday generation
// ---------------------------------------------------------------------------

interface HolidaySpec {
  kind: string;
  name: string;
  /** Returns the start UTC Date for the given (Hijri or Gregorian) year. */
  start: (year: number) => Date;
  /** Base duration in days. */
  days: number;
  /** Whether `year` refers to a Hijri or Gregorian year. */
  calendar: "hijri" | "gregorian";
}

const SPECS: HolidaySpec[] = [
  { kind: "eid_fitr",  name: "عيد الفطر",          calendar: "hijri",     days: 4, start: (h) => hijriToGregorian(h, 9, 29) },
  { kind: "eid_adha",  name: "عيد الأضحى",         calendar: "hijri",     days: 5, start: (h) => hijriToGregorian(h, 12, 9) },
  { kind: "hijri_new", name: "رأس السنة الهجرية",  calendar: "hijri",     days: 1, start: (h) => hijriToGregorian(h, 1, 1) },
  { kind: "mawlid",    name: "المولد النبوي",      calendar: "hijri",     days: 1, start: (h) => hijriToGregorian(h, 3, 12) },
  { kind: "labor",     name: "عيد العمال",         calendar: "gregorian", days: 1, start: (y) => new Date(Date.UTC(y, 4, 1)) },
  { kind: "may22",     name: "عيد الوحدة (22 مايو)",calendar: "gregorian",days: 1, start: (y) => new Date(Date.UTC(y, 4, 22)) },
  { kind: "sep26",     name: "ثورة 26 سبتمبر",     calendar: "gregorian", days: 1, start: (y) => new Date(Date.UTC(y, 8, 26)) },
  { kind: "oct14",     name: "ثورة 14 أكتوبر",     calendar: "gregorian", days: 1, start: (y) => new Date(Date.UTC(y, 9, 14)) },
  { kind: "nov30",     name: "عيد الاستقلال (30 نوفمبر)", calendar: "gregorian", days: 1, start: (y) => new Date(Date.UTC(y, 10, 30)) },
];

const MS = 86400000;

function isRestDay(d: Date, sector: Sector): boolean {
  // getUTCDay: 0=Sun, 4=Thu, 5=Fri.
  const dow = d.getUTCDay();
  if (sector === "private") return dow === 5;
  return dow === 4 || dow === 5;
}

/** Expand `start` + `baseDays` into the actual holiday window with weekly-rest
 *  compensation appended. The loop adds an extra day for each overlap day,
 *  re-checking the appended days too (they might also fall on rest days). */
function expandWithCompensation(start: Date, baseDays: number, sector: Sector) {
  const dates: Date[] = [];
  const overlapDates: string[] = [];
  let compDays = 0;
  let i = 0;
  // Cap iterations to avoid infinite growth in pathological cases.
  while (dates.length < baseDays + compDays && i < baseDays + 14) {
    const d = new Date(start.getTime() + i * MS);
    dates.push(d);
    if (i < baseDays && isRestDay(d, sector)) {
      // Original holiday day fell on weekly rest → append one comp day.
      overlapDates.push(toISO(d));
      compDays += 1;
    }
    i++;
  }
  return { dates, compDays, overlapDates };
}

/** All holiday instances whose START date lies inside [from,to]. */
export function buildHolidayInstances(
  fromISO: string,
  toISO_: string,
  sector: Sector,
): HolidayInstance[] {
  const from = new Date(`${fromISO}T00:00:00Z`);
  const to = new Date(`${toISO_}T00:00:00Z`);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return [];

  // Hijri year range that overlaps [from,to], with a 1-year safety margin.
  const hyA = hijriPartsOf(from).y - 1;
  const hyB = hijriPartsOf(to).y + 1;
  const gyA = from.getUTCFullYear();
  const gyB = to.getUTCFullYear();

  const out: HolidayInstance[] = [];

  for (const spec of SPECS) {
    const yearA = spec.calendar === "hijri" ? hyA : gyA;
    const yearB = spec.calendar === "hijri" ? hyB : gyB;
    for (let y = yearA; y <= yearB; y++) {
      let start: Date;
      try { start = spec.start(y); } catch { continue; }
      if (start < from || start > to) continue;
      const { dates, compDays, overlapDates } = expandWithCompensation(start, spec.days, sector);
      const end = dates[dates.length - 1] ?? start;
      const gregYear = start.getUTCFullYear();
      out.push({
        id: `${spec.kind}|${gregYear}`,
        name: spec.name,
        year: gregYear,
        start: toISO(start),
        end: toISO(end),
        baseDays: spec.days,
        compDays,
        totalDays: spec.days + compDays,
        overlapDates,
      });
    }
  }

  out.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}

export const SECTOR_LABEL: Record<Sector, string> = {
  private: "قطاع خاص — 6 أيام عمل، الجمعة عطلة",
  public:  "قطاع حكومي — 5 أيام عمل، الخميس والجمعة عطلة",
};
