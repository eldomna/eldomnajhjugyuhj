import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Coins,
  Download,
  Eye,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { effectiveEnd, analyzeContracts, type Contract } from "@/lib/saudi/contracts";
import { SALARY_GROUPS } from "@/lib/saudi/salary";
import {
  DEFAULT_EOSB_POLICY,
  analyzeEosb,
  contractTypeLabel,
  eosbMoney,
  toEosbPolicy,
  validateEosb,
  type EosbWageLine,
} from "@/lib/saudi/eosb";
import { toTerminationPolicy } from "@/lib/saudi/termination";

export const Route = createFileRoute("/_authenticated/sa/eosb")({
  head: () => ({
    meta: [
      { title: "مكافأة نهاية الخدمة — الخطوة 12 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة الثانية عشرة: احتساب مكافأة نهاية الخدمة وفق مدة الخدمة والأجر المعتمد وسبب الإنهاء والقواعد النظامية، مع خصم ما سبق صرفه.",
      },
      { property: "og:title", content: "مكافأة نهاية الخدمة — الخطوة 12" },
      {
        property: "og:description",
        content:
          "محرك قانوني يحتسب مكافأة نهاية الخدمة خطوة بخطوة مع نسبة الاستحقاق والاستثناءات وما سبق صرفه.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EosbStep,
});

const SALARY_LABELS: Record<string, string> = Object.fromEntries(
  SALARY_GROUPS.flatMap((g) => g.fields.map((f) => [f.key as string, f.label])),
);

function EosbStep() {
  const draft = useCaseDraft("SA", 12);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [proofFile, setProofFile] = useState("");
  const [hasSettlement, setHasSettlement] = useState(false);
  const [hasCourtRuling, setHasCourtRuling] = useState(false);
  const [hasBetterAgreement, setHasBetterAgreement] = useState(false);
  const [agreementAmount, setAgreementAmount] = useState<number | "">("");
  const [exceptionsNotes, setExceptionsNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [entityTransfer, setEntityTransfer] = useState(false);
  const [showSteps, setShowSteps] = useState(true);
  const [showLegal, setShowLegal] = useState(false);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [recalcTick, setRecalcTick] = useState(0);

  const policyQuery = useQuery({
    queryKey: ["sa-eosb-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sa_regulatory_settings")
        .select("key, value")
        .eq("key", "eosb_gratuity")
        .maybeSingle();
      if (error) throw error;
      return toEosbPolicy(data?.value);
    },
  });
  const policy = policyQuery.data ?? DEFAULT_EOSB_POLICY;

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

  const contracts = useQuery({
    queryKey: ["case-contracts-eosb", caseId],
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
    queryKey: ["case-salary-eosb", caseId],
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
    queryKey: ["case-termination-eosb", caseId],
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

  const trials = useQuery({
    queryKey: ["case-trials-eosb", caseId],
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

  const saved = useQuery({
    queryKey: ["case-eosb", caseId],
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

  useEffect(() => {
    if (saved.isLoading || hydrated) return;
    const s = saved.data;
    if (s) {
      setPaymentStatus(s.payment_status ?? "not_paid");
      setPaidAmount(s.paid_amount ? Number(s.paid_amount) : "");
      setPaymentDate(s.payment_date ?? "");
      setPaymentMethod(s.payment_method ?? "");
      setProofFile(s.proof_file ?? "");
      setHasSettlement(!!s.has_settlement);
      setHasCourtRuling(!!s.has_court_ruling);
      setHasBetterAgreement(!!s.has_better_agreement);
      setAgreementAmount(s.agreement_amount == null ? "" : Number(s.agreement_amount));
      setExceptionsNotes(s.exceptions_notes ?? "");
      setNotes(s.notes ?? "");
    }
    setHydrated(true);
  }, [saved.data, saved.isLoading, hydrated]);

  /* ---------- السياق التلقائي من الخطوات السابقة ---------- */

  const contractAnalysis = useMemo(() => {
    const list = (contracts.data ?? []) as unknown as Contract[];
    if (!list.length) return null;
    return analyzeContracts(list, "sa");
  }, [contracts.data]);

  const span = useMemo(() => {
    const list = contracts.data ?? [];
    const starts = list.map((c) => c.start_date).filter(Boolean) as string[];
    const ends = list.map((c) => effectiveEnd(c as any)).filter(Boolean) as string[];
    return {
      start: starts.length ? starts.slice().sort()[0] : null,
      end: ends.length ? ends.slice().sort().reverse()[0] : null,
    };
  }, [contracts.data]);

  const wageLines: EosbWageLine[] = useMemo(() => {
    const s = salary.data;
    if (!s) return [];
    return Object.keys(SALARY_LABELS).map((key) => ({
      key,
      label: SALARY_LABELS[key],
      amount: Number((s as Record<string, unknown>)[key] ?? 0) || 0,
      included: policy.wage_included.includes(key),
    }));
  }, [salary.data, policy.wage_included]);

  const terminationReason = useMemo(() => {
    const code = termination.data?.termination_reason ?? "";
    const rule = terminationPolicyQuery.data?.reasons.find((r) => r.code === code) ?? null;
    return { code, rule };
  }, [termination.data, terminationPolicyQuery.data]);

  const context = useMemo(() => {
    const endFromTermination =
      termination.data?.effective_termination_date || termination.data?.termination_date || null;
    return {
      employmentStatus: termination.data?.employment_status ?? "unknown",
      terminationReasonCode: terminationReason.code,
      terminationReasonLabel: terminationReason.rule?.label ?? "",
      terminationLegalRef: terminationReason.rule?.legal_ref ?? "",
      terminationEosbEffect: terminationReason.rule?.eosb_effect ?? "review",
      endedDuringTrial: (trials.data ?? []).some((t) => t.ended_during_trial),
      serviceStart: span.start,
      serviceEnd: endFromTermination || span.end,
      contractTypes: (contracts.data ?? []).map((c) => c.contract_type as string),
      contractsCount: (contracts.data ?? []).length,
      continuousService: contractAnalysis
        ? contractAnalysis.serviceContinuity === "continuous"
        : true,
      entityTransfer,
      wageLines,
      currency: (salary.data?.currency as string) ?? "SAR",
    };
  }, [
    termination.data,
    terminationReason,
    trials.data,
    span,
    contracts.data,
    contractAnalysis,
    entityTransfer,
    wageLines,
    salary.data,
  ]);

  const input = useMemo(
    () => ({
      context,
      payment: { paymentStatus, paidAmount, paymentDate, paymentMethod, proofFile },
      exceptions: {
        hasSettlement,
        hasCourtRuling,
        hasBetterAgreement,
        agreementAmount,
        exceptionsNotes,
      },
      notes,
      policy,
    }),
    [
      context,
      paymentStatus,
      paidAmount,
      paymentDate,
      paymentMethod,
      proofFile,
      hasSettlement,
      hasCourtRuling,
      hasBetterAgreement,
      agreementAmount,
      exceptionsNotes,
      notes,
      policy,
    ],
  );

  const analysis = useMemo(
    () => analyzeEosb(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, recalcTick],
  );
  const errors = useMemo(() => validateEosb(input), [input]);
  const valid = errors.length === 0;
  const currency = context.currency;

  /* ---------- الملفات ---------- */

  const uploadProof = async (file: File) => {
    try {
      setUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("انتهت الجلسة، يرجى إعادة الدخول");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${caseId}/eosb-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("case-proofs")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      setProofFile(path);
      toast.success("تم رفع إثبات السداد");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر رفع المستند");
    } finally {
      setUploading(false);
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
      const { error } = await supabase.from("case_eosb").upsert(
        {
          case_id: caseId,
          eligible: analysis.eligible,
          ineligibility_reason: analysis.ineligibilityReason,
          service_start_date: context.serviceStart,
          service_end_date: context.serviceEnd,
          total_service_years: analysis.duration.years,
          total_service_months: analysis.duration.months,
          total_service_days: analysis.duration.days,
          service_fraction_years: analysis.duration.fractionYears,
          last_approved_wage: analysis.wage.approved,
          wage_breakdown: {
            rule: analysis.wage.rule,
            included: analysis.wage.included,
            excluded: analysis.wage.excluded,
          } as any,
          contract_type: analysis.contractType || null,
          termination_reason: analysis.reasonCode || null,
          base_gratuity_amount: analysis.baseAmount,
          eligibility_percentage: analysis.eligibilityPercentage,
          final_gratuity_amount: analysis.finalAmount,
          payment_status: paymentStatus,
          paid_amount: analysis.paidAmount,
          remaining_amount: analysis.remainingAmount,
          payment_date: paymentDate || null,
          payment_method: paymentMethod || null,
          proof_file: proofFile || null,
          has_settlement: hasSettlement,
          has_court_ruling: hasCourtRuling,
          has_better_agreement: hasBetterAgreement,
          agreement_amount: agreementAmount === "" ? null : Number(agreementAmount),
          exceptions_notes: exceptionsNotes || null,
          legal_rule_version: analysis.legalRuleVersion,
          steps: analysis.steps as any,
          analysis: analysis as any,
          warnings: analysis.warnings as any,
          notes: notes || null,
        },
        { onConflict: "case_id" },
      );
      if (error) throw error;

      await draft.saveNowWith({
        eosb: {
          eligible: analysis.eligible,
          final_gratuity: analysis.finalAmount,
          remaining: analysis.remainingAmount,
          handoff: analysis.handoff,
        },
      });
    },
    onSuccess: () => void saved.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات مكافأة نهاية الخدمة"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (!valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ احتساب مكافأة نهاية الخدمة");
    if (thenNext) navigate({ to: "/sa/compensation" });
  };

  const loading =
    draft.loading ||
    saved.isLoading ||
    contracts.isLoading ||
    salary.isLoading ||
    termination.isLoading ||
    policyQuery.isLoading;

  const methodLabel = (code: string) =>
    policy.payment_methods.find((m) => m.code === code)?.label ?? "—";

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Coins className="h-3.5 w-3.5" /> الخطوة 12 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">مكافأة نهاية الخدمة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُحمّل جميع قواعد الاحتساب من محرك القوانين، ومدة الخدمة والأجر وسبب الإنهاء تُجلب
            تلقائياً من الخطوات السابقة ولا تُعدّل هنا.
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
              {/* البطاقة الرئيسية */}
              <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold">ملخص احتساب المكافأة</h2>
                  <Badge
                    className={
                      analysis.eligible
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-destructive/10 text-destructive"
                    }
                  >
                    {analysis.eligible ? "مستحقة وفق القواعد المطبقة" : "غير مستحقة"}
                  </Badge>
                </div>

                {!analysis.eligible && analysis.ineligibilityReason && (
                  <Alert className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>توقف احتساب المكافأة</AlertTitle>
                    <AlertDescription>{analysis.ineligibilityReason}</AlertDescription>
                  </Alert>
                )}

                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        [
                          "مدة الخدمة",
                          `${analysis.duration.years} سنة و${analysis.duration.months} شهر و${analysis.duration.days} يوم`,
                        ],
                        ["الأجر المعتمد", eosbMoney(analysis.wage.approved, currency)],
                        ["نوع العقد", contractTypeLabel(analysis.contractType)],
                        ["سبب الإنهاء", analysis.reasonLabel],
                        ["المكافأة الأساسية", eosbMoney(analysis.baseAmount, currency)],
                        [
                          "نسبة الاستحقاق",
                          `${Math.round(analysis.eligibilityPercentage * 100)}% — ${analysis.eligibilityLabel}`,
                        ],
                        ["المكافأة النهائية", eosbMoney(analysis.finalAmount, currency)],
                        [
                          "حالة السداد",
                          paymentStatus === "not_paid"
                            ? "لم يسبق الصرف"
                            : paymentStatus === "paid"
                              ? `تم الصرف — ${eosbMoney(analysis.paidAmount, currency)}`
                              : `صرف جزئي — ${eosbMoney(analysis.paidAmount, currency)}`,
                        ],
                        ["الرصيد المتبقي المستحق", eosbMoney(analysis.remainingAmount, currency)],
                      ].map(([k, v]) => (
                        <tr key={k} className="border-b last:border-0">
                          <td className="w-1/2 bg-muted/40 px-3 py-2 font-medium">{k}</td>
                          <td className="px-3 py-2">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRecalcTick((t) => t + 1);
                      void contracts.refetch();
                      void salary.refetch();
                      void termination.refetch();
                      toast.success("تمت إعادة الحساب");
                    }}
                  >
                    <RefreshCw className="me-1 h-4 w-4" /> إعادة الحساب
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link to="/sa/salary">تعديل بيانات الأجر</Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link to="/sa/contracts">تعديل العقود</Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link to="/sa/termination">تعديل سبب الإنهاء</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSteps((v) => !v)}
                  >
                    عرض طريقة الحساب
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLegal((v) => !v)}
                  >
                    <BookOpen className="me-1 h-4 w-4" /> عرض المواد النظامية
                  </Button>
                </div>

                {showLegal && (
                  <Alert className="mt-4">
                    <AlertTitle>الأساس النظامي المطبق</AlertTitle>
                    <AlertDescription className="space-y-1 text-xs">
                      <div>{policy.legal_basis}</div>
                      <div>المادة المرتبطة بسبب الإنهاء: {analysis.legalRef}</div>
                      <div>
                        قاعدة الأجر:{" "}
                        {policy.wage_rule === "average_wage" ? "متوسط الأجر" : "الأجر الأخير"} •
                        كسور السنة:{" "}
                        {policy.fraction_rule === "prorata"
                          ? "بنسبة مدتها"
                          : policy.fraction_rule === "full_year"
                            ? "تُجبر لسنة"
                            : "لا تُحتسب"}
                      </div>
                      <div>سارية من: {policy.effective_from}</div>
                    </AlertDescription>
                  </Alert>
                )}
              </Card>

              {/* تفصيل الأجر */}
              <Card className="p-6">
                <h2 className="mb-1 font-bold">الأجر المعتمد وطريقة تحديده</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  البنود الداخلة والمستبعدة تُحدد وفق محرك القوانين ولا تُعدّل يدوياً.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-emerald-700">
                      بنود داخلة في الأجر
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {analysis.wage.included.length ? (
                        analysis.wage.included.map((l) => (
                          <li key={l.key} className="flex justify-between gap-2">
                            <span>{l.label}</span>
                            <span>{eosbMoney(l.amount, currency)}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-muted-foreground">لا توجد بنود مُدخلة</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                      بنود مستبعدة من الأجر
                    </h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {policy.wage_excluded.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm font-semibold">
                  الأجر النهائي المعتمد: {eosbMoney(analysis.wage.approved, currency)}
                </div>
              </Card>

              {/* الخطوة التاسعة: ما سبق صرفه */}
              <Card className="p-6">
                <h2 className="mb-1 font-bold">هل سبق صرف مكافأة نهاية الخدمة؟</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  عند وجود إثبات صحيح بقيمة كافية تُستبعد المكافأة من المطالبة، وبدون إثبات لا
                  تُستبعد تلقائياً.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["not_paid", "لا"],
                    ["paid", "نعم"],
                    ["partial", "صرف جزئي"],
                  ].map(([code, label]) => (
                    <Button
                      key={code}
                      type="button"
                      variant={paymentStatus === code ? "default" : "outline"}
                      onClick={() => setPaymentStatus(code)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                {paymentStatus !== "not_paid" && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1 block text-sm">تاريخ الصرف</Label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">قيمة المبلغ المصروف</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={paidAmount}
                        onChange={(e) =>
                          setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">طريقة السداد</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
                    <div>
                      <Label className="mb-1 block text-sm">إثبات السداد</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploading}
                          onClick={() => document.getElementById("eosb-proof")?.click()}
                        >
                          <Upload className="me-1 h-4 w-4" /> رفع إثبات
                        </Button>
                        <input
                          id="eosb-proof"
                          type="file"
                          className="hidden"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadProof(f);
                            e.target.value = "";
                          }}
                        />
                        {proofFile && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void openFile(proofFile)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void openFile(proofFile, true)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setProofFile("")}
                            >
                              إزالة
                            </Button>
                          </>
                        )}
                      </div>
                      {paymentMethod && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          الطريقة المختارة: {methodLabel(paymentMethod)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </Card>

              {/* الخطوة العاشرة: الاستثناءات */}
              <Card className="p-6">
                <h2 className="mb-1 font-bold">مراجعة الاستثناءات</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  الاتفاقيات الأفضل للعامل تُعتمد دون الانتقاص من الحد الأدنى النظامي.
                </p>
                <div className="space-y-3 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={hasSettlement}
                      onCheckedChange={(v) => setHasSettlement(!!v)}
                    />
                    توجد مخالصة نهائية مؤثرة
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={hasCourtRuling}
                      onCheckedChange={(v) => setHasCourtRuling(!!v)}
                    />
                    يوجد حكم قضائي في شأن المكافأة
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={hasBetterAgreement}
                      onCheckedChange={(v) => setHasBetterAgreement(!!v)}
                    />
                    يوجد اتفاق تعاقدي يمنح العامل مزايا أفضل
                  </label>
                  {hasBetterAgreement && (
                    <div className="max-w-xs">
                      <Label className="mb-1 block text-sm">قيمة المكافأة وفق الاتفاق</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={agreementAmount}
                        onChange={(e) =>
                          setAgreementAmount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={entityTransfer}
                      onCheckedChange={(v) => setEntityTransfer(!!v)}
                    />
                    انتقلت العلاقة العمالية إلى صاحب عمل آخر مع احتساب الخدمة السابقة
                  </label>
                  <div>
                    <Label className="mb-1 block text-sm">ملاحظات على الاستثناءات</Label>
                    <Textarea
                      value={exceptionsNotes}
                      onChange={(e) => setExceptionsNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="mb-1 block text-sm font-semibold">ملاحظات عامة</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </Card>
            </div>

            {/* الجانب: التحليل */}
            <div className="space-y-6">
              {touched && errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>يلزم تصحيح البيانات</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 ps-4 text-xs">
                      {errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Card className="p-6">
                <h2 className="mb-3 font-bold">النتيجة النهائية</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المكافأة الأساسية</span>
                    <span>{eosbMoney(analysis.baseAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">نسبة الاستحقاق</span>
                    <span>{Math.round(analysis.eligibilityPercentage * 100)}%</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>المكافأة النهائية</span>
                    <span>{eosbMoney(analysis.finalAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">سبق صرفه</span>
                    <span>{eosbMoney(analysis.paidAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-bold text-primary">
                    <span>المتبقي المستحق</span>
                    <span>{eosbMoney(analysis.remainingAmount, currency)}</span>
                  </div>
                  {analysis.excludedFromClaim && (
                    <p className="text-xs text-muted-foreground">
                      تم استبعاد المكافأة من المطالبة لوجود إثبات صرف بقيمة كافية.
                    </p>
                  )}
                </div>
              </Card>

              {showSteps && (
                <Card className="p-6">
                  <h2 className="mb-3 font-bold">طريقة الحساب خطوة بخطوة</h2>
                  <ol className="space-y-3 text-xs">
                    {analysis.steps.map((s) => (
                      <li key={s.title} className="rounded-lg border p-3">
                        <div className="font-semibold">{s.title}</div>
                        <div className="mt-1 text-muted-foreground">{s.detail}</div>
                        {s.value && <div className="mt-1 font-medium">{s.value}</div>}
                      </li>
                    ))}
                  </ol>
                </Card>
              )}

              {analysis.warnings.length > 0 && (
                <Card className="p-6">
                  <h2 className="mb-3 font-bold">التنبيهات القانونية</h2>
                  <ul className="space-y-2 text-xs">
                    {analysis.warnings.map((w, i) => (
                      <li
                        key={`${w.level}-${i}`}
                        className={`rounded-lg border p-2 ${
                          w.level === "error"
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : w.level === "warning"
                              ? "border-amber-300 bg-amber-50 text-amber-900"
                              : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {w.message}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="p-6">
                <h2 className="mb-3 font-bold">البيانات المرتبطة</h2>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>بداية الخدمة: {context.serviceStart ?? "—"}</li>
                  <li>نهاية الخدمة: {context.serviceEnd ?? "—"}</li>
                  <li>عدد العقود: {context.contractsCount}</li>
                  <li>
                    استمرارية الخدمة: {context.continuousService ? "متصلة" : "توجد انقطاعات"}
                  </li>
                  <li>حالة العلاقة: {context.employmentStatus}</li>
                </ul>
              </Card>

              <div className="flex flex-col gap-2">
                <Button onClick={() => void submit(false)} disabled={save.isPending}>
                  <Save className="me-1 h-4 w-4" /> حفظ
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void submit(true)}
                  disabled={save.isPending}
                >
                  حفظ والانتقال إلى الحاسبة <ChevronRight className="ms-1 h-4 w-4" />
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/sa/termination">
                    <ArrowLeft className="me-1 h-4 w-4" /> رجوع إلى الخطوة 11
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
      <ContactBar />
      <FooterAttribution />
    </div>
  );
}
