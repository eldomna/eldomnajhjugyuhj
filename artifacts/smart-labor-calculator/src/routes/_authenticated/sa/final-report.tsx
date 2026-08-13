import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ContactBar } from "@/components/ContactBar";
import { FooterAttribution } from "@/components/FooterAttribution";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Archive,
  ArrowLeft,
  Braces,
  Eye,
  FileSpreadsheet,
  FileText,
  FileType2,
  Link2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import type { CalcSources } from "@/lib/saudi/calcEngine";
import {
  DEFAULT_FINAL_REPORT_POLICY,
  DEFAULT_REPORT_OPTIONS,
  buildFinalReport,
  buildReportNumber,
  hashDocument,
  reportMoney,
  toFinalReportPolicy,
  type FinalReportDocument,
  type ReportOptions,
} from "@/lib/saudi/finalReport";
import {
  downloadReportDocx,
  downloadReportHtml,
  downloadReportJson,
  downloadReportPdf,
  downloadReportXlsx,
  renderFinalReportHtml,
} from "@/lib/saudi/finalReportExport";

export const Route = createFileRoute("/_authenticated/sa/final-report")({
  head: () => ({
    meta: [
      { title: "التقرير القانوني النهائي — الخطوة 16 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة السادسة عشرة: إصدار التقرير القانوني النهائي الشامل بجميع الحقوق المحتسبة والمعادلات والمواد النظامية والتنبيهات، مع تصدير PDF وWord وExcel وJSON وHTML وبصمة تحقق QR.",
      },
      { property: "og:title", content: "التقرير القانوني النهائي — الخطوة 16" },
      {
        property: "og:description",
        content:
          "تقرير قانوني احترافي يجمع نتائج محرك الحساب وجميع الوحدات مع سجل تدقيق ونسخة مؤرشفة غير قابلة للتعديل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinalReportStep,
});

function FinalReportStep() {
  const draft = useCaseDraft("SA", 16);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [options, setOptions] = useState<ReportOptions>(DEFAULT_REPORT_OPTIONS);
  const [doc, setDoc] = useState<FinalReportDocument | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const set = <K extends keyof ReportOptions>(key: K, value: ReportOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  /* ---------- الإعدادات والقواعد ---------- */

  const settingsQuery = useQuery({
    queryKey: ["sa-final-report-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sa_regulatory_settings").select("key, value");
      if (error) throw error;
      const rows = data ?? [];
      const map = new Map(rows.map((r) => [r.key as string, r.value]));
      const versions: Record<string, string> = {};
      rows.forEach((r) => {
        const v = (r.value as Record<string, unknown> | null)?.["version"];
        if (typeof v === "string" && v) versions[r.key as string] = v;
      });
      return { policy: toFinalReportPolicy(map.get("final_report")), versions };
    },
  });

  const platformQuery = useQuery({
    queryKey: ["platform-settings-report"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("platform_name, logo_url")
        .eq("id", 1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const roleQuery = useQuery({
    queryKey: ["report-role"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      if (!uid) return { uid: null, email: "", privileged: false };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const roles = (data ?? []).map((r) => String(r.role));
      return {
        uid,
        email: userRes.user?.email ?? "",
        privileged: roles.includes("admin") || roles.includes("lawyer"),
      };
    },
  });

  /* ---------- مصادر البيانات ---------- */

  const one = (table: string, key: string) =>
    useQuery({
      queryKey: [key, caseId],
      enabled: !!caseId,
      queryFn: async () => {
        const { data, error } = await supabase
          .from(table as never)
          .select("*")
          .eq("case_id", caseId!)
          .maybeSingle();
        if (error) throw error;
        return (data ?? null) as Record<string, unknown> | null;
      },
    });

  const many = (table: string, key: string) =>
    useQuery({
      queryKey: [key, caseId],
      enabled: !!caseId,
      queryFn: async () => {
        const { data, error } = await supabase
          .from(table as never)
          .select("*")
          .eq("case_id", caseId!);
        if (error) throw error;
        return (data ?? []) as Record<string, unknown>[];
      },
    });

  const contracts = many("case_contracts", "fr-contracts");
  const trialPeriods = many("contract_trial_periods", "fr-trial");
  const salary = one("case_salaries", "fr-salary");
  const workingHours = one("case_working_hours", "fr-hours");
  const termination = one("case_termination", "fr-termination");
  const unpaid = many("case_unpaid_salaries", "fr-unpaid");
  const overtime = many("case_overtime", "fr-overtime");
  const holidayWork = many("case_holiday_work", "fr-holiday");
  const leaveSettlement = one("case_leave_settlement", "fr-leave");
  const sickLeave = one("case_sick_leave_summary", "fr-sick");
  const maternity = one("case_maternity_summary", "fr-maternity");
  const eosb = one("case_eosb", "fr-eosb");
  const compensation = many("case_compensation", "fr-compensation");
  const socialInsurance = one("case_social_insurance", "fr-si");
  const settlements = many("case_final_settlement", "fr-settlements");
  const payments = many("case_settlement_payments", "fr-payments");

  const calcQuery = useQuery({
    queryKey: ["fr-calculation", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_calculations")
        .select("*")
        .eq("case_id", caseId!)
        .order("calculation_version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["fr-reports", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_final_reports")
        .select("*")
        .eq("case_id", caseId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const loading =
    draft.loading || settingsQuery.isLoading || calcQuery.isLoading || reportsQuery.isLoading;

  const policy = settingsQuery.data?.policy ?? DEFAULT_FINAL_REPORT_POLICY;
  const calc = calcQuery.data as Record<string, unknown> | null;

  const sources: CalcSources = useMemo(
    () => ({
      caseInfo: (draft.info ?? null) as unknown as Record<string, unknown> | null,
      contracts: contracts.data ?? [],
      trialPeriods: trialPeriods.data ?? [],
      salary: salary.data ?? null,
      workingHours: workingHours.data ?? null,
      termination: termination.data ?? null,
      unpaidSalaries: unpaid.data ?? [],
      overtime: overtime.data ?? [],
      holidayWork: holidayWork.data ?? [],
      leaveSettlement: leaveSettlement.data ?? null,
      sickLeave: sickLeave.data ?? null,
      maternity: maternity.data ?? null,
      eosb: eosb.data ?? null,
      compensation: compensation.data ?? [],
      socialInsurance: socialInsurance.data ?? null,
      settlements: settlements.data ?? [],
      payments: payments.data ?? [],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      draft.info,
      contracts.data,
      trialPeriods.data,
      salary.data,
      workingHours.data,
      termination.data,
      unpaid.data,
      overtime.data,
      holidayWork.data,
      leaveSettlement.data,
      sickLeave.data,
      maternity.data,
      eosb.data,
      compensation.data,
      socialInsurance.data,
      settlements.data,
      payments.data,
    ],
  );

  const aiInsights = useMemo(() => {
    const items: { label: string; text: string }[] = [];
    (settlements.data ?? []).forEach((s: Record<string, unknown>) => {
      if (s["ai_summary"]) items.push({ label: "تحليل المخالصة", text: String(s["ai_summary"]) });
      if (s["ai_risk_notes"])
        items.push({ label: "مؤشرات المخاطر في المخالصة", text: String(s["ai_risk_notes"]) });
    });
    (contracts.data ?? []).forEach((c: Record<string, unknown>) => {
      if (c["ai_notes"]) items.push({ label: "تحليل العقد", text: String(c["ai_notes"]) });
    });
    if (termination.data?.["legal_notes"])
      items.push({ label: "تحليل سبب الإنهاء", text: String(termination.data["legal_notes"]) });
    const missing = Array.isArray((calc?.["results"] as any)?.errors)
      ? ((calc?.["results"] as any).errors as string[])
      : [];
    if (missing.length)
      items.push({ label: "مؤشرات البيانات الناقصة", text: missing.slice(0, 6).join(" • ") });
    return items;
  }, [settlements.data, contracts.data, termination.data, calc]);

  /* ---------- إنشاء التقرير ---------- */

  const generate = async (regenerate = false) => {
    if (!caseId) {
      toast.error("لم يتم العثور على مسودة القضية");
      return;
    }
    if (!calc) {
      toast.error("يجب تنفيذ محرك الحساب (الخطوة 15) قبل إصدار التقرير");
      return;
    }
    setBusy(true);
    try {
      const nextVersion =
        (Number((reportsQuery.data?.[0] as any)?.version ?? 0) || 0) + (regenerate || reportsQuery.data?.length ? 1 : 1);
      const reportNumber = buildReportNumber(caseId, nextVersion);
      const built = buildFinalReport({
        policy,
        options,
        privileged: roleQuery.data?.privileged ?? false,
        caseId,
        version: nextVersion,
        reportNumber,
        sources,
        calc,
        ruleVersions: settingsQuery.data?.versions ?? {},
        platformName: platformQuery.data?.platform_name ?? "حاسبة العمال الذكية",
        logoUrl: platformQuery.data?.logo_url ?? null,
        generatedBy: roleQuery.data?.email || "مستخدم النظام",
        verifyBaseUrl: typeof window !== "undefined" ? window.location.origin : "",
        aiInsights,
      });

      const qrHash = await hashDocument({ header: built.header, totals: built.totals, sections: built.sections });
      built.header.qrHash = qrHash;
      if (built.signature) {
        built.signature.hash = await hashDocument({
          qrHash,
          signedBy: built.signature.signedBy,
          signedAt: built.signature.signedAt,
        });
      }
      const shareToken = await hashDocument({ reportNumber, qrHash });

      const { data: inserted, error } = await supabase
        .from("case_final_reports")
        .insert({
          case_id: caseId,
          calculation_id: String(calc["id"]),
          report_number: reportNumber,
          report_type: options.reportType,
          report_language: options.language,
          country: "SA",
          currency: built.totals.currency,
          generated_by: roleQuery.data?.uid ?? null,
          rule_version: built.header.ruleVersion,
          system_version: built.header.systemVersion,
          calculation_version: built.header.calculationVersion,
          confidence_score: built.totals.confidenceScore,
          total_rights: built.totals.totalRights,
          total_paid: built.totals.totalPaid,
          total_excluded: built.totals.totalExcluded,
          final_balance: built.totals.finalBalance,
          options: options as never,
          document: built as never,
          qr_code_hash: qrHash,
          digital_signature_hash: built.signature?.hash ?? null,
          share_token: shareToken.slice(0, 24),
          version: nextVersion,
        })
        .select("id")
        .single();
      if (error) throw error;

      const rid = inserted.id as string;
      setReportId(rid);

      const sectionRows = built.sections.map((s) => ({
        report_id: rid,
        section_key: s.key,
        section_name: s.name,
        section_order: s.order,
        included: true,
        visibility: s.visibility,
      }));
      if (sectionRows.length) {
        const { error: secErr } = await supabase.from("case_report_sections").insert(sectionRows);
        if (secErr) throw secErr;
      }

      setDoc(built);
      setPreview(true);
      await reportsQuery.refetch();
      toast.success(regenerate ? "تم إعادة إنشاء التقرير" : `تم إصدار التقرير ${reportNumber}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل إنشاء التقرير");
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!reportId) return;
    const { error } = await supabase
      .from("case_final_reports")
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq("id", reportId);
    if (error) toast.error(error.message);
    else {
      toast.success("تم أرشفة التقرير كنسخة غير قابلة للتعديل");
      await reportsQuery.refetch();
    }
  };

  const shareLink = async () => {
    const row = reportsQuery.data?.find((r: any) => r.id === reportId) as any;
    if (!row) return;
    const url = `${window.location.origin}/verify?report=${encodeURIComponent(row.share_token ?? row.report_number)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط المشاركة الآمن");
    } catch {
      toast.info(url);
    }
  };

  const sendEmail = () => {
    if (!doc) return;
    const body = [
      `${doc.header.title}`,
      `رقم التقرير: ${doc.header.reportNumber}`,
      `الرصيد النهائي: ${reportMoney(doc.totals.finalBalance, doc.totals.currency)}`,
      `رابط التحقق: ${doc.header.verifyUrl}`,
    ].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(doc.header.reportNumber)}&body=${encodeURIComponent(body)}`;
  };

  const exportWith = async (fn: (d: FinalReportDocument) => Promise<void> | void, label: string) => {
    if (!doc) return;
    setBusy(true);
    try {
      await fn(doc);
      toast.success(`تم تنزيل ${label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `فشل تنزيل ${label}`);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- العرض ---------- */

  const optionToggles: { key: keyof ReportOptions; label: string; hint: string }[] = [
    { key: "includeAttachments", label: "تضمين المرفقات", hint: "العقود والمخالصات والمستندات" },
    { key: "includeFormulas", label: "تضمين المعادلات", hint: "يظهر للمخوّلين فقط" },
    { key: "includeLegal", label: "تضمين التحليل القانوني", hint: "المواد النظامية المطبقة" },
    { key: "includeAi", label: "تضمين تحليل الذكاء الاصطناعي", hint: "نتائج مساعدة غير ملزمة" },
    { key: "maskSensitive", label: "إخفاء البيانات الحساسة", hint: "إخفاء جزء من رقم الهوية والمراجع" },
    { key: "digitalSignature", label: "توقيع رقمي", hint: "بصمة تجزئة للتحقق من عدم التعديل" },
    { key: "watermark", label: "إضافة علامة مائية", hint: "نسخة غير رسمية للمراجعة" },
    { key: "passwordProtected", label: "حماية بكلمة مرور", hint: "متاح للمخوّلين فقط" },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <ContactBar />

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <Badge variant="outline">الخطوة 16 من مسار القضية</Badge>
          <h1 className="text-2xl font-bold md:text-3xl">التقرير القانوني النهائي</h1>
          <p className="text-sm text-muted-foreground">
            يجمع التقرير جميع نتائج القضية من محرك الحساب والوحدات السابقة ويعرضها بصورة منظمة قابلة
            للمراجعة والطباعة والأرشفة والتصدير — دون إصدار أي حكم أو رأي قانوني ملزم.
          </p>
        </header>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            {!calc ? (
              <Alert variant="destructive">
                <AlertTitle>لا توجد نتائج حساب</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  يجب تنفيذ محرك الحساب القانوني (الخطوة 15) قبل إصدار التقرير النهائي.
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/sa/calculation-engine" })}>
                    الانتقال إلى الخطوة 15
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <Card className="grid gap-4 p-5 md:grid-cols-5">
                {[
                  ["إجمالي الحقوق", Number(calc["total_rights"])],
                  ["المسدد", Number(calc["total_paid_rights"])],
                  ["المستبعد", Number(calc["total_excluded_rights"])],
                  ["الرصيد النهائي", Number(calc["final_claim_amount"])],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{String(label)}</div>
                    <div className="mt-1 font-mono text-sm font-bold" dir="ltr">
                      {reportMoney(Number(value), String(calc["currency"] ?? "SAR"))}
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">اكتمال البيانات</div>
                  <div className="mt-1 text-sm font-bold">{Number(calc["confidence_score"])}%</div>
                  <Progress className="mt-2 h-1.5" value={Number(calc["confidence_score"])} />
                </div>
              </Card>
            )}

            <Card className="space-y-5 p-5">
              <h2 className="font-semibold">خيارات التقرير</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>نوع التقرير</Label>
                  <Select value={options.reportType} onValueChange={(v) => set("reportType", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {policy.reportTypes.map((t) => (
                        <SelectItem key={t.code} value={t.code}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>لغة التقرير</Label>
                  <Select
                    value={options.language}
                    onValueChange={(v) => set("language", v as "ar" | "en")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {optionToggles.map((t) => (
                  <label
                    key={String(t.key)}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <span>
                      <span className="block text-sm font-medium">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.hint}</span>
                    </span>
                    <Switch
                      checked={Boolean(options[t.key])}
                      disabled={t.key === "passwordProtected" && !roleQuery.data?.privileged}
                      onCheckedChange={(v) => set(t.key, v as never)}
                    />
                  </label>
                ))}
              </div>

              {!roleQuery.data?.privileged ? (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>ظهور الأقسام حسب الصلاحيات</AlertTitle>
                  <AlertDescription>
                    أقسام المعادلات وتحليل الذكاء الاصطناعي تظهر للمخوّلين (المحامي أو الإدارة) فقط.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => generate(false)} disabled={busy || !calc}>
                  <Sparkles className="me-2 h-4 w-4" /> إنشاء التقرير
                </Button>
                <Button variant="outline" onClick={() => setPreview((p) => !p)} disabled={!doc}>
                  <Eye className="me-2 h-4 w-4" /> {preview ? "إخفاء المعاينة" : "معاينة"}
                </Button>
                <Button variant="outline" onClick={() => generate(true)} disabled={busy || !calc}>
                  <RefreshCw className="me-2 h-4 w-4" /> إعادة إنشاء
                </Button>
              </div>
            </Card>

            {doc ? (
              <Card className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">التصدير والمشاركة</h2>
                  <Badge variant="secondary" className="font-mono text-xs" dir="ltr">
                    {doc.header.reportNumber}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => exportWith(downloadReportPdf, "PDF")}>
                    <FileText className="me-2 h-4 w-4" /> تنزيل PDF
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => exportWith(downloadReportDocx, "Word")}>
                    <FileType2 className="me-2 h-4 w-4" /> تنزيل Word
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => exportWith(downloadReportXlsx, "Excel")}>
                    <FileSpreadsheet className="me-2 h-4 w-4" /> تنزيل Excel
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => exportWith(downloadReportHtml, "HTML")}>
                    <FileText className="me-2 h-4 w-4" /> تنزيل HTML
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => exportWith(downloadReportJson, "JSON")}>
                    <Braces className="me-2 h-4 w-4" /> تنزيل JSON
                  </Button>
                  <Button variant="ghost" onClick={sendEmail}>
                    <Mail className="me-2 h-4 w-4" /> إرسال بالبريد
                  </Button>
                  <Button variant="ghost" onClick={shareLink}>
                    <Link2 className="me-2 h-4 w-4" /> رابط آمن
                  </Button>
                  <Button variant="ghost" onClick={archive}>
                    <Archive className="me-2 h-4 w-4" /> أرشفة
                  </Button>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  <div>
                    بصمة التحقق (QR): <span className="font-mono" dir="ltr">{doc.header.qrHash.slice(0, 32)}</span>
                  </div>
                  <div>
                    التوقيع الرقمي:{" "}
                    <span className="font-mono" dir="ltr">
                      {doc.signature ? doc.signature.hash.slice(0, 32) : "غير مُوقَّع"}
                    </span>
                  </div>
                  <div>عدد الأقسام المُضمَّنة: {doc.sections.length}</div>
                </div>
              </Card>
            ) : null}

            {doc && preview ? (
              <Card className="overflow-x-auto p-4">
                <div
                  className="mx-auto w-fit rounded-lg border bg-white"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: renderFinalReportHtml(doc) }}
                />
              </Card>
            ) : null}

            {reportsQuery.data?.length ? (
              <Card className="p-5">
                <h2 className="mb-3 font-semibold">سجل الإصدارات</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 text-start">الإصدار</th>
                        <th className="py-2 text-start">رقم التقرير</th>
                        <th className="py-2 text-start">النوع</th>
                        <th className="py-2 text-start">تاريخ الإصدار</th>
                        <th className="py-2 text-start">الرصيد النهائي</th>
                        <th className="py-2 text-start">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsQuery.data.map((r: any) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-1.5">{r.version}</td>
                          <td className="py-1.5 font-mono" dir="ltr">
                            {r.report_number}
                          </td>
                          <td className="py-1.5">
                            {policy.reportTypes.find((t) => t.code === r.report_type)?.label ?? r.report_type}
                          </td>
                          <td className="py-1.5" dir="ltr">
                            {new Date(r.generated_at).toLocaleString("en-GB")}
                          </td>
                          <td className="py-1.5 font-mono" dir="ltr">
                            {reportMoney(Number(r.final_balance), String(r.currency))}
                          </td>
                          <td className="py-1.5">
                            {r.archived ? (
                              <Badge variant="secondary">مؤرشف</Badge>
                            ) : (
                              <Badge variant="outline">صادر</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            <Card className="p-5 text-xs leading-7 text-muted-foreground">{policy.disclaimer}</Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => navigate({ to: "/sa/calculation-engine" })}>
                <ArrowLeft className="me-2 h-4 w-4" /> رجوع إلى الخطوة 15
              </Button>
            </div>
          </>
        )}
      </main>

      <FooterAttribution />
    </div>
  );
}
