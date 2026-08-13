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
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  ListChecks,
  Play,
  RefreshCw,
  Sigma,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import {
  DEFAULT_FINAL_SETTLEMENT_POLICY,
  toFinalSettlementPolicy,
} from "@/lib/saudi/finalSettlement";
import {
  DEFAULT_CALC_ENGINE_POLICY,
  calcMoney,
  runCalculationEngine,
  toCalcEnginePolicy,
  type CalculationRun,
  type CalcSources,
} from "@/lib/saudi/calcEngine";

export const Route = createFileRoute("/_authenticated/sa/calculation-engine")({
  head: () => ({
    meta: [
      { title: "محرك الحساب القانوني النهائي — الخطوة 15 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة الخامسة عشرة: تنفيذ محرك الحساب القانوني النهائي — التحقق من البيانات، تحميل القواعد، الأهلية، المعادلات، الاستثناءات، التعارضات، والرصيد النهائي مع سجل تدقيق كامل.",
      },
      { property: "og:title", content: "محرك الحساب القانوني النهائي — الخطوة 15" },
      {
        property: "og:description",
        content:
          "ثمانية محركات متتابعة لإنتاج الحقوق النهائية المستحقة مع درجة اكتمال البيانات وسجل تنفيذ قابل للتدقيق.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalculationEngineStep,
});

type Panel = "none" | "logs" | "validations" | "formulas";

function CalculationEngineStep() {
  const draft = useCaseDraft("SA", 15);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [run, setRun] = useState<CalculationRun | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [version, setVersion] = useState(1);

  /* ---------- محرك القوانين ---------- */

  const settingsQuery = useQuery({
    queryKey: ["sa-calc-engine-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sa_regulatory_settings")
        .select("key, value")
        .in("key", ["calculation_engine", "final_settlement"]);
      if (error) throw error;
      const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));
      const all = new Map((data ?? []).map((r) => [r.key as string, r.value]));
      return {
        calc: toCalcEnginePolicy(map.get("calculation_engine")),
        settlement: toFinalSettlementPolicy(map.get("final_settlement")),
        raw: all,
      };
    },
  });

  const versionsQuery = useQuery({
    queryKey: ["sa-rule-versions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sa_regulatory_settings").select("key, value");
      if (error) throw error;
      const out: Record<string, string> = {};
      (data ?? []).forEach((r) => {
        const v = (r.value as Record<string, unknown> | null)?.["version"];
        if (typeof v === "string" && v) out[r.key as string] = v;
      });
      return out;
    },
  });

  const policy = settingsQuery.data?.calc ?? DEFAULT_CALC_ENGINE_POLICY;
  const settlementPolicy = settingsQuery.data?.settlement ?? DEFAULT_FINAL_SETTLEMENT_POLICY;

  /* ---------- بيانات الخطوات السابقة ---------- */

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

  const contracts = many("case_contracts", "ce-contracts");
  const trialPeriods = many("contract_trial_periods", "ce-trial");
  const salary = one("case_salaries", "ce-salary");
  const workingHours = one("case_working_hours", "ce-hours");
  const termination = one("case_termination", "ce-termination");
  const unpaid = many("case_unpaid_salaries", "ce-unpaid");
  const overtime = many("case_overtime", "ce-overtime");
  const holidayWork = many("case_holiday_work", "ce-holiday");
  const leaveSettlement = one("case_leave_settlement", "ce-leave");
  const sickLeave = one("case_sick_leave_summary", "ce-sick");
  const maternity = one("case_maternity_summary", "ce-maternity");
  const eosb = one("case_eosb", "ce-eosb");
  const compensation = many("case_compensation", "ce-compensation");
  const socialInsurance = one("case_social_insurance", "ce-si");
  const settlements = many("case_final_settlement", "ce-settlements");
  const payments = many("case_settlement_payments", "ce-payments");

  const savedRun = useQuery({
    queryKey: ["case-calculations", caseId],
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

  const loading =
    settingsQuery.isLoading ||
    draft.loading ||
    contracts.isLoading ||
    salary.isLoading ||
    savedRun.isLoading;

  const currency = String((salary.data?.["currency"] as string) ?? "SAR");

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

  /* ---------- تنفيذ الحساب ---------- */

  const persist = async (result: CalculationRun, nextVersion: number) => {
    if (!caseId) return;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;

      const { data: inserted, error } = await supabase
        .from("case_calculations")
        .insert({
          case_id: caseId,
          country: result.rules.country,
          rule_version: result.rules.engineVersion,
          calculation_version: nextVersion,
          currency: result.currency,
          total_salary: result.totals.totalSalary,
          total_leave: result.totals.totalLeave,
          total_sick_leave: result.totals.totalSickLeave,
          total_maternity: result.totals.totalMaternity,
          total_insurance: result.totals.totalInsurance,
          total_gratuity: result.totals.totalGratuity,
          total_compensation: result.totals.totalCompensation,
          total_other: result.totals.totalOther,
          total_rights: result.totals.totalRights,
          total_paid_rights: result.totals.totalPaidRights,
          total_excluded_rights: result.totals.totalExcludedRights,
          final_claim_amount: result.totals.finalClaimAmount,
          confidence_score: result.confidence.score,
          calculation_status: result.status,
          blocked_reason: result.blockedReason,
          engines: result.engines as never,
          results: result.reportData as never,
          eligibility: result.eligibility as never,
          exceptions: result.exceptions as never,
          conflicts: result.conflicts as never,
          formulas: result.formulas as never,
          snapshot: result.snapshot as never,
          calculation_started_at: result.startedAt,
          calculation_completed_at: result.completedAt,
          calculated_by: uid,
        })
        .select("id")
        .single();
      if (error) throw error;

      const calcId = inserted.id as string;

      if (result.logs.length) {
        const { error: logErr } = await supabase.from("calculation_logs").insert(
          result.logs.map((l) => ({
            calculation_id: calcId,
            module_name: l.moduleName,
            step_number: l.stepNumber,
            rule_applied: l.ruleApplied,
            formula_used: l.formulaUsed,
            input_data: l.inputData as never,
            output_data: l.outputData as never,
            execution_time_ms: l.executionTimeMs,
            status: l.status,
            error_message: l.errorMessage,
          })),
        );
        if (logErr) throw logErr;
      }

      if (result.validations.length) {
        const { error: valErr } = await supabase.from("calculation_validations").insert(
          result.validations.map((v) => ({
            calculation_id: calcId,
            validation_type: v.code,
            severity: v.severity,
            message: v.message,
            related_module: v.module,
          })),
        );
        if (valErr) throw valErr;
      }

      await savedRun.refetch();
    } finally {
      setSaving(false);
    }
  };

  const execute = async () => {
    if (!caseId) {
      toast.error("لم يتم العثور على مسودة القضية");
      return;
    }
    setRunning(true);
    try {
      const result = runCalculationEngine(sources, policy, settlementPolicy, {
        country: "SA",
        currency,
        moduleVersions: versionsQuery.data ?? {},
      });
      setRun(result);
      const nextVersion =
        Number((savedRun.data?.["calculation_version"] as number) ?? 0) + 1 || version;
      setVersion(nextVersion + 1);
      await persist(result, nextVersion);

      if (result.status === "blocked") toast.error("تم إيقاف الحساب: توجد أخطاء في البيانات");
      else toast.success(`تم تنفيذ الحساب — درجة اكتمال البيانات ${result.confidence.score}%`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تنفيذ الحساب");
    } finally {
      setRunning(false);
    }
  };

  const downloadAudit = () => {
    if (!run) return;
    const blob = new Blob([JSON.stringify(run.snapshot, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- العرض ---------- */

  const statusBadge = (status: string) => {
    if (status === "success")
      return (
        <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="me-1 h-3 w-3" /> مكتمل
        </Badge>
      );
    if (status === "warning")
      return (
        <Badge variant="secondary">
          <AlertTriangle className="me-1 h-3 w-3" /> تحذيرات
        </Badge>
      );
    if (status === "failed")
      return (
        <Badge variant="destructive">
          <XCircle className="me-1 h-3 w-3" /> فشل
        </Badge>
      );
    return <Badge variant="outline">لم يُنفذ</Badge>;
  };

  const totalsRows = run
    ? [
        { label: "الرواتب والمبالغ غير المسددة", value: run.totals.totalSalary },
        { label: "الإجازات", value: run.totals.totalLeave },
        { label: "الإجازة المرضية", value: run.totals.totalSickLeave },
        { label: "الأمومة", value: run.totals.totalMaternity },
        { label: "التأمينات الاجتماعية", value: run.totals.totalInsurance },
        { label: "مكافأة نهاية الخدمة", value: run.totals.totalGratuity },
        { label: "التعويضات", value: run.totals.totalCompensation },
        { label: "حقوق أخرى", value: run.totals.totalOther },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <ContactBar />

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <Badge variant="outline">الخطوة 15 من مسار القضية</Badge>
          <h1 className="text-2xl font-bold md:text-3xl">محرك الحساب القانوني النهائي</h1>
          <p className="text-sm text-muted-foreground">
            يجمع المحرك جميع نتائج الخطوات السابقة ويطبق قواعد {policy.legal_basis} لإنتاج الحقوق
            النهائية بطريقة قابلة للمراجعة والتدقيق.
          </p>
        </header>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : (
          <>
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={execute} disabled={running || saving}>
                  <Play className="me-2 h-4 w-4" />
                  {run ? "إعادة الحساب" : "بدء الحساب"}
                </Button>
                <Button variant="outline" onClick={execute} disabled={running || saving || !run}>
                  <RefreshCw className="me-2 h-4 w-4" /> تحديث النتائج
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPanel(panel === "logs" ? "none" : "logs")}
                  disabled={!run}
                >
                  <ListChecks className="me-2 h-4 w-4" /> سجل التنفيذ
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPanel(panel === "validations" ? "none" : "validations")}
                  disabled={!run}
                >
                  <AlertTriangle className="me-2 h-4 w-4" /> سجل الأخطاء
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPanel(panel === "formulas" ? "none" : "formulas")}
                  disabled={!run}
                >
                  <Sigma className="me-2 h-4 w-4" /> المعادلات
                </Button>
                <Button variant="outline" onClick={downloadAudit} disabled={!run}>
                  <Download className="me-2 h-4 w-4" /> سجل التدقيق
                </Button>
              </div>

              {savedRun.data && !run ? (
                <p className="text-xs text-muted-foreground">
                  آخر حساب محفوظ: إصدار {String(savedRun.data["calculation_version"])} — الرصيد
                  النهائي{" "}
                  {calcMoney(
                    Number(savedRun.data["final_claim_amount"] ?? 0),
                    String(savedRun.data["currency"] ?? currency),
                  )}{" "}
                  — درجة اكتمال البيانات {String(savedRun.data["confidence_score"])}%
                </p>
              ) : null}
            </Card>

            {/* حالة المحركات */}
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">حالة المحركات</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {policy.engines.map((e) => {
                  const st = run?.engines.find((x) => x.code === e.code);
                  return (
                    <div
                      key={e.code}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {e.order}. {e.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {st?.message ?? "بانتظار التنفيذ"}
                        </p>
                      </div>
                      {statusBadge(st?.status ?? "pending")}
                    </div>
                  );
                })}
              </div>
            </Card>

            {run?.status === "blocked" ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>تم إيقاف الحساب (Atomic Calculation)</AlertTitle>
                <AlertDescription>
                  لم يتم اعتماد أي نتائج جزئية. {run.blockedReason}
                </AlertDescription>
              </Alert>
            ) : null}

            {run && run.status !== "blocked" ? (
              <>
                {/* النتائج النهائية */}
                <Card className="p-5">
                  <h2 className="mb-3 font-semibold">النتائج النهائية</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {totalsRows.map((r) => (
                          <tr key={r.label} className="border-b last:border-0">
                            <td className="py-2">{r.label}</td>
                            <td className="py-2 text-end font-mono">
                              {calcMoney(r.value, run.currency)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-b bg-muted/40">
                          <td className="py-2 font-semibold">إجمالي الحقوق</td>
                          <td className="py-2 text-end font-mono font-semibold">
                            {calcMoney(run.totals.totalRights, run.currency)}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">الحقوق المسددة</td>
                          <td className="py-2 text-end font-mono text-muted-foreground">
                            − {calcMoney(run.totals.totalPaidRights, run.currency)}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">الحقوق المستبعدة</td>
                          <td className="py-2 text-end font-mono text-muted-foreground">
                            {calcMoney(run.totals.totalExcludedRights, run.currency)}
                          </td>
                        </tr>
                        <tr className="bg-primary/5">
                          <td className="py-3 text-base font-bold">إجمالي المطالبة النهائية</td>
                          <td className="py-3 text-end font-mono text-base font-bold text-primary">
                            {calcMoney(run.totals.finalClaimAmount, run.currency)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* درجة اكتمال البيانات */}
                <Card className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">درجة اكتمال البيانات</h2>
                    <Badge variant="outline">{run.confidence.score}%</Badge>
                    <span className="text-sm text-muted-foreground">{run.confidence.label}</span>
                  </div>
                  <Progress value={run.confidence.score} />
                  {run.confidence.reasons.length ? (
                    <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                      {run.confidence.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{policy.notes}</p>
                </Card>

                {/* الأهلية */}
                <Card className="p-5">
                  <h2 className="mb-3 font-semibold">نتائج محرك الأهلية</h2>
                  <div className="space-y-2">
                    {run.eligibility.map((e) => (
                      <div
                        key={e.code}
                        className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{e.label}</p>
                          <p className="text-xs text-muted-foreground">{e.reason}</p>
                          <p className="text-xs text-muted-foreground">السند: {e.legalRef}</p>
                        </div>
                        <Badge variant={e.eligible ? "default" : "outline"}>
                          {e.eligible ? "مستحق" : "غير مستحق"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* الاستثناءات والتعارضات */}
                {run.exceptions.length || run.conflicts.length ? (
                  <Card className="space-y-3 p-5">
                    <h2 className="font-semibold">الحالات الاستثنائية والتعارضات</h2>
                    {run.exceptions.map((x) => (
                      <Alert key={x.code}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{x.label}</AlertTitle>
                        <AlertDescription>
                          {x.detail} — الأثر: {x.effect}
                        </AlertDescription>
                      </Alert>
                    ))}
                    {run.conflicts.map((c) => (
                      <Alert key={c.code} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{c.label}</AlertTitle>
                        <AlertDescription>
                          {c.detail} — الإجراء المطلوب: مراجعة قانونية
                        </AlertDescription>
                      </Alert>
                    ))}
                  </Card>
                ) : null}
              </>
            ) : null}

            {/* اللوحات */}
            {run && panel === "logs" ? (
              <Card className="p-5">
                <h2 className="mb-3 font-semibold">سجل التنفيذ (Rule Traceability)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 text-start">الوحدة</th>
                        <th className="py-2 text-start">الخطوة</th>
                        <th className="py-2 text-start">القاعدة</th>
                        <th className="py-2 text-start">المعادلة</th>
                        <th className="py-2 text-start">الزمن (م.ث)</th>
                        <th className="py-2 text-start">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.logs.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1.5 font-mono">{l.moduleName}</td>
                          <td className="py-1.5">{l.stepNumber}</td>
                          <td className="py-1.5">{l.ruleApplied}</td>
                          <td className="py-1.5 font-mono">{l.formulaUsed}</td>
                          <td className="py-1.5">{l.executionTimeMs}</td>
                          <td className="py-1.5">{l.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            {run && panel === "validations" ? (
              <Card className="space-y-2 p-5">
                <h2 className="mb-1 font-semibold">سجل التحقق والأخطاء</h2>
                {run.validations.length ? (
                  run.validations.map((v, i) => (
                    <div key={i} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            v.severity === "error"
                              ? "destructive"
                              : v.severity === "warning"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {v.severity === "error"
                            ? "خطأ"
                            : v.severity === "warning"
                              ? "تحذير"
                              : "معلومة"}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">{v.module}</span>
                      </div>
                      <p className="mt-1">{v.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">لا توجد ملاحظات على البيانات.</p>
                )}
              </Card>
            ) : null}

            {run && panel === "formulas" ? (
              <Card className="p-5">
                <h2 className="mb-3 font-semibold">المعادلات المطبقة</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 text-start">الترتيب</th>
                        <th className="py-2 text-start">الحق</th>
                        <th className="py-2 text-start">المعادلة</th>
                        <th className="py-2 text-start">السند</th>
                        <th className="py-2 text-start">الناتج</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.formulas.map((f) => (
                        <tr key={f.code} className="border-b last:border-0">
                          <td className="py-1.5">{f.order}</td>
                          <td className="py-1.5">{f.label}</td>
                          <td className="py-1.5 font-mono">{f.formula}</td>
                          <td className="py-1.5">{f.legalRef}</td>
                          <td className="py-1.5 font-mono">{calcMoney(f.amount, f.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => navigate({ to: "/sa/final-settlement" })}>
                <ArrowLeft className="me-2 h-4 w-4" /> رجوع إلى الخطوة 14
              </Button>
              <Button
                onClick={() => navigate({ to: "/sa/final-report" })}
                disabled={!run || run.status === "blocked"}
              >
                <FileText className="me-2 h-4 w-4" /> الانتقال إلى الخطوة 16 — التقرير النهائي
              </Button>
            </div>
          </>
        )}
      </main>

      <FooterAttribution />
    </div>
  );
}
