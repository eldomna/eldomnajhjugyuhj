import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SaComputeResponse } from "./types";

const wageSchema = z.object({
  basic: z.number().min(0).max(10_000_000),
  housing: z.number().min(0).max(10_000_000),
  transport: z.number().min(0).max(10_000_000),
  otherFixed: z.number().min(0).max(10_000_000),
});

const caseSchema = z.object({
  nationality: z.enum(["saudi", "non_saudi"]),
  jobTitle: z.string().trim().min(2).max(120),
  sector: z.string().trim().min(2).max(120),
  startDate: z.string().trim().min(8).max(10),
  endDate: z.string().trim().min(8).max(10),
  employeeName: z.string().trim().max(120).optional(),
  employerName: z.string().trim().max(120).optional(),
  includeNamesInReport: z.boolean().optional(),

  contractType: z.enum(["fixed", "indefinite"]),
  contractTermEnd: z.string().trim().max(10).nullable().optional(),
  renewals: z.number().int().min(0).max(50),
  paidMonthly: z.boolean(),

  hasProbation: z.boolean(),
  probationDays: z.number().int().min(0).max(365),
  probationWritten: z.boolean(),
  endedDuringProbation: z.boolean(),

  wage: wageSchema,

  dailyHours: z.number().min(1).max(24).nullable(),
  workDaysPerWeek: z.number().min(1).max(7).nullable(),
  ramadanApplies: z.boolean(),
  ramadanDailyHours: z.number().min(1).max(24).nullable(),

  overtimeHours: z.number().min(0).max(100_000),
  holidayWork: z
    .array(z.object({ date: z.string().trim().max(10), name: z.string().trim().max(120).optional(), hours: z.number().min(0).max(24) }))
    .max(200),
  unpaidWages: z
    .array(
      z.object({
        label: z.string().trim().max(120),
        amount: z.number().min(0).max(10_000_000),
        dueDate: z.string().trim().max(10),
        paid: z.boolean(),
      }),
    )
    .max(200),

  annualLeaveEntitledDays: z.number().min(0).max(3000).nullable(),
  annualLeaveUsedDays: z.number().min(0).max(3000),
  sickLeaveDays: z.number().min(0).max(1000),

  gender: z.enum(["male", "female"]),
  female: z.object({
    birthDate: z.string().trim().max(10).nullable(),
    maternityStart: z.string().trim().max(10).nullable(),
    maternityEnd: z.string().trim().max(10).nullable(),
    maternityPaid: z.boolean(),
    nursingClaimed: z.boolean(),
    nursingMonths: z.number().min(0).max(120),
    terminatedDuringMaternity: z.boolean(),
  }),

  gosiSubscribed: z.boolean(),
  gosiMonths: z.number().min(0).max(600),
  gosiSubjectWageOverride: z.number().min(0).max(10_000_000).nullable(),

  terminationReason: z.enum([
    "employer_termination",
    "unlawful_termination",
    "resignation",
    "mutual",
    "contract_expiry",
    "during_probation",
  ]),
  terminationNoticeDate: z.string().trim().max(10).nullable(),
  noticeGiven: z.boolean(),
  noticeDaysGiven: z.number().int().min(0).max(365),
  resignation: z.object({
    submittedDate: z.string().trim().max(10).nullable(),
    effectiveDate: z.string().trim().max(10).nullable(),
    written: z.boolean(),
    acceptance: z.enum(["none", "accepted", "rejected"]),
    qiwaSubmitted: z.boolean(),
  }),

  settlements: z
    .array(
      z.object({
        date: z.string().trim().max(10),
        amount: z.number().min(0).max(10_000_000),
        kind: z.string().trim().max(60),
        method: z.enum(["bank_transfer", "signed_release", "e_document", "receipt", "cash", "other"]),
        hasDocuments: z.boolean(),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .max(100),

  dispute: z.object({
    exists: z.boolean(),
    amount: z.number().min(0).max(10_000_000),
    coveredKeys: z.array(z.string().trim().max(40)).max(30),
    note: z.string().trim().max(500).optional(),
  }),
});


/** تنفيذ الحساب السعودي بالكامل على الخادم مع فرض صلاحيات الاشتراك. */
export const computeSaudiCaseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ input: caseSchema, save: z.boolean().default(true) }).parse(d))
  .handler(async ({ data, context }): Promise<SaComputeResponse> => {
    const { supabase, userId } = context;

    // 1) صلاحيات المستخدم — تُقرأ من قاعدة البيانات لا من الواجهة.
    const { data: entRows } = await supabase.rpc("get_platform_entitlements");
    const ent: any = Array.isArray(entRows) ? entRows[0] : null;
    const planCode: string = ent?.plan_code ?? "free";
    const engines: string[] = ent?.engines ?? ["sa"];
    if (!engines.includes("sa")) throw new Error("باقتك الحالية لا تشمل الحاسبة السعودية");

    const full = planCode !== "free" && !!ent?.show_details;

    // 2) تحميل القواعد النظامية من قاعدة البيانات (لا شيء مثبت في الكود).
    const { data: settingsRows } = await supabase.from("sa_regulatory_settings").select("key,value");
    const settings: Record<string, any> = {};
    for (const r of settingsRows ?? []) settings[(r as any).key] = (r as any).value;

    const { computeSaudiCase, validateSaCase } = await import("./engine.server");

    // 3) المراجعة المرحلية قبل استهلاك أي رصيد أو إظهار نتائج.
    const validation = validateSaCase(data.input as any, settings);
    if (!validation.ok) {
      return { invalid: true, issues: validation.issues };
    }

    // 4) الحسبة المنفردة تستهلك رصيداً بعد اجتياز المراجعة.
    if (planCode === "single") {
      const { data: ok } = await supabase.rpc("consume_calc_credit");
      if (!ok) throw new Error("انتهى رصيد الحسبة المنفردة. يرجى شراء باقة جديدة.");
    }

    const result = computeSaudiCase(data.input as any, settings);


    // 4) التجربة المجانية: الخادم لا يرسل أي تفاصيل إلى المتصفح.
    if (!full) {
      return { restricted: true, result: { currency: "SAR", total: result.total, restricted: true }, caseId: null, planCode };
    }

    let caseId: string | null = null;
    if (data.save) {
      const { data: row } = await supabase
        .from("sa_cases")
        .insert({
          user_id: userId,
          employee_name: data.input.employeeName ?? null,
          employer_name: data.input.employerName ?? null,
          nationality: data.input.nationality,
          job_title: data.input.jobTitle,
          sector: data.input.sector,
          start_date: data.input.startDate,
          end_date: data.input.endDate,
          total_amount: result.total,
          currency: "SAR",
          plan_code: planCode,
          input: data.input as any,
          result: result as any,
        })
        .select("id")
        .single();
      caseId = row?.id ?? null;

      if (caseId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("sa_case_audit").insert(
          result.audit.map((a) => ({
            case_id: caseId,
            user_id: userId,
            step: a.step,
            decision: a.decision,
            reason: a.reason,
          })),
        );
      }
    }

    return { restricted: false, result, caseId, planCode };
  });

/** جلب الإجازات الرسمية المعتمدة لعرضها في المعالج. */
export const listSaHolidays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("sa_official_holidays")
      .select("id,name,kind,start_date,end_date")
      .eq("is_active", true)
      .order("start_date");
    return data ?? [];
  });

/** قضايا المستخدم المحفوظة. */
export const listSaCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("sa_cases")
      .select("id,employee_name,employer_name,job_title,sector,start_date,end_date,total_amount,currency,created_at,result")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });
