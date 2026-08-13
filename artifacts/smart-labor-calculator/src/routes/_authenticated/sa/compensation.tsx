import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ContactBar } from "@/components/ContactBar";
import { FooterAttribution } from "@/components/FooterAttribution";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Download,
  Eye,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { effectiveEnd, type Contract } from "@/lib/saudi/contracts";
import { computeSalary, emptySalary, type SalaryInput } from "@/lib/saudi/salary";
import { toTerminationPolicy } from "@/lib/saudi/termination";
import {
  DEFAULT_COMPENSATION_POLICY,
  analyzeCompensationSet,
  compContractLabel,
  compMoney,
  emptyCompensationClaim,
  toCompensationPolicy,
  validateCompensationClaim,
  type CompensationClaimInput,
  type CompensationContext,
} from "@/lib/saudi/compensation";

export const Route = createFileRoute("/_authenticated/sa/compensation")({
  head: () => ({
    meta: [
      { title: "التعويضات وبدل الإشعار — الخطوة 13 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة الثالثة عشرة: احتساب تعويضات إنهاء العلاقة العمالية وبدل الإشعار وتعويض المادة 77 والعقود المحددة وغير المحددة وفق محرك القوانين.",
      },
      { property: "og:title", content: "التعويضات وبدل الإشعار — الخطوة 13" },
      {
        property: "og:description",
        content:
          "محرك قانوني يحتسب التعويضات المستحقة عن الإنهاء وبدل الإشعار مع قواعد التداخل والأولوية وما سبق صرفه.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompensationStep,
});

type ClaimRow = CompensationClaimInput & { rowId: string };

const newRow = (type = ""): ClaimRow => ({
  ...emptyCompensationClaim(type),
  rowId: crypto.randomUUID(),
});

function CompensationStep() {
  const draft = useCaseDraft("SA", 13);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [claimRequested, setClaimRequested] = useState("yes");
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [uploadingRow, setUploadingRow] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState<Record<string, boolean>>({});
  const [showLegal, setShowLegal] = useState(false);
  const [recalcTick, setRecalcTick] = useState(0);

  /* ---------- محرك القوانين ---------- */

  const policyQuery = useQuery({
    queryKey: ["sa-compensation-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sa_regulatory_settings")
        .select("key, value")
        .eq("key", "compensation")
        .maybeSingle();
      if (error) throw error;
      return toCompensationPolicy(data?.value);
    },
  });
  const policy = policyQuery.data ?? DEFAULT_COMPENSATION_POLICY;

  const terminationPolicyQuery = useQuery({
    queryKey: ["sa-termination-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sa_regulatory_settings")
        .select("key, value")
        .eq("key", "termination")
        .maybeSingle();
      if (error) throw error;
      return toTerminationPolicy(data?.value);
    },
  });

  /* ---------- البيانات المجلوبة من الخطوات السابقة ---------- */

  const contracts = useQuery({
    queryKey: ["case-contracts-comp", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_contracts")
        .select("*")
        .eq("case_id", caseId!)
        .is("deleted_at", null)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salary = useQuery({
    queryKey: ["case-salary-comp", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_salaries")
        .select("*")
        .eq("case_id", caseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const termination = useQuery({
    queryKey: ["case-termination-comp", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_termination")
        .select("*")
        .eq("case_id", caseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const eosb = useQuery({
    queryKey: ["case-eosb-comp", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_eosb")
        .select("*")
        .eq("case_id", caseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const trials = useQuery({
    queryKey: ["case-trials-comp", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_trial_periods")
        .select("*")
        .eq("case_id", caseId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const maternity = useQuery({
    queryKey: ["case-maternity-comp", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_maternity_summary")
        .select("*")
        .eq("case_id", caseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const documents = useQuery({
    queryKey: ["case-termination-docs-comp", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_termination_documents")
        .select("id")
        .eq("case_id", caseId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const saved = useQuery({
    queryKey: ["case-compensation", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_compensation")
        .select("*")
        .eq("case_id", caseId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (saved.isLoading || hydrated) return;
    const list = saved.data ?? [];
    if (list.length) {
      setClaimRequested(list[0]?.claim_requested ?? "yes");
      setNotes(list[0]?.notes ?? "");
      setRows(
        list.map((s) => ({
          rowId: s.id as string,
          id: s.id as string,
          compensationType: s.compensation_type ?? "",
          legalBasis: s.legal_basis ?? "statute",
          legalReference: s.legal_reference ?? "",
          noticeStatus: s.notice_status ?? "no",
          noticeDate: "",
          noticePeriodDays: s.notice_period_days == null ? "" : Number(s.notice_period_days),
          hasAgreementClause: !!s.has_agreement_clause,
          agreementAmount: s.agreement_amount == null ? "" : Number(s.agreement_amount),
          agreementMethod: s.agreement_method ?? "",
          agreementProof: "",
          manualAmount: s.base_compensation == null ? "" : Number(s.base_compensation),
          courtJudgmentReference: s.court_judgment_reference ?? "",
          paymentStatus: s.payment_status ?? "not_paid",
          paidAmount: s.paid_amount ? Number(s.paid_amount) : "",
          paymentDate: s.payment_date ?? "",
          paymentMethod: s.payment_method ?? "",
          proofFile: s.proof_file ?? "",
          notes: s.notes ?? "",
        })),
      );
    }
    setHydrated(true);
  }, [saved.data, saved.isLoading, hydrated]);

  /* ---------- السياق التلقائي ---------- */

  const span = useMemo(() => {
    const list = (contracts.data ?? []) as unknown as Contract[];
    const starts = list.map((c) => c.start_date).filter(Boolean) as string[];
    const ends = list.map((c) => effectiveEnd(c)).filter(Boolean) as string[];
    return {
      start: starts.length ? starts.slice().sort()[0] : null,
      end: ends.length ? ends.slice().sort().reverse()[0] : null,
    };
  }, [contracts.data]);

  const lastContract = useMemo(() => {
    const list = contracts.data ?? [];
    if (!list.length) return null;
    return list.slice().sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[
      list.length - 1
    ];
  }, [contracts.data]);

  const approvedWage = useMemo(() => {
    const s = salary.data;
    if (!s) return 0;
    const input = { ...emptySalary } as SalaryInput;
    (Object.keys(emptySalary) as (keyof SalaryInput)[]).forEach((k) => {
      input[k] = Number((s as Record<string, unknown>)[k] ?? 0) || 0;
    });
    return computeSalary(input).actual;
  }, [salary.data]);

  const terminationReason = useMemo(() => {
    const code = termination.data?.termination_reason ?? "";
    const rule = terminationPolicyQuery.data?.reasons.find((r) => r.code === code) ?? null;
    return { code, rule };
  }, [termination.data, terminationPolicyQuery.data]);

  const context: CompensationContext = useMemo(() => {
    const t = termination.data;
    const endDate = t?.effective_termination_date || t?.termination_date || span.end || null;
    const serviceYears = Number(eosb.data?.total_service_years ?? 0)
      ? Number(eosb.data?.total_service_years ?? 0) +
        Number(eosb.data?.service_fraction_years ?? 0)
      : 0;
    const initiatorLabel =
      terminationPolicyQuery.data?.initiators.find((i) => i.code === t?.initiated_by)?.label ??
      (t?.initiated_by ?? "");
    return {
      employmentStatus: t?.employment_status ?? "unknown",
      terminationReasonCode: terminationReason.code,
      terminationReasonLabel: terminationReason.rule?.label ?? "",
      terminationLegalRef: terminationReason.rule?.legal_ref ?? "",
      compensationEffect: terminationReason.rule?.compensation_effect ?? "review",
      terminationNoticeRequired: !!terminationReason.rule?.notice_required,
      initiatedBy: initiatorLabel,
      terminationDate: endDate,
      noticeGivenFromStep11: !!t?.notice_given,
      noticeDateFromStep11: t?.notice_date ?? null,
      noticePeriodDaysFromStep11:
        t?.notice_period_days == null ? null : Number(t.notice_period_days),
      contractType: (lastContract?.contract_type as string) ?? "indefinite",
      contractEndDate: (lastContract?.end_date as string) ?? null,
      endedDuringTrial: (trials.data ?? []).some((x) => x.ended_during_trial),
      protectedLeave: !!maternity.data,
      serviceStart: span.start,
      serviceEnd: endDate,
      serviceYears,
      approvedWage,
      hasCourtRulingFromStep12: !!eosb.data?.has_court_ruling,
      documentsCount: (documents.data ?? []).length,
      currency: (salary.data?.currency as string) ?? "SAR",
    };
  }, [
    termination.data,
    terminationReason,
    terminationPolicyQuery.data,
    span,
    lastContract,
    trials.data,
    maternity.data,
    eosb.data,
    approvedWage,
    documents.data,
    salary.data,
  ]);

  const analysis = useMemo(
    () => analyzeCompensationSet(rows, context, policy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, context, policy, recalcTick],
  );

  const rowErrors = useMemo(
    () => rows.map((r) => validateCompensationClaim(r, context, policy)),
    [rows, context, policy],
  );
  const valid =
    claimRequested !== "yes" || (rows.length > 0 && rowErrors.every((e) => e.length === 0));
  const currency = context.currency;

  /* ---------- إدارة المطالبات ---------- */

  const patch = (rowId: string, p: Partial<ClaimRow>) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...p } : r)));

  const addClaim = () => {
    const suggested =
      policy.types.find((t) => t.code === "notice_allowance")?.code ?? policy.types[0]?.code ?? "";
    setRows((prev) => [...prev, newRow(suggested)]);
  };

  const removeClaim = (rowId: string) =>
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));

  /* ---------- الملفات ---------- */

  const uploadProof = async (rowId: string, file: File, field: "proofFile" | "agreementProof") => {
    try {
      setUploadingRow(rowId);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("انتهت الجلسة، يرجى إعادة الدخول");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${caseId}/compensation-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("case-proofs")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      patch(rowId, { [field]: path } as Partial<ClaimRow>);
      toast.success("تم رفع المستند");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر رفع المستند");
    } finally {
      setUploadingRow(null);
    }
  };

  const openFile = async (path: string, download = false) => {
    const { data, error } = await supabase.storage
      .from("case-proofs")
      .createSignedUrl(path, 300, download ? { download: true } : undefined);
    if (error || !data?.signedUrl) {
      toast.error("تعذّر فتح المستند");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  /* ---------- الحفظ ---------- */

  const save = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error("لا توجد قضية محفوظة");

      const { error: delError } = await supabase
        .from("case_compensation")
        .delete()
        .eq("case_id", caseId);
      if (delError) throw delError;

      if (claimRequested === "yes" && rows.length) {
        const payload = rows.map((r, i) => {
          const a = analysis.claims[i];
          return {
            case_id: caseId,
            claim_requested: claimRequested,
            compensation_type: a.typeCode || null,
            compensation_label: a.typeLabel || null,
            legal_basis: r.legalBasis || null,
            legal_reference: a.legalReference || null,
            contract_type: a.contractType || null,
            termination_reason: context.terminationReasonCode || null,
            notice_status: r.noticeStatus,
            notice_required: a.noticeRequired,
            notice_period_days: a.statutoryNoticeDays,
            notice_actual_days: a.noticeActualDays,
            notice_shortfall_days: a.noticeShortfallDays,
            notice_compensation: a.noticeCompensation,
            approved_wage: context.approvedWage,
            service_years: context.serviceYears,
            remaining_contract_months: a.remainingContractMonths,
            base_compensation: a.baseCompensation,
            final_compensation: a.finalCompensation,
            has_agreement_clause: r.hasAgreementClause,
            agreement_amount: r.agreementAmount === "" ? null : Number(r.agreementAmount),
            agreement_method: r.agreementMethod || null,
            agreement_conflicts_law: a.agreementConflictsLaw,
            payment_status: r.paymentStatus,
            paid_amount: a.paidAmount,
            remaining_amount: a.remainingAmount,
            payment_date: r.paymentDate || null,
            payment_method: r.paymentMethod || null,
            proof_file: r.proofFile || null,
            court_judgment_reference: r.courtJudgmentReference || null,
            excluded_from_claim:
              a.excludedFromClaim || analysis.suppressedTypes.includes(a.typeCode),
            legal_rule_version: a.legalRuleVersion,
            steps: a.steps as any,
            warnings: a.warnings as any,
            analysis: a as any,
            notes: notes || null,
            sort_order: i,
          };
        });
        const { error } = await supabase.from("case_compensation").insert(payload);
        if (error) throw error;
      } else if (claimRequested !== "yes") {
        const { error } = await supabase.from("case_compensation").insert({
          case_id: caseId,
          claim_requested: claimRequested,
          legal_rule_version: policy.version,
          notes: notes || null,
        });
        if (error) throw error;
      }

      await draft.saveNowWith({
        compensation: {
          claim_requested: claimRequested,
          total_due: analysis.totalDue,
          total_remaining: analysis.totalRemaining,
          handoff: analysis.handoff,
        },
      });
    },
    onSuccess: () => void saved.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات التعويضات"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (!valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ احتساب التعويضات");
    if (thenNext) navigate({ to: "/sa/final-settlement" });
  };

  const loading =
    draft.loading ||
    saved.isLoading ||
    contracts.isLoading ||
    salary.isLoading ||
    termination.isLoading ||
    policyQuery.isLoading;

  const typeLabel = (code: string) =>
    policy.types.find((t) => t.code === code)?.label ?? code ?? "—";

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Scale className="h-3.5 w-3.5" /> الخطوة 13 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
            التعويضات وبدل الإشعار
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُحمّل أنواع التعويضات وقواعد الاحتساب وقواعد الجمع والأولوية من محرك القوانين،
            وبيانات الإنهاء والعقود والأجور تُجلب تلقائياً من الخطوات
            السابقة ولا تُعاد إدخالها.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* الخطوة الأولى: هل يوجد تعويض محتمل */}
              <Card className="p-6">
                <h2 className="mb-3 font-bold">هل يطالب العامل بتعويض عن إنهاء العلاقة العمالية؟</h2>
                <Select value={claimRequested} onValueChange={setClaimRequested}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">نعم</SelectItem>
                    <SelectItem value="no">لا</SelectItem>
                    <SelectItem value="undecided">غير محدد بعد</SelectItem>
                  </SelectContent>
                </Select>
                {claimRequested === "no" && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>تم تجاوز مراحل التعويضات</AlertTitle>
                    <AlertDescription>
                      لن يحتسب النظام أي تعويض، وسينتقل مباشرة إلى المخالصة النهائية والحقوق المسددة.
                    </AlertDescription>
                  </Alert>
                )}
                {claimRequested === "undecided" && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>الحالة غير محددة</AlertTitle>
                    <AlertDescription>
                      يمكنك إضافة المطالبات لاحقاً، ولن تُدرج أي تعويضات في المطالبة النهائية حالياً.
                    </AlertDescription>
                  </Alert>
                )}
              </Card>

              {/* بيانات مجلوبة تلقائياً */}
              <Card className="p-6">
                <h2 className="mb-3 font-bold">بيانات الإنهاء المجلوبة تلقائياً</h2>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        ["حالة العلاقة العمالية", context.employmentStatus === "terminated" ? "منتهية" : context.employmentStatus === "active" ? "مستمرة" : "غير محددة"],
                        ["سبب الإنهاء", context.terminationReasonLabel || "—"],
                        ["جهة الإنهاء", context.initiatedBy || "—"],
                        ["تاريخ الإنهاء", context.terminationDate ?? "—"],
                        ["نوع العقد", compContractLabel(context.contractType)],
                        ["تاريخ نهاية العقد", context.contractEndDate ?? "—"],
                        ["مدة الخدمة", `${Math.round(context.serviceYears * 100) / 100} سنة`],
                        ["الأجر المعتمد", compMoney(context.approvedWage, currency)],
                        ["الإشعار (الخطوة 11)", context.noticeGivenFromStep11 ? `تم بتاريخ ${context.noticeDateFromStep11 ?? "—"}` : "لم يُسجل إشعار"],
                        ["المستندات المرفقة", `${context.documentsCount}`],
                      ].map(([k, v]) => (
                        <tr key={k as string} className="border-b last:border-0">
                          <td className="bg-muted/40 px-3 py-2 font-medium">{k}</td>
                          <td className="px-3 py-2">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* المطالبات */}
              {claimRequested === "yes" && (
                <Card className="p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-bold">مطالبات التعويض</h2>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setRecalcTick((t) => t + 1)}>
                        <RefreshCw className="ml-1 h-4 w-4" /> إعادة الحساب
                      </Button>
                      <Button size="sm" onClick={addClaim}>
                        <Plus className="ml-1 h-4 w-4" /> إضافة مطالبة
                      </Button>
                    </div>
                  </div>

                  {!rows.length && (
                    <p className="text-sm text-muted-foreground">
                      لم تُضف أي مطالبة بعد — اضغط «إضافة مطالبة» لتحديد نوع التعويض وأساسه القانوني.
                    </p>
                  )}

                  <div className="space-y-6">
                    {rows.map((r, i) => {
                      const a = analysis.claims[i];
                      const errs = rowErrors[i] ?? [];
                      const suppressed = analysis.suppressedTypes.includes(a?.typeCode ?? "");
                      return (
                        <div key={r.rowId} className="rounded-lg border p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">مطالبة {i + 1}</Badge>
                              {suppressed && (
                                <Badge className="bg-amber-100 text-amber-800">
                                  مستبعدة بقاعدة عدم الجمع
                                </Badge>
                              )}
                              {a?.excludedFromClaim && (
                                <Badge className="bg-emerald-100 text-emerald-800">
                                  مستبعدة لوجود إثبات صرف
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeClaim(r.rowId)}
                              className="text-destructive"
                            >
                              <Trash2 className="ml-1 h-4 w-4" /> حذف
                            </Button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label>نوع التعويض</Label>
                              <Select
                                value={r.compensationType}
                                onValueChange={(v) => patch(r.rowId, { compensationType: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="اختر نوع التعويض" />
                                </SelectTrigger>
                                <SelectContent>
                                  {policy.types.map((t) => (
                                    <SelectItem key={t.code} value={t.code}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>الأساس القانوني</Label>
                              <Select
                                value={r.legalBasis}
                                onValueChange={(v) => patch(r.rowId, { legalBasis: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="اختر الأساس" />
                                </SelectTrigger>
                                <SelectContent>
                                  {policy.legal_bases.map((b) => (
                                    <SelectItem key={b.code} value={b.code}>
                                      {b.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="sm:col-span-2">
                              <Label>المرجع القانوني (يُدرج في التقرير النهائي)</Label>
                              <Input
                                value={r.legalReference}
                                onChange={(e) => patch(r.rowId, { legalReference: e.target.value })}
                                placeholder={a?.legalReference ?? "مثال: المادة 77"}
                              />
                            </div>

                            <div>
                              <Label>هل تم توجيه إشعار نظامي؟</Label>
                              <Select
                                value={r.noticeStatus}
                                onValueChange={(v) => patch(r.rowId, { noticeStatus: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="yes">نعم</SelectItem>
                                  <SelectItem value="no">لا</SelectItem>
                                  <SelectItem value="partial">إشعار جزئي</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {r.noticeStatus !== "no" && (
                              <>
                                <div>
                                  <Label>تاريخ الإشعار</Label>
                                  <Input
                                    type="date"
                                    value={r.noticeDate || context.noticeDateFromStep11 || ""}
                                    onChange={(e) => patch(r.rowId, { noticeDate: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label>مدة الإشعار (أيام)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={r.noticePeriodDays}
                                    onChange={(e) =>
                                      patch(r.rowId, {
                                        noticePeriodDays:
                                          e.target.value === "" ? "" : Number(e.target.value),
                                      })
                                    }
                                    placeholder={String(a?.statutoryNoticeDays ?? "")}
                                  />
                                </div>
                              </>
                            )}

                            {(a?.formula === "manual" ||
                              a?.formula === "court" ||
                              a?.formula === "agreement") && (
                              <div>
                                <Label>
                                  {a.formula === "agreement"
                                    ? "قيمة التعويض الاتفاقي"
                                    : "قيمة التعويض المطالب به"}
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={
                                    a.formula === "agreement" ? r.agreementAmount : r.manualAmount
                                  }
                                  onChange={(e) =>
                                    patch(
                                      r.rowId,
                                      a.formula === "agreement"
                                        ? {
                                            agreementAmount:
                                              e.target.value === "" ? "" : Number(e.target.value),
                                          }
                                        : {
                                            manualAmount:
                                              e.target.value === "" ? "" : Number(e.target.value),
                                          },
                                    )
                                  }
                                />
                              </div>
                            )}
                            {a?.formula === "court" && (
                              <div>
                                <Label>مرجع الحكم القضائي</Label>
                                <Input
                                  value={r.courtJudgmentReference}
                                  onChange={(e) =>
                                    patch(r.rowId, { courtJudgmentReference: e.target.value })
                                  }
                                />
                              </div>
                            )}
                          </div>

                          {/* التعويض الاتفاقي */}
                          <div className="mt-4 rounded-md bg-muted/40 p-3">
                            <label className="flex items-center gap-2 text-sm font-medium">
                              <Checkbox
                                checked={r.hasAgreementClause}
                                onCheckedChange={(v) =>
                                  patch(r.rowId, { hasAgreementClause: !!v })
                                }
                              />
                              يحتوي عقد العمل على بند تعويض
                            </label>
                            {r.hasAgreementClause && (
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div>
                                  <Label>قيمة التعويض التعاقدي</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={r.agreementAmount}
                                    onChange={(e) =>
                                      patch(r.rowId, {
                                        agreementAmount:
                                          e.target.value === "" ? "" : Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>طريقة احتسابه</Label>
                                  <Input
                                    value={r.agreementMethod}
                                    onChange={(e) =>
                                      patch(r.rowId, { agreementMethod: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                                  <input
                                    id={`agr-${r.rowId}`}
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) void uploadProof(r.rowId, f, "agreementProof");
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={uploadingRow === r.rowId}
                                    onClick={() =>
                                      document.getElementById(`agr-${r.rowId}`)?.click()
                                    }
                                  >
                                    <Upload className="ml-1 h-4 w-4" /> رفع المستند المؤيد
                                  </Button>
                                  {r.agreementProof && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => void openFile(r.agreementProof)}
                                    >
                                      <Eye className="ml-1 h-4 w-4" /> عرض
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* السداد */}
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label>هل سبق صرف التعويض؟</Label>
                              <Select
                                value={r.paymentStatus}
                                onValueChange={(v) => patch(r.rowId, { paymentStatus: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="not_paid">لا</SelectItem>
                                  <SelectItem value="paid">نعم</SelectItem>
                                  <SelectItem value="partial">صرف جزئي</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {r.paymentStatus !== "not_paid" && (
                              <>
                                <div>
                                  <Label>قيمة المبلغ المصروف</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={r.paidAmount}
                                    onChange={(e) =>
                                      patch(r.rowId, {
                                        paidAmount:
                                          e.target.value === "" ? "" : Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>تاريخ الصرف</Label>
                                  <Input
                                    type="date"
                                    value={r.paymentDate}
                                    onChange={(e) => patch(r.rowId, { paymentDate: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label>طريقة السداد</Label>
                                  <Select
                                    value={r.paymentMethod}
                                    onValueChange={(v) => patch(r.rowId, { paymentMethod: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="اختر الطريقة" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {policy.payment_methods.map((m) => (
                                        <SelectItem key={m.code} value={m.code}>
                                          {m.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex flex-wrap items-end gap-2">
                                  <input
                                    id={`pay-${r.rowId}`}
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) void uploadProof(r.rowId, f, "proofFile");
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={uploadingRow === r.rowId}
                                    onClick={() =>
                                      document.getElementById(`pay-${r.rowId}`)?.click()
                                    }
                                  >
                                    <Upload className="ml-1 h-4 w-4" /> رفع إثبات السداد
                                  </Button>
                                  {r.proofFile && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void openFile(r.proofFile)}
                                      >
                                        <Eye className="ml-1 h-4 w-4" /> عرض
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void openFile(r.proofFile, true)}
                                      >
                                        <Download className="ml-1 h-4 w-4" /> تنزيل
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          {/* نتيجة الاحتساب */}
                          {a && (
                            <div className="mt-4 rounded-md border bg-background p-3 text-sm">
                              <div className="grid gap-2 sm:grid-cols-4">
                                <div>
                                  <p className="text-muted-foreground">بدل الإشعار</p>
                                  <p className="font-semibold">
                                    {compMoney(a.noticeCompensation, currency)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">التعويض الأساسي</p>
                                  <p className="font-semibold">
                                    {compMoney(a.baseCompensation, currency)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">التعويض النهائي</p>
                                  <p className="font-semibold">
                                    {compMoney(a.finalCompensation, currency)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">المتبقي</p>
                                  <p className="font-semibold text-primary">
                                    {compMoney(a.remainingAmount, currency)}
                                  </p>
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2"
                                onClick={() =>
                                  setShowSteps((s) => ({ ...s, [r.rowId]: !s[r.rowId] }))
                                }
                              >
                                <ChevronRight className="ml-1 h-4 w-4" />
                                {showSteps[r.rowId] ? "إخفاء طريقة الحساب" : "عرض طريقة الحساب"}
                              </Button>

                              {showSteps[r.rowId] && (
                                <ol className="mt-2 space-y-2">
                                  {a.steps.map((s, idx) => (
                                    <li key={idx} className="rounded border bg-muted/30 p-2">
                                      <p className="font-medium">{s.title}</p>
                                      <p className="text-xs text-muted-foreground">{s.detail}</p>
                                      {s.value && (
                                        <p className="mt-1 text-xs font-semibold">{s.value}</p>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              )}

                              {a.warnings.length > 0 && (
                                <ul className="mt-3 space-y-1 text-xs">
                                  {a.warnings.map((w, idx) => (
                                    <li
                                      key={idx}
                                      className={
                                        w.level === "error"
                                          ? "text-destructive"
                                          : w.level === "warning"
                                            ? "text-amber-700"
                                            : "text-muted-foreground"
                                      }
                                    >
                                      • {w.message}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          <div className="mt-4">
                            <Label>ملاحظات المطالبة</Label>
                            <Textarea
                              value={r.notes}
                              onChange={(e) => patch(r.rowId, { notes: e.target.value })}
                              rows={2}
                            />
                          </div>

                          {touched && errs.length > 0 && (
                            <Alert variant="destructive" className="mt-3">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>أخطاء في هذه المطالبة</AlertTitle>
                              <AlertDescription>
                                <ul className="list-disc pr-4">
                                  {errs.map((e) => (
                                    <li key={e}>{e}</li>
                                  ))}
                                </ul>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <Label>ملاحظات عامة على التعويضات</Label>
                <Textarea
                  className="mt-2"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Card>
            </div>

            {/* الملخص */}
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="mb-3 font-bold">ملخص التعويضات</h2>
                <div className="overflow-hidden rounded-lg border text-sm">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-2 text-right">نوع التعويض</th>
                        <th className="px-2 py-2 text-right">المستحق</th>
                        <th className="px-2 py-2 text-right">المصروف</th>
                        <th className="px-2 py-2 text-right">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.claims.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-2 py-3 text-muted-foreground">
                            لا توجد مطالبات
                          </td>
                        </tr>
                      )}
                      {analysis.claims.map((a, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-2">
                            {typeLabel(a.typeCode)}
                            {analysis.suppressedTypes.includes(a.typeCode) && (
                              <span className="block text-[11px] text-amber-700">
                                غير مضمومة (قاعدة عدم الجمع)
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2">{compMoney(a.finalCompensation, currency)}</td>
                          <td className="px-2 py-2">{compMoney(a.paidAmount, currency)}</td>
                          <td className="px-2 py-2">{compMoney(a.remainingAmount, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">إجمالي المستحق</span>
                    <span className="font-semibold">{compMoney(analysis.totalDue, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">إجمالي المصروف</span>
                    <span className="font-semibold">{compMoney(analysis.totalPaid, currency)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">الرصيد النهائي المستحق</span>
                    <span className="font-bold text-primary">
                      {compMoney(analysis.totalRemaining, currency)}
                    </span>
                  </div>
                </div>

                {analysis.warnings.length > 0 && (
                  <ul className="mt-4 space-y-1 text-xs">
                    {analysis.warnings.map((w, i) => (
                      <li
                        key={i}
                        className={
                          w.level === "error"
                            ? "text-destructive"
                            : w.level === "warning"
                              ? "text-amber-700"
                              : "text-muted-foreground"
                        }
                      >
                        • {w.message}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-2"
                  onClick={() => setShowLegal((v) => !v)}
                >
                  <BookOpen className="ml-1 h-4 w-4" />
                  {showLegal ? "إخفاء المواد النظامية" : "عرض المواد النظامية"}
                </Button>
                {showLegal && (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>{policy.legal_basis}</p>
                    <p>
                      مهلة الإشعار: {policy.notice_rules.legal_ref} — غير محدد المدة{" "}
                      {policy.notice_rules.indefinite_days} يوماً، محدد المدة{" "}
                      {policy.notice_rules.fixed_days} يوماً.
                    </p>
                    <p>
                      المادة 77: {policy.article_77.indefinite_per_year_wages} يوماً عن كل سنة خدمة
                      للعقد غير محدد المدة، وأجر المدة المتبقية للعقد محدد المدة، بحد أدنى{" "}
                      {policy.article_77.indefinite_min_wages} أجر شهري.
                    </p>
                    {policy.overlap_rules.map((o) => (
                      <p key={o.group}>• {o.note}</p>
                    ))}
                    <p>القاعدة المطبقة سارية من {policy.effective_from}</p>
                    <p>{policy.notes}</p>
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <div className="flex flex-col gap-2">
                  <Button onClick={() => void submit(false)} disabled={save.isPending}>
                    <Save className="ml-1 h-4 w-4" /> حفظ
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void submit(true)}
                    disabled={save.isPending}
                  >
                    الحفظ والمتابعة إلى المخالصة النهائية
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate({ to: "/sa/eosb" })}
                  >
                    الرجوع إلى الخطوة 12
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
      <ContactBar />
      <FooterAttribution />
    </div>
  );
}
