import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  CheckCircle2,
  Download,
  Eye,
  FileSignature,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { effectiveEnd, type Contract } from "@/lib/saudi/contracts";
import {
  DEFAULT_FINAL_SETTLEMENT_POLICY,
  analyzeSettlementSet,
  buildComputedRights,
  emptyPayment,
  emptySettlement,
  paymentMethodLabel,
  settleMoney,
  settlementTypeLabel,
  toFinalSettlementPolicy,
  validatePayments,
  validateSettlement,
  type PaymentInput,
  type SettlementInput,
} from "@/lib/saudi/finalSettlement";
import { analyzeSettlementDocument } from "@/lib/saudi/settlementAi.functions";

export const Route = createFileRoute("/_authenticated/sa/final-settlement")({
  head: () => ({
    meta: [
      { title: "المخالصة النهائية والحقوق المسددة — الخطوة 14 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة الرابعة عشرة: توثيق المخالصة النهائية وتحليلها قانونياً، ومطابقة الحقوق المسددة مع الحقوق المحتسبة وتحديد المتبقي قيد المطالبة.",
      },
      { property: "og:title", content: "المخالصة النهائية والحقوق المسددة — الخطوة 14" },
      {
        property: "og:description",
        content:
          "تحليل المخالصة بالذكاء الاصطناعي، ومطابقة الدفعات بالحقوق المحتسبة، وتحديد الحقوق المستبعدة والمتبقية وفق محرك القوانين.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinalSettlementStep,
});

type SettlementRow = SettlementInput & { rowId: string };
type PaymentRow = PaymentInput & { rowId: string };

const newSettlement = (): SettlementRow => ({ ...emptySettlement(), rowId: crypto.randomUUID() });
const newPayment = (rightType: string, currency: string): PaymentRow => ({
  ...emptyPayment(rightType, currency),
  rowId: crypto.randomUUID(),
});

function FinalSettlementStep() {
  const draft = useCaseDraft("SA", 14);
  const navigate = useNavigate();
  const caseId = draft.draftId;
  const runAi = useServerFn(analyzeSettlementDocument);

  const [hasSettlement, setHasSettlement] = useState<"yes" | "no" | "unknown">("yes");
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [notes, setNotes] = useState("");
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [approved, setApproved] = useState(false);
  const [recalcTick, setRecalcTick] = useState(0);

  /* ---------- محرك القوانين ---------- */

  const policyQuery = useQuery({
    queryKey: ["sa-final-settlement-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sa_regulatory_settings")
        .select("key, value")
        .eq("key", "final_settlement")
        .maybeSingle();
      if (error) throw error;
      return toFinalSettlementPolicy(data?.value);
    },
  });
  const policy = policyQuery.data ?? DEFAULT_FINAL_SETTLEMENT_POLICY;

  /* ---------- بيانات الخطوات السابقة ---------- */

  const one = (table: string, key: string) =>
    useQuery({
      queryKey: [key, caseId],
      enabled: !!caseId,
      queryFn: async () => {
        const { data, error } = await supabase
          .from(table as any)
          .select("*")
          .eq("case_id", caseId!)
          .maybeSingle();
        if (error) throw error;
        return data as any;
      },
    });

  const many = (table: string, key: string) =>
    useQuery({
      queryKey: [key, caseId],
      enabled: !!caseId,
      queryFn: async () => {
        const { data, error } = await supabase
          .from(table as any)
          .select("*")
          .eq("case_id", caseId!);
        if (error) throw error;
        return (data ?? []) as any[];
      },
    });

  const contracts = many("case_contracts", "fs-contracts");
  const salary = one("case_salaries", "fs-salary");
  const termination = one("case_termination", "fs-termination");
  const unpaid = many("case_unpaid_salaries", "fs-unpaid");
  const overtime = many("case_overtime", "fs-overtime");
  const holidayWork = many("case_holiday_work", "fs-holiday");
  const leaveSettlement = one("case_leave_settlement", "fs-leave");
  const sickLeave = one("case_sick_leave_summary", "fs-sick");
  const maternity = one("case_maternity_summary", "fs-maternity");
  const eosb = one("case_eosb", "fs-eosb");
  const compensation = many("case_compensation", "fs-compensation");
  const socialInsurance = one("case_social_insurance", "fs-si");

  const savedSettlements = useQuery({
    queryKey: ["case-final-settlement", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_final_settlement")
        .select("*")
        .eq("case_id", caseId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const savedPayments = useQuery({
    queryKey: ["case-settlement-payments", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_settlement_payments")
        .select("*")
        .eq("case_id", caseId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const currency = String((salary.data?.currency as string) ?? "SAR");

  /* ---------- التعبئة من المحفوظ ---------- */

  useEffect(() => {
    if (savedSettlements.isLoading || savedPayments.isLoading || hydrated) return;
    const list = savedSettlements.data ?? [];
    if (list.length) {
      setHasSettlement((list[0]?.has_settlement as any) ?? "yes");
      setNotes(list[0]?.notes ?? "");
      setApproved(!!list[0]?.approved);
      setSettlements(
        list
          .filter((s) => s.has_settlement === "yes")
          .map((s) => ({
            rowId: s.id as string,
            id: s.id as string,
            hasSettlement: "yes" as const,
            settlementNumber: s.settlement_number ?? "",
            settlementType: s.settlement_type ?? "final_release",
            settlementDate: s.settlement_date ?? "",
            signingDate: s.signing_date ?? "",
            signingPlace: s.signing_place ?? "",
            settlementLanguage: s.settlement_language ?? "ar",
            signatureStatus: s.signature_status ?? "signed",
            digitalSignatureType: s.digital_signature_type ?? "",
            digitalSignatureProvider: s.digital_signature_provider ?? "",
            digitalSignatureReference: s.digital_signature_reference ?? "",
            digitalSignatureDate: s.digital_signature_date ?? "",
            settlementFile: s.settlement_file ?? "",
            settlementFileType: s.settlement_file_type ?? "",
            totalSettlementAmount:
              s.total_settlement_amount == null ? "" : Number(s.total_settlement_amount),
            coversAllRights: !!s.covers_all_rights,
            underDispute: !!s.under_dispute,
            courtRulingAfter: !!s.court_ruling_after,
            courtRulingReference: s.court_ruling_reference ?? "",
            mentionedRights: Array.isArray(s.mentioned_rights)
              ? (s.mentioned_rights as string[])
              : [],
            waivedRights: Array.isArray(s.waived_rights) ? (s.waived_rights as string[]) : [],
            aiAnalysisStatus: s.ai_analysis_status ?? "not_run",
            aiAnalysis: (s.ai_analysis as any) ?? null,
            notes: s.notes ?? "",
          })),
      );
    }
    const pays = savedPayments.data ?? [];
    if (pays.length) {
      setPayments(
        pays.map((p) => ({
          rowId: p.id as string,
          id: p.id as string,
          settlementRowId: (p.settlement_id as string) ?? null,
          rightType: p.right_type ?? "other",
          amountPaid: p.amount_paid == null ? "" : Number(p.amount_paid),
          paymentDate: p.payment_date ?? "",
          paymentMethod: p.payment_method ?? "bank_transfer",
          proofFile: p.proof_file ?? "",
          currency: p.currency ?? currency,
          exchangeRate: p.exchange_rate == null ? "" : Number(p.exchange_rate),
          notes: p.notes ?? "",
        })),
      );
    }
    setHydrated(true);
  }, [
    savedSettlements.data,
    savedSettlements.isLoading,
    savedPayments.data,
    savedPayments.isLoading,
    hydrated,
    currency,
  ]);

  /* ---------- السياق ---------- */

  const serviceEnd = useMemo(() => {
    const t = termination.data;
    if (t?.effective_termination_date) return t.effective_termination_date as string;
    if (t?.termination_date) return t.termination_date as string;
    const list = (contracts.data ?? []) as unknown as Contract[];
    const ends = list.map((c) => effectiveEnd(c)).filter(Boolean) as string[];
    return ends.length ? ends.slice().sort().reverse()[0] : null;
  }, [termination.data, contracts.data]);

  const rights = useMemo(
    () =>
      buildComputedRights(
        {
          unpaidSalaries: unpaid.data ?? [],
          overtime: overtime.data ?? [],
          holidayWork: holidayWork.data ?? [],
          leaveSettlement: leaveSettlement.data ?? null,
          sickLeave: sickLeave.data ?? null,
          maternity: maternity.data ?? null,
          eosb: eosb.data ?? null,
          compensation: compensation.data ?? [],
          socialInsurance: socialInsurance.data ?? null,
        },
        policy,
        currency,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      unpaid.data,
      overtime.data,
      holidayWork.data,
      leaveSettlement.data,
      sickLeave.data,
      maternity.data,
      eosb.data,
      compensation.data,
      socialInsurance.data,
      policy,
      currency,
    ],
  );

  const activeSettlements = useMemo(
    () =>
      hasSettlement === "yes"
        ? settlements.map((s) => ({ ...s, hasSettlement: "yes" as const }))
        : [],
    [settlements, hasSettlement],
  );

  const analysis = useMemo(
    () =>
      analyzeSettlementSet(activeSettlements, payments, rights, policy, {
        serviceEnd,
        currency,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSettlements, payments, rights, policy, serviceEnd, currency, recalcTick],
  );

  const settlementErrors = useMemo(
    () => activeSettlements.map((s) => validateSettlement(s, { serviceEnd })),
    [activeSettlements, serviceEnd],
  );
  const paymentErrors = useMemo(() => validatePayments(payments, rights), [payments, rights]);

  const valid =
    settlementErrors.every((e) => e.length === 0) && Object.keys(paymentErrors).length === 0;

  /* ---------- التعديل ---------- */

  const patchSettlement = (rowId: string, p: Partial<SettlementRow>) =>
    setSettlements((prev) => prev.map((s) => (s.rowId === rowId ? { ...s, ...p } : s)));

  const patchPayment = (rowId: string, p: Partial<PaymentRow>) =>
    setPayments((prev) => prev.map((x) => (x.rowId === rowId ? { ...x, ...p } : x)));

  const toggleCode = (rowId: string, field: "mentionedRights" | "waivedRights", code: string) =>
    setSettlements((prev) =>
      prev.map((s) => {
        if (s.rowId !== rowId) return s;
        const set = new Set(s[field]);
        if (set.has(code)) set.delete(code);
        else set.add(code);
        return { ...s, [field]: Array.from(set) };
      }),
    );

  /* ---------- الملفات ---------- */

  const uploadFile = async (
    rowId: string,
    file: File,
    apply: (path: string, type: string) => void,
  ) => {
    try {
      setUploading(rowId);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("انتهت الجلسة، يرجى إعادة الدخول");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${caseId}/settlement-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("case-proofs")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      apply(path, file.type || ext);
      toast.success("تم رفع المستند");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر رفع المستند");
    } finally {
      setUploading(null);
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

  /* ---------- تحليل الذكاء الاصطناعي ---------- */

  const analyzeWithAi = async (row: SettlementRow) => {
    const text = (aiText[row.rowId] ?? "").trim();
    if (!text && !row.settlementFile) {
      toast.error("أدخل نص المخالصة أو ارفع مستندها قبل التحليل");
      return;
    }
    try {
      setAiBusy(row.rowId);
      patchSettlement(row.rowId, { aiAnalysisStatus: "running" });
      const result = await runAi({
        data: { text: text || undefined, filePath: row.settlementFile || undefined },
      });
      const merged = new Set([...row.mentionedRights, ...result.mentionedRights]);
      const waived = new Set([...row.waivedRights, ...result.waivedRights]);
      patchSettlement(row.rowId, {
        aiAnalysis: result,
        aiAnalysisStatus: "done",
        mentionedRights: Array.from(merged),
        waivedRights: Array.from(waived),
      });
      toast.success("تم تحليل المخالصة — راجع النتائج قبل اعتمادها");
    } catch (e: any) {
      patchSettlement(row.rowId, { aiAnalysisStatus: "failed" });
      toast.error(e?.message ?? "تعذّر تحليل المخالصة");
    } finally {
      setAiBusy(null);
    }
  };

  /* ---------- الحفظ ---------- */

  const save = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error("لا توجد قضية محفوظة");

      await supabase.from("case_settlement_payments").delete().eq("case_id", caseId);
      await supabase.from("case_final_settlement").delete().eq("case_id", caseId);

      const idMap = new Map<string, string>();

      if (hasSettlement === "yes" && settlements.length) {
        const payload = settlements.map((s, i) => ({
          case_id: caseId,
          has_settlement: "yes",
          settlement_number: s.settlementNumber || null,
          settlement_type: s.settlementType || null,
          settlement_date: s.settlementDate || null,
          signing_date: s.signingDate || null,
          signing_place: s.signingPlace || null,
          settlement_language: s.settlementLanguage || null,
          signature_status: s.signatureStatus || null,
          digital_signature_type: s.digitalSignatureType || null,
          digital_signature_provider: s.digitalSignatureProvider || null,
          digital_signature_reference: s.digitalSignatureReference || null,
          digital_signature_date: s.digitalSignatureDate || null,
          settlement_file: s.settlementFile || null,
          settlement_file_type: s.settlementFileType || null,
          ai_analysis_status: s.aiAnalysisStatus,
          ai_analysis: (s.aiAnalysis as any) ?? null,
          legal_analysis_status: "done",
          legal_analysis: analysis.indicators as any,
          mentioned_rights: s.mentionedRights as any,
          waived_rights: s.waivedRights as any,
          covers_all_rights: s.coversAllRights,
          under_dispute: s.underDispute,
          court_ruling_after: s.courtRulingAfter,
          court_ruling_reference: s.courtRulingReference || null,
          total_settlement_amount:
            s.totalSettlementAmount === "" ? null : Number(s.totalSettlementAmount),
          currency,
          approved,
          approved_at: approved ? new Date().toISOString() : null,
          legal_rule_version: policy.version,
          warnings: analysis.warnings as any,
          analysis: analysis as any,
          notes: notes || null,
          sort_order: i,
        }));
        const { data: inserted, error } = await supabase
          .from("case_final_settlement")
          .insert(payload)
          .select("id, sort_order");
        if (error) throw error;
        (inserted ?? []).forEach((row) => {
          const src = settlements[row.sort_order as number];
          if (src) idMap.set(src.rowId, row.id as string);
        });
      } else {
        const { error } = await supabase.from("case_final_settlement").insert({
          case_id: caseId,
          has_settlement: hasSettlement,
          currency,
          approved,
          approved_at: approved ? new Date().toISOString() : null,
          legal_rule_version: policy.version,
          legal_analysis_status: "done",
          legal_analysis: analysis.indicators as any,
          warnings: analysis.warnings as any,
          analysis: analysis as any,
          notes: notes || null,
        });
        if (error) throw error;
      }

      if (payments.length) {
        const rowsByCode = new Map(analysis.rows.map((r) => [r.code, r]));
        const payload = payments.map((p, i) => {
          const r = rowsByCode.get(p.rightType);
          const amount = Number(p.amountPaid) || 0;
          const rate = p.exchangeRate === "" ? null : Number(p.exchangeRate);
          return {
            case_id: caseId,
            settlement_id: p.settlementRowId ? (idMap.get(p.settlementRowId) ?? null) : null,
            right_type: p.rightType,
            right_label: r?.label ?? p.rightType,
            related_module: r?.module ?? "manual",
            amount_due: r?.due ?? 0,
            amount_paid: amount,
            remaining_amount: r?.remaining ?? 0,
            currency: p.currency || currency,
            exchange_rate: rate,
            converted_amount: rate ? Math.round(amount * rate * 100) / 100 : null,
            payment_date: p.paymentDate || null,
            payment_method: p.paymentMethod || null,
            proof_file: p.proofFile || null,
            match_status: r?.matchStatus ?? "needs_review",
            mentioned_in_settlement: !!r?.mentionedInSettlement,
            notes: p.notes || null,
            sort_order: i,
          };
        });
        const { error } = await supabase.from("case_settlement_payments").insert(payload);
        if (error) throw error;
      }

      await draft.saveNowWith({
        final_settlement: {
          has_settlement: hasSettlement,
          approved,
          total_due: analysis.totalDue,
          total_paid: analysis.totalPaid,
          total_claim: analysis.totalClaim,
          handoff: analysis.handoff,
        },
      });
    },
    onSuccess: () => {
      void savedSettlements.refetch();
      void savedPayments.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات المخالصة"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (!valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ المخالصة النهائية والحقوق المسددة");
    if (thenNext) navigate({ to: "/sa/calculation-engine" });
  };

  const loading =
    draft.loading ||
    policyQuery.isLoading ||
    savedSettlements.isLoading ||
    savedPayments.isLoading ||
    eosb.isLoading;

  const rightLabel = (code: string) =>
    policy.right_types.find((r) => r.code === code)?.label ?? code;

  const severityClass = (s: string) =>
    s === "critical"
      ? "bg-destructive/10 text-destructive"
      : s === "warning"
        ? "bg-amber-100 text-amber-800"
        : "bg-muted text-muted-foreground";

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <FileSignature className="h-3.5 w-3.5" /> الخطوة 14 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
            المخالصة النهائية والحقوق المسددة
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُحمّل قواعد المخالصة وأنواع الحقوق والحقوق التي لا يجوز التنازل عنها من محرك
            القوانين، وتُجلب الحقوق المحتسبة من جميع الخطوات السابقة
            تلقائياً. لا يعتمد النظام التوقيع وحده لإسقاط أي حق.
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
              {/* 1) هل توجد مخالصة */}
              <Card className="p-6">
                <h2 className="mb-3 font-bold">
                  هل تم توقيع مخالصة أو تسوية نهائية بين العامل وصاحب العمل؟
                </h2>
                <Select
                  value={hasSettlement}
                  onValueChange={(v) => setHasSettlement(v as typeof hasSettlement)}
                >
                  <SelectTrigger className="max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">نعم</SelectItem>
                    <SelectItem value="no">لا</SelectItem>
                    <SelectItem value="unknown">غير معروف</SelectItem>
                  </SelectContent>
                </Select>
                {hasSettlement !== "yes" && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>مراجعة الحقوق المسددة</AlertTitle>
                    <AlertDescription>
                      ينتقل النظام مباشرة إلى مراجعة الحقوق المسددة وتسجيل الدفعات، وتبقى الحقوق غير
                      المثبت سدادها قيد المطالبة.
                    </AlertDescription>
                  </Alert>
                )}
              </Card>

              {/* 2-5) بيانات المخالصات */}
              {hasSettlement === "yes" && (
                <Card className="p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-bold">بيانات المخالصة</h2>
                    <Button size="sm" onClick={() => setSettlements((p) => [...p, newSettlement()])}>
                      <Plus className="ml-1 h-4 w-4" /> إضافة مخالصة
                    </Button>
                  </div>

                  {!settlements.length && (
                    <p className="text-sm text-muted-foreground">
                      لم تُضف أي مخالصة بعد — اضغط «إضافة مخالصة» لتسجيل بياناتها ورفع مستندها.
                    </p>
                  )}

                  <div className="space-y-6">
                    {settlements.map((s, i) => {
                      const errs = settlementErrors[i] ?? [];
                      return (
                        <div key={s.rowId} className="rounded-lg border p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">مخالصة {i + 1}</Badge>
                              <Badge variant="outline">
                                {settlementTypeLabel(s.settlementType, policy)}
                              </Badge>
                              {s.aiAnalysisStatus === "done" && (
                                <Badge className="bg-emerald-100 text-emerald-800">
                                  تم التحليل الذكي
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() =>
                                setSettlements((prev) => prev.filter((x) => x.rowId !== s.rowId))
                              }
                            >
                              <Trash2 className="ml-1 h-4 w-4" /> حذف
                            </Button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label>رقم المخالصة (اختياري)</Label>
                              <Input
                                value={s.settlementNumber}
                                onChange={(e) =>
                                  patchSettlement(s.rowId, { settlementNumber: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>نوع المخالصة</Label>
                              <Select
                                value={s.settlementType}
                                onValueChange={(v) => patchSettlement(s.rowId, { settlementType: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {policy.settlement_types.map((t) => (
                                    <SelectItem key={t.code} value={t.code}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>تاريخ المخالصة</Label>
                              <Input
                                type="date"
                                value={s.settlementDate}
                                onChange={(e) =>
                                  patchSettlement(s.rowId, { settlementDate: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>تاريخ التوقيع</Label>
                              <Input
                                type="date"
                                value={s.signingDate}
                                onChange={(e) =>
                                  patchSettlement(s.rowId, { signingDate: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>مكان التوقيع (اختياري)</Label>
                              <Input
                                value={s.signingPlace}
                                onChange={(e) =>
                                  patchSettlement(s.rowId, { signingPlace: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>لغة المخالصة</Label>
                              <Select
                                value={s.settlementLanguage}
                                onValueChange={(v) =>
                                  patchSettlement(s.rowId, { settlementLanguage: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {policy.languages.map((t) => (
                                    <SelectItem key={t.code} value={t.code}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>المبلغ المذكور في المخالصة ({currency})</Label>
                              <Input
                                type="number"
                                min={0}
                                value={s.totalSettlementAmount}
                                onChange={(e) =>
                                  patchSettlement(s.rowId, {
                                    totalSettlementAmount:
                                      e.target.value === "" ? "" : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label>حالة التوقيع</Label>
                              <Select
                                value={s.signatureStatus}
                                onValueChange={(v) =>
                                  patchSettlement(s.rowId, { signatureStatus: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {policy.signature_statuses.map((t) => (
                                    <SelectItem key={t.code} value={t.code}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* التوقيع الإلكتروني */}
                          {s.signatureStatus === "digital" && (
                            <div className="mt-4 grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                              <div>
                                <Label>نوع التوقيع</Label>
                                <Input
                                  value={s.digitalSignatureType}
                                  onChange={(e) =>
                                    patchSettlement(s.rowId, {
                                      digitalSignatureType: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>مزود خدمة التوقيع</Label>
                                <Input
                                  value={s.digitalSignatureProvider}
                                  onChange={(e) =>
                                    patchSettlement(s.rowId, {
                                      digitalSignatureProvider: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>رقم المرجع</Label>
                                <Input
                                  value={s.digitalSignatureReference}
                                  onChange={(e) =>
                                    patchSettlement(s.rowId, {
                                      digitalSignatureReference: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>تاريخ التوقيع الإلكتروني</Label>
                                <Input
                                  type="date"
                                  value={s.digitalSignatureDate}
                                  onChange={(e) =>
                                    patchSettlement(s.rowId, {
                                      digitalSignatureDate: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {/* رفع المخالصة */}
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <input
                              id={`settle-file-${s.rowId}`}
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f)
                                  void uploadFile(s.rowId, f, (path, type) =>
                                    patchSettlement(s.rowId, {
                                      settlementFile: path,
                                      settlementFileType: type,
                                    }),
                                  );
                                e.target.value = "";
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={uploading === s.rowId}
                              onClick={() =>
                                document.getElementById(`settle-file-${s.rowId}`)?.click()
                              }
                            >
                              <Upload className="ml-1 h-4 w-4" />
                              {s.settlementFile ? "استبدال المستند" : "رفع المخالصة (PDF/Word/صورة)"}
                            </Button>
                            {s.settlementFile && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void openFile(s.settlementFile)}
                                >
                                  <Eye className="ml-1 h-4 w-4" /> عرض
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void openFile(s.settlementFile, true)}
                                >
                                  <Download className="ml-1 h-4 w-4" /> تنزيل
                                </Button>
                              </>
                            )}
                          </div>

                          {/* تحليل الذكاء الاصطناعي */}
                          <div className="mt-4 rounded-lg border p-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <h3 className="text-sm font-bold">تحليل محتوى المخالصة</h3>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={aiBusy === s.rowId}
                                onClick={() => void analyzeWithAi(s)}
                              >
                                <Sparkles className="ml-1 h-4 w-4" />
                                {aiBusy === s.rowId ? "جارٍ التحليل…" : "تحليل بالذكاء الاصطناعي"}
                              </Button>
                            </div>
                            <Textarea
                              rows={4}
                              placeholder="الصق نص المخالصة هنا (اختياري إذا تم رفع المستند)"
                              value={aiText[s.rowId] ?? ""}
                              onChange={(e) =>
                                setAiText((p) => ({ ...p, [s.rowId]: e.target.value }))
                              }
                            />
                            {s.aiAnalysis && (
                              <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
                                {s.aiAnalysis.summary && <p>{s.aiAnalysis.summary}</p>}
                                {!!s.aiAnalysis.mentionedRights.length && (
                                  <p>
                                    <span className="font-medium">الحقوق المذكورة:</span>{" "}
                                    {s.aiAnalysis.mentionedRights.map(rightLabel).join("، ")}
                                  </p>
                                )}
                                {!!s.aiAnalysis.amounts.length && (
                                  <p>
                                    <span className="font-medium">المبالغ:</span>{" "}
                                    {s.aiAnalysis.amounts
                                      .map((a) => `${a.label}: ${settleMoney(a.amount, currency)}`)
                                      .join(" — ")}
                                  </p>
                                )}
                                {!!s.aiAnalysis.waivedRights.length && (
                                  <p>
                                    <span className="font-medium">حقوق متنازل عنها:</span>{" "}
                                    {s.aiAnalysis.waivedRights.map(rightLabel).join("، ")}
                                  </p>
                                )}
                                {!!s.aiAnalysis.specialClauses.length && (
                                  <p>
                                    <span className="font-medium">بنود خاصة:</span>{" "}
                                    {s.aiAnalysis.specialClauses.join(" — ")}
                                  </p>
                                )}
                                {!!s.aiAnalysis.exceptions.length && (
                                  <p>
                                    <span className="font-medium">استثناءات:</span>{" "}
                                    {s.aiAnalysis.exceptions.join(" — ")}
                                  </p>
                                )}
                                {!!s.aiAnalysis.reviewFlags.length && (
                                  <p className="text-amber-700">
                                    <span className="font-medium">نصوص تحتاج مراجعة قانونية:</span>{" "}
                                    {s.aiAnalysis.reviewFlags.join(" — ")}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  النتائج استرشادية — راجعها وعدّل الحقوق المذكورة أدناه قبل
                                  الاعتماد.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* الحقوق المذكورة والمتنازل عنها */}
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label className="mb-2 block">الحقوق المذكورة في المخالصة</Label>
                              <div className="space-y-2">
                                {policy.right_types.map((rt) => (
                                  <label
                                    key={`m-${rt.code}`}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Checkbox
                                      checked={s.mentionedRights.includes(rt.code)}
                                      onCheckedChange={() =>
                                        toggleCode(s.rowId, "mentionedRights", rt.code)
                                      }
                                    />
                                    {rt.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label className="mb-2 block">الحقوق المتنازل عنها بنص المخالصة</Label>
                              <div className="space-y-2">
                                {policy.right_types.map((rt) => (
                                  <label
                                    key={`w-${rt.code}`}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Checkbox
                                      checked={s.waivedRights.includes(rt.code)}
                                      onCheckedChange={() =>
                                        toggleCode(s.rowId, "waivedRights", rt.code)
                                      }
                                    />
                                    {rt.label}
                                    {!rt.waivable && (
                                      <Badge className="bg-destructive/10 text-destructive">
                                        لا يجوز التنازل
                                      </Badge>
                                    )}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={s.coversAllRights}
                                onCheckedChange={(v) =>
                                  patchSettlement(s.rowId, { coversAllRights: !!v })
                                }
                              />
                              المخالصة تنص على شمولها جميع الحقوق
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={s.underDispute}
                                onCheckedChange={(v) =>
                                  patchSettlement(s.rowId, { underDispute: !!v })
                                }
                              />
                              يوجد نزاع أو تحفظ على المخالصة
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={s.courtRulingAfter}
                                onCheckedChange={(v) =>
                                  patchSettlement(s.rowId, { courtRulingAfter: !!v })
                                }
                              />
                              صدر حكم قضائي بعد المخالصة
                            </label>
                            {s.courtRulingAfter && (
                              <Input
                                placeholder="رقم/مرجع الحكم القضائي"
                                value={s.courtRulingReference}
                                onChange={(e) =>
                                  patchSettlement(s.rowId, { courtRulingReference: e.target.value })
                                }
                              />
                            )}
                          </div>

                          {touched && errs.length > 0 && (
                            <Alert variant="destructive" className="mt-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>يرجى تصحيح البيانات</AlertTitle>
                              <AlertDescription>
                                <ul className="list-inside list-disc">
                                  {errs.map((x) => (
                                    <li key={x}>{x}</li>
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

              {/* 6) مراجعة الحقوق المسددة */}
              <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold">مراجعة الحقوق المسددة</h2>
                  <Button variant="outline" size="sm" onClick={() => setRecalcTick((t) => t + 1)}>
                    <RefreshCw className="ml-1 h-4 w-4" /> إعادة المطابقة
                  </Button>
                </div>

                {!analysis.rows.length ? (
                  <p className="text-sm text-muted-foreground">
                    لا توجد حقوق محتسبة من الخطوات السابقة حتى الآن.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-right">الحق</th>
                          <th className="px-3 py-2 text-right">المستحق</th>
                          <th className="px-3 py-2 text-right">المسدد</th>
                          <th className="px-3 py-2 text-right">المتبقي</th>
                          <th className="px-3 py-2 text-right">الحالة</th>
                          <th className="px-3 py-2 text-right">مصدر البيانات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.rows.map((r) => (
                          <tr key={r.code} className="border-t align-top">
                            <td className="px-3 py-2">
                              <div className="font-medium">{r.label}</div>
                              <div className="text-xs text-muted-foreground">{r.legalRef}</div>
                              {!!r.reasons.length && (
                                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                                  {r.reasons.map((x, i) => (
                                    <li key={i}>{x}</li>
                                  ))}
                                </ul>
                              )}
                              {!!r.warnings.length && (
                                <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
                                  {r.warnings.map((x, i) => (
                                    <li key={i}>{x}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="px-3 py-2">{settleMoney(r.due, r.currency)}</td>
                            <td className="px-3 py-2">{settleMoney(r.totalPaid, r.currency)}</td>
                            <td className="px-3 py-2 font-semibold">
                              {settleMoney(r.remaining, r.currency)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                className={
                                  r.matchStatus === "matched"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : r.matchStatus === "difference"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-muted text-muted-foreground"
                                }
                              >
                                {r.matchLabel}
                              </Badge>
                              {!r.mentionedInSettlement && analysis.hasSettlement && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  غير مشمول بالمخالصة
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{r.module}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* 7) الدفعات المسددة */}
              <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold">الدفعات المسددة</h2>
                  <Button
                    size="sm"
                    onClick={() =>
                      setPayments((p) => [
                        ...p,
                        newPayment(analysis.rows[0]?.code ?? "other", currency),
                      ])
                    }
                  >
                    <Plus className="ml-1 h-4 w-4" /> إضافة دفعة
                  </Button>
                </div>

                {!payments.length && (
                  <p className="text-sm text-muted-foreground">
                    لم تُسجل أي دفعة — أضف الدفعات لربط كل مبلغ مسدد بالحق المقابل له.
                  </p>
                )}

                <div className="space-y-4">
                  {payments.map((p, i) => {
                    const errs = paymentErrors[p.rowId] ?? [];
                    return (
                      <div key={p.rowId} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <Badge variant="secondary">دفعة {i + 1}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() =>
                              setPayments((prev) => prev.filter((x) => x.rowId !== p.rowId))
                            }
                          >
                            <Trash2 className="ml-1 h-4 w-4" /> حذف
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label>نوع الحق</Label>
                            <Select
                              value={p.rightType}
                              onValueChange={(v) => patchPayment(p.rowId, { rightType: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {policy.right_types.map((rt) => (
                                  <SelectItem key={rt.code} value={rt.code}>
                                    {rt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>قيمة الدفعة</Label>
                            <Input
                              type="number"
                              min={0}
                              value={p.amountPaid}
                              onChange={(e) =>
                                patchPayment(p.rowId, {
                                  amountPaid: e.target.value === "" ? "" : Number(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>تاريخ السداد</Label>
                            <Input
                              type="date"
                              value={p.paymentDate}
                              onChange={(e) => patchPayment(p.rowId, { paymentDate: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>طريقة السداد</Label>
                            <Select
                              value={p.paymentMethod}
                              onValueChange={(v) => patchPayment(p.rowId, { paymentMethod: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
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
                            <Label>العملة</Label>
                            <Input
                              value={p.currency}
                              onChange={(e) =>
                                patchPayment(p.rowId, { currency: e.target.value.toUpperCase() })
                              }
                            />
                          </div>
                          {p.currency !== currency && (
                            <div>
                              <Label>سعر الصرف المرجعي (إلى {currency})</Label>
                              <Input
                                type="number"
                                step="0.0001"
                                min={0}
                                value={p.exchangeRate}
                                onChange={(e) =>
                                  patchPayment(p.rowId, {
                                    exchangeRate:
                                      e.target.value === "" ? "" : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                          )}
                          {hasSettlement === "yes" && settlements.length > 0 && (
                            <div>
                              <Label>مرتبطة بالمخالصة</Label>
                              <Select
                                value={p.settlementRowId ?? "none"}
                                onValueChange={(v) =>
                                  patchPayment(p.rowId, {
                                    settlementRowId: v === "none" ? null : v,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">غير مرتبطة</SelectItem>
                                  {settlements.map((s, idx) => (
                                    <SelectItem key={s.rowId} value={s.rowId}>
                                      مخالصة {idx + 1}
                                      {s.settlementDate ? ` — ${s.settlementDate}` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <Label>ملاحظات</Label>
                            <Input
                              value={p.notes}
                              onChange={(e) => patchPayment(p.rowId, { notes: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            id={`pay-file-${p.rowId}`}
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f)
                                void uploadFile(p.rowId, f, (path) =>
                                  patchPayment(p.rowId, { proofFile: path }),
                                );
                              e.target.value = "";
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={uploading === p.rowId}
                            onClick={() => document.getElementById(`pay-file-${p.rowId}`)?.click()}
                          >
                            <Upload className="ml-1 h-4 w-4" />
                            {p.proofFile ? "استبدال المستند المؤيد" : "رفع المستند المؤيد"}
                          </Button>
                          {p.proofFile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void openFile(p.proofFile)}
                            >
                              <Eye className="ml-1 h-4 w-4" /> عرض
                            </Button>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {paymentMethodLabel(p.paymentMethod, policy)}
                          </span>
                        </div>

                        {touched && errs.length > 0 && (
                          <Alert variant="destructive" className="mt-3">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <ul className="list-inside list-disc">
                                {errs.map((x) => (
                                  <li key={x}>{x}</li>
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

              {/* 9-11) التحليل القانوني والمراجعة */}
              <Card className="p-6">
                <h2 className="mb-3 font-bold">التحليل القانوني للمخالصة</h2>
                <div className="space-y-2">
                  {analysis.indicators.map((ind, i) => (
                    <div key={`${ind.code}-${i}`} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={severityClass(ind.severity)}>{ind.label}</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{ind.detail}</p>
                    </div>
                  ))}
                </div>
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>تنبيه</AlertTitle>
                  <AlertDescription>{policy.notes}</AlertDescription>
                </Alert>

                <div className="mt-4">
                  <Label>ملاحظات عامة</Label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm">
                  <Checkbox checked={approved} onCheckedChange={(v) => setApproved(!!v)} />
                  أعتمد نتائج المخالصة والحقوق المسددة كما هي معروضة أعلاه
                </label>
              </Card>
            </div>

            {/* الملخص */}
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="mb-3 font-bold">الملخص المالي</h2>
                <div className="space-y-2 text-sm">
                  {[
                    ["إجمالي الحقوق المحتسبة", analysis.totalDue],
                    ["إجمالي المسدد", analysis.totalPaid],
                    ["إجمالي المتبقي", analysis.totalRemaining],
                    ["المطالبة النهائية بعد الاستبعاد", analysis.totalClaim],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-semibold">{settleMoney(v as number, currency)}</span>
                    </div>
                  ))}
                  {analysis.totalSettlementDeclared > 0 && (
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-muted-foreground">المبلغ المذكور في المخالصة</span>
                      <span className="font-semibold">
                        {settleMoney(analysis.totalSettlementDeclared, currency)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="mb-3 font-bold">قرار كل حق</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="mb-1 font-medium text-emerald-700">
                      حقوق مستبعدة لثبوت سدادها
                    </div>
                    {analysis.excludedRights.length ? (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {analysis.excludedRights.map((r) => (
                          <li key={r.code}>
                            {r.label} — {settleMoney(r.totalPaid, r.currency)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">لا يوجد</p>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 font-medium">حقوق غير مشمولة بالمخالصة</div>
                    {analysis.notCoveredRights.length ? (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {analysis.notCoveredRights.map((r) => (
                          <li key={r.code}>{r.label}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">لا يوجد</p>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 font-medium text-primary">حقوق متبقية قيد المطالبة</div>
                    {analysis.remainingRights.length ? (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {analysis.remainingRights.map((r) => (
                          <li key={r.code}>
                            {r.label} — {settleMoney(r.claimAmount, r.currency)} ({r.legalRef})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">لا يوجد</p>
                    )}
                  </div>
                </div>
              </Card>

              {!!analysis.warnings.length && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>تنبيهات</AlertTitle>
                  <AlertDescription>
                    <ul className="list-inside list-disc">
                      {analysis.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

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
                    <CheckCircle2 className="ml-1 h-4 w-4" /> اعتماد النتائج والمتابعة
                  </Button>
                  <Button variant="ghost" onClick={() => navigate({ to: "/sa/compensation" })}>
                    الرجوع إلى الخطوة 13
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  تُرسل النتائج المعتمدة إلى محرك الحساب والتقرير القانوني النهائي.
                </p>
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
