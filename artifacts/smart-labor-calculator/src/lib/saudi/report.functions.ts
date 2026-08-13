import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapStoredReport, sha256Hex, type SaStoredReport } from "./report-helpers";

export type { SaStoredReport } from "./report-helpers";

/** إصدار التقرير النهائي وتخزينه بشكل غير قابل للتعديل. */
export const generateSaReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SaStoredReport> => {
    const { supabase, userId } = context;

    const { data: entRows } = await supabase.rpc("get_platform_entitlements");
    const ent: any = Array.isArray(entRows) ? entRows[0] : null;
    const planCode: string = ent?.plan_code ?? "free";
    if (!ent?.allow_pdf) throw new Error("تصدير التقرير غير متاح في باقتك الحالية. يرجى ترقية الاشتراك.");

    const { data: row, error } = await supabase
      .from("sa_cases")
      .select("id,user_id,input,result,created_at")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.user_id !== userId) throw new Error("لا توجد حسبة مطابقة لهذا المستخدم");

    // الباقة المنفردة: تقرير واحد لكل حسبة — يُعاد التقرير المخزّن نفسه.
    const { data: existing } = await supabase
      .from("sa_reports")
      .select("*")
      .eq("case_id", data.caseId)
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && planCode === "single") return mapStoredReport(existing);

    const { data: settingsRows } = await supabase.from("sa_regulatory_settings").select("key,updated_at");
    const settingsVersion =
      (settingsRows ?? [])
        .map((s: any) => s.updated_at as string)
        .sort()
        .pop() ?? new Date().toISOString();

    const { data: platform } = await supabase
      .from("platform_settings")
      .select("platform_name,logo_url")
      .eq("id", 1)
      .maybeSingle();

    const { buildSaReportDocument } = await import("./report-builder.server");
    const createdAt = new Date().toISOString();
    const version = (existing?.version ?? 0) + 1;
    const year = new Date().getUTCFullYear();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const serial = Date.now().toString().slice(-8);
    const reportNumber = `SA-${year}-${serial}-V${version}`;

    const doc = buildSaReportDocument(row.input as any, row.result as any, {
      reportNumber,
      version,
      planCode,
      showDetails: !!ent?.show_details,
      showLegalRefs: !!ent?.show_legal_refs,
      caseId: row.id,
      platformName: platform?.platform_name ?? "حاسبة العمال الذكية",
      logoUrl: platform?.logo_url ?? null,
      createdAt,
      settingsVersion,
    });

    const checksum = await sha256Hex(JSON.stringify(doc));

    const { data: inserted, error: insErr } = await supabase
      .from("sa_reports")
      .insert({
        report_number: reportNumber,
        version,
        case_id: row.id,
        user_id: userId,
        plan_code: planCode,
        employee_label: doc.parties.employee,
        employer_label: doc.parties.employer,
        net_total: doc.summary.netTotal,
        gross_total: doc.summary.grossTotal,
        deductions_total: doc.summary.deductionsTotal,
        currency: "SAR",
        document: doc as any,
        checksum,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("sa_case_audit").insert({
      case_id: row.id,
      user_id: userId,
      step: "report.issue",
      decision: reportNumber,
      reason: `إصدار التقرير النهائي (إصدار ${version}) — الباقة ${planCode}`,
      data: { checksum, templateVersion: doc.templateVersion, settingsVersion } as any,
    });

    return mapStoredReport(inserted);
  });

/** تقارير المستخدم المحفوظة. */
export const listMySaReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SaStoredReport[]> => {
    const { data } = await context.supabase
      .from("sa_reports")
      .select("*")
      .eq("user_id", context.userId)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map(mapStoredReport);
  });

/** إعادة تنزيل تقرير سابق دون إعادة الحساب. */
export const getSaReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SaStoredReport> => {
    const { data: row, error } = await context.supabase.from("sa_reports").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("التقرير غير موجود");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("sa_reports")
      .update({ downloads: (row.downloads ?? 0) + 1 })
      .eq("id", row.id);
    return mapStoredReport(row);
  });

/** سجل التقارير للمشرفين مع بحث وتصفية. */
export const adminListSaReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        planCode: z.string().trim().max(30).optional(),
        from: z.string().trim().max(10).optional(),
        to: z.string().trim().max(10).optional(),
        archived: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("صلاحية المشرف مطلوبة");

    let q = context.supabase
      .from("sa_reports")
      .select("id,report_number,version,case_id,user_id,plan_code,employee_label,employer_label,net_total,currency,checksum,downloads,archived,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.planCode) q = q.eq("plan_code", data.planCode);
    if (typeof data.archived === "boolean") q = q.eq("archived", data.archived);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59`);
    if (data.search) q = q.or(`report_number.ilike.%${data.search}%,employee_label.ilike.%${data.search}%,employer_label.ilike.%${data.search}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** أرشفة أو استرجاع تقرير — للمشرفين فقط، دون تعديل محتواه. */
export const adminArchiveSaReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sa_reports").update({ archived: data.archived }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** سجل التدقيق الخاص بحسبة معيّنة — للمشرفين. */
export const adminSaCaseAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sa_case_audit")
      .select("id,step,decision,reason,created_at")
      .eq("case_id", data.caseId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
