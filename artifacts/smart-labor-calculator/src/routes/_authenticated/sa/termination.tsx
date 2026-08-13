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
  ChevronRight,
  Download,
  Eye,
  FileText,
  Gavel,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { effectiveEnd } from "@/lib/saudi/contracts";
import {
  DEFAULT_TERMINATION_POLICY,
  analyzeTermination,
  emptyTerminationDoc,
  toTerminationPolicy,
  validateTermination,
  type TerminationDocRow,
} from "@/lib/saudi/termination";

export const Route = createFileRoute("/_authenticated/sa/termination")({
  head: () => ({
    meta: [
      { title: "سبب انتهاء العلاقة العمالية — الخطوة 11 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة الحادية عشرة: تحديد حالة العلاقة العمالية وسبب انتهائها والجهة المنهية والإشعار والمستندات، مع تحليل قانوني لأثر السبب على الحقوق.",
      },
      { property: "og:title", content: "سبب انتهاء العلاقة العمالية — الخطوة 11" },
      {
        property: "og:description",
        content:
          "محرك قرار قانوني يحلل سبب انتهاء العلاقة العمالية وأثره على مكافأة نهاية الخدمة وبدل الإشعار والتعويضات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TerminationStep,
});

function TerminationStep() {
  const draft = useCaseDraft("SA", 11);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [employmentStatus, setEmploymentStatus] = useState("terminated");
  const [reasonCode, setReasonCode] = useState("");
  const [initiatedBy, setInitiatedBy] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [noticeGiven, setNoticeGiven] = useState(false);
  const [noticeDate, setNoticeDate] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState<number | "">("");
  const [noticeMethod, setNoticeMethod] = useState("");
  const [hasDocument, setHasDocument] = useState(false);
  const [documents, setDocuments] = useState<TerminationDocRow[]>([]);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [recheckTick, setRecheckTick] = useState(0);

  const policyQuery = useQuery({
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
  const policy = policyQuery.data ?? DEFAULT_TERMINATION_POLICY;

  const contracts = useQuery({
    queryKey: ["case-contracts-term", caseId],
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

  const trials = useQuery({
    queryKey: ["case-trials-term", caseId],
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
    queryKey: ["case-termination", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const [s, d] = await Promise.all([
        supabase.from("case_termination").select("*").eq("case_id", caseId!).maybeSingle(),
        supabase
          .from("case_termination_documents")
          .select("*")
          .eq("case_id", caseId!)
          .order("sort_order"),
      ]);
      if (s.error) throw s.error;
      if (d.error) throw d.error;
      return { summary: s.data, docs: d.data ?? [] };
    },
  });

  useEffect(() => {
    if (!saved.data || hydrated) return;
    const s = saved.data.summary;
    if (s) {
      setEmploymentStatus(s.employment_status ?? "terminated");
      setReasonCode(s.termination_reason ?? "");
      setInitiatedBy(s.initiated_by ?? "");
      setReasonDetails(s.reason_details ?? "");
      setIncidentDescription(s.incident_description ?? "");
      setIncidentDate(s.incident_date ?? "");
      setTerminationDate(s.termination_date ?? "");
      setLastWorkingDay(s.last_working_day ?? "");
      setEffectiveDate(s.effective_termination_date ?? "");
      setNoticeGiven(!!s.notice_given);
      setNoticeDate(s.notice_date ?? "");
      setNoticePeriodDays(s.notice_period_days == null ? "" : Number(s.notice_period_days));
      setNoticeMethod(s.notice_method ?? "");
      setHasDocument(!!s.has_document);
      setNotes(s.notes ?? "");
    }
    if (saved.data.docs.length) {
      setDocuments(
        saved.data.docs.map((d) => ({
          id: d.id,
          doc_type: d.doc_type ?? "other",
          doc_date: d.doc_date ?? "",
          file_path: d.file_path ?? "",
          issuer: d.issuer ?? "",
          notes: d.notes ?? "",
        })),
      );
    }
    setHydrated(true);
  }, [saved.data, hydrated]);

  const span = useMemo(() => {
    const list = contracts.data ?? [];
    const starts = list.map((c) => c.start_date).filter(Boolean) as string[];
    const ends = list.map((c) => effectiveEnd(c as any)).filter(Boolean) as string[];
    return {
      start: starts.length ? starts.slice().sort()[0] : null,
      end: ends.length ? ends.slice().sort().reverse()[0] : null,
    };
  }, [contracts.data]);

  const context = useMemo(() => {
    const list = contracts.data ?? [];
    const tp = trials.data ?? [];
    const trialEnds = tp
      .map((t) => t.extension_end_date || t.trial_end_date)
      .filter(Boolean) as string[];
    return {
      serviceStart: span.start,
      serviceEnd: span.end,
      contractTypes: list.map((c) => c.contract_type as string),
      contractsCount: list.length,
      renewedCount: list.reduce((n, c) => n + (Number(c.renew_count) || 0), 0),
      hasTrialPeriod: tp.some((t) => t.has_trial_period),
      trialEndDate: trialEnds.length ? trialEnds.slice().sort().reverse()[0] : null,
      endedDuringTrial: tp.some((t) => t.ended_during_trial),
    };
  }, [contracts.data, trials.data, span.start, span.end]);

  const selectedReason = policy.reasons.find((r) => r.code === reasonCode) ?? null;
  const needsIncident =
    !!selectedReason &&
    (selectedReason.requires_incident ||
      selectedReason.checks.includes("article_80") ||
      selectedReason.checks.includes("article_81") ||
      selectedReason.checks.includes("force_majeure"));

  const input = useMemo(
    () => ({
      employmentStatus,
      reasonCode,
      initiatedBy,
      reasonDetails,
      incidentDescription,
      incidentDate,
      terminationDate,
      lastWorkingDay,
      effectiveDate,
      noticeGiven,
      noticeDate,
      noticePeriodDays,
      noticeMethod,
      hasDocument,
      documents,
      notes,
      policy,
      context,
    }),
    [
      employmentStatus,
      reasonCode,
      initiatedBy,
      reasonDetails,
      incidentDescription,
      incidentDate,
      terminationDate,
      lastWorkingDay,
      effectiveDate,
      noticeGiven,
      noticeDate,
      noticePeriodDays,
      noticeMethod,
      hasDocument,
      documents,
      notes,
      policy,
      context,
    ],
  );

  const analysis = useMemo(
    () => analyzeTermination(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, recheckTick],
  );
  const errors = useMemo(() => validateTermination(input), [input]);
  const valid = errors.length === 0;

  // اقتراح الجهة المنهية تلقائياً من محرك القوانين
  useEffect(() => {
    if (selectedReason && !initiatedBy) setInitiatedBy(selectedReason.default_initiator);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reasonCode]);

  const setDoc = (i: number, patch: Partial<TerminationDocRow>) =>
    setDocuments((list) => list.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const addDoc = () => {
    setHasDocument(true);
    setDocuments((list) => [
      ...list,
      emptyTerminationDoc(policy.document_types[0]?.code ?? "other"),
    ]);
  };

  const uploadFile = async (file: File, onDone: (path: string) => void) => {
    try {
      setUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("انتهت الجلسة، يرجى إعادة الدخول");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${caseId}/termination-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("case-proofs")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      onDone(path);
      toast.success("تم رفع المستند");
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

  const save = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error("لا توجد قضية محفوظة");
      const { data: row, error: sumErr } = await supabase
        .from("case_termination")
        .upsert(
          {
            case_id: caseId,
            employment_status: employmentStatus,
            termination_reason: reasonCode || null,
            termination_category: selectedReason?.category ?? null,
            reason_details: reasonDetails || null,
            incident_description: incidentDescription || null,
            incident_date: incidentDate || null,
            initiated_by: initiatedBy || null,
            termination_date: terminationDate || null,
            last_working_day: lastWorkingDay || null,
            effective_termination_date: effectiveDate || terminationDate || null,
            notice_given: noticeGiven,
            notice_date: noticeDate || null,
            notice_period_days: noticePeriodDays === "" ? null : Number(noticePeriodDays),
            notice_method: noticeMethod || null,
            has_document: hasDocument && documents.length > 0,
            legal_analysis_status: analysis.status,
            legal_warnings: analysis.warnings as any,
            analysis: analysis as any,
            applied_rule: (selectedReason ?? {}) as any,
            notes: notes || null,
          },
          { onConflict: "case_id" },
        )
        .select("id")
        .single();
      if (sumErr) throw sumErr;

      await supabase.from("case_termination_documents").delete().eq("case_id", caseId);
      if (documents.length) {
        const { error } = await supabase.from("case_termination_documents").insert(
          documents.map((d, i) => ({
            case_id: caseId,
            termination_id: row?.id ?? null,
            doc_type: d.doc_type,
            doc_date: d.doc_date || null,
            file_path: d.file_path || null,
            issuer: d.issuer || null,
            notes: d.notes || null,
            sort_order: i,
          })),
        );
        if (error) throw error;
      }

      await draft.saveNowWith({
        termination: {
          employment_status: employmentStatus,
          reason_code: reasonCode || null,
          analysis_status: analysis.status,
          handoff: analysis.handoff,
        },
      });
    },
    onSuccess: () => void saved.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات انتهاء العلاقة"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (!valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ بيانات انتهاء العلاقة العمالية");
    if (thenNext) navigate({ to: "/sa/eosb" });
  };

  const removeAll = () => {
    setReasonCode("");
    setInitiatedBy("");
    setReasonDetails("");
    setIncidentDescription("");
    setIncidentDate("");
    setTerminationDate("");
    setLastWorkingDay("");
    setEffectiveDate("");
    setNoticeGiven(false);
    setNoticeDate("");
    setNoticePeriodDays("");
    setNoticeMethod("");
    setHasDocument(false);
    setDocuments([]);
    setNotes("");
    toast.success("تم تفريغ بيانات الخطوة (لم يتم الحفظ بعد)");
  };

  const loading = draft.loading || saved.isLoading || contracts.isLoading || policyQuery.isLoading;
  const ongoing = employmentStatus === "active";
  const statusTone =
    analysis.status === "matched"
      ? "bg-emerald-100 text-emerald-800"
      : analysis.status === "conflict"
        ? "bg-destructive/10 text-destructive"
        : "bg-amber-100 text-amber-900";

  const label = (list: { code: string; label: string }[], code: string) =>
    list.find((o) => o.code === code)?.label ?? "—";

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Gavel className="h-3.5 w-3.5" /> الخطوة 11 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
            سبب انتهاء العلاقة العمالية
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُحمّل الأسباب النظامية وآثارها من محرك القوانين، ويُنتج النظام تحليلاً استرشادياً لا
            يُعد حكماً قضائياً. الأساس النظامي: {policy.legal_basis}
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
              {/* الخطوة الأولى */}
              <Card className="p-6">
                <h2 className="mb-1 font-bold">حالة العلاقة العمالية</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  ما هي حالة العلاقة العمالية الحالية؟
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {policy.employment_statuses.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => setEmploymentStatus(s.code)}
                      className={`rounded-lg border p-3 text-start text-sm transition ${
                        employmentStatus === s.code
                          ? "border-primary bg-primary-soft font-semibold text-primary"
                          : "bg-card hover:bg-muted/60"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {ongoing && (
                  <Alert className="mt-4">
                    <AlertTitle>العامل ما زال على رأس العمل</AlertTitle>
                    <AlertDescription>
                      لن تُحتسب مكافأة نهاية الخدمة ولا تعويضات الإنهاء، ويقتصر الاحتساب على الحقوق
                      الدورية، مع الانتقال إلى التقرير المرحلي.
                    </AlertDescription>
                  </Alert>
                )}
              </Card>

              {!ongoing && (
                <>
                  {/* الخطوتان الثانية والثالثة */}
                  <Card className="p-6">
                    <h2 className="mb-4 font-bold">سبب انتهاء العلاقة والجهة المنهية</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="mb-1 block text-sm">سبب انتهاء العلاقة العمالية</Label>
                        <Select value={reasonCode} onValueChange={setReasonCode}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر السبب" />
                          </SelectTrigger>
                          <SelectContent>
                            {policy.reasons.map((r) => (
                              <SelectItem key={r.code} value={r.code}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedReason && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            الأساس النظامي: {selectedReason.legal_ref}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="mb-1 block text-sm">من قام بإنهاء العلاقة؟</Label>
                        <Select value={initiatedBy} onValueChange={setInitiatedBy}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الجهة" />
                          </SelectTrigger>
                          <SelectContent>
                            {policy.initiators.map((o) => (
                              <SelectItem key={o.code} value={o.code}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="mb-1 block text-sm">تفاصيل إضافية عن السبب (اختياري)</Label>
                        <Textarea
                          rows={2}
                          value={reasonDetails}
                          onChange={(e) => setReasonDetails(e.target.value)}
                        />
                      </div>
                      {needsIncident && (
                        <>
                          <div className="sm:col-span-2">
                            <Label className="mb-1 block text-sm">
                              وصف الواقعة المستند إليها
                            </Label>
                            <Textarea
                              rows={3}
                              value={incidentDescription}
                              onChange={(e) => setIncidentDescription(e.target.value)}
                              placeholder="اذكر الواقعة والوقائع المؤيدة لها"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">تاريخ الواقعة</Label>
                            <Input
                              type="date"
                              value={incidentDate}
                              onChange={(e) => setIncidentDate(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </Card>

                  {/* الخطوة الرابعة */}
                  <Card className="p-6">
                    <h2 className="mb-1 font-bold">تواريخ انتهاء العلاقة</h2>
                    <p className="mb-4 text-xs text-muted-foreground">
                      يتحقق النظام من توافق التواريخ مع العقود والإشعار وآخر راتب.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label className="mb-1 block text-sm">تاريخ الإنهاء</Label>
                        <Input
                          type="date"
                          value={terminationDate}
                          onChange={(e) => setTerminationDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-sm">آخر يوم عمل</Label>
                        <Input
                          type="date"
                          value={lastWorkingDay}
                          onChange={(e) => setLastWorkingDay(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-sm">تاريخ سريان الإنهاء</Label>
                        <Input
                          type="date"
                          value={effectiveDate}
                          onChange={(e) => setEffectiveDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>
                        بداية الخدمة من العقود: {context.serviceStart ?? "—"}
                      </span>
                      <span>نهاية الخدمة من العقود: {context.serviceEnd ?? "—"}</span>
                    </div>
                  </Card>

                  {/* الخطوة الخامسة */}
                  <Card className="p-6">
                    <h2 className="mb-1 font-bold">هل يوجد إشعار؟</h2>
                    <p className="mb-4 text-xs text-muted-foreground">
                      تُرسل بيانات الإشعار تلقائياً إلى احتساب بدل الإشعار.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={noticeGiven ? "default" : "outline"}
                        onClick={() => setNoticeGiven(true)}
                      >
                        نعم
                      </Button>
                      <Button
                        type="button"
                        variant={!noticeGiven ? "default" : "outline"}
                        onClick={() => setNoticeGiven(false)}
                      >
                        لا
                      </Button>
                    </div>
                    {noticeGiven && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <div>
                          <Label className="mb-1 block text-sm">تاريخ الإشعار</Label>
                          <Input
                            type="date"
                            value={noticeDate}
                            onChange={(e) => setNoticeDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="mb-1 block text-sm">مدة الإشعار (أيام)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={noticePeriodDays}
                            onChange={(e) =>
                              setNoticePeriodDays(
                                e.target.value === "" ? "" : Number(e.target.value),
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label className="mb-1 block text-sm">طريقة الإشعار</Label>
                          <Select value={noticeMethod} onValueChange={setNoticeMethod}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الطريقة" />
                            </SelectTrigger>
                            <SelectContent>
                              {policy.notice_methods.map((o) => (
                                <SelectItem key={o.code} value={o.code}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* الخطوة السادسة */}
                  <Card className="p-6">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-bold">مستندات إثبات سبب الإنهاء</h2>
                        <p className="text-xs text-muted-foreground">
                          هل يوجد مستند يثبت سبب انتهاء العلاقة العمالية؟
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={hasDocument ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setHasDocument(true);
                            if (!documents.length) addDoc();
                          }}
                        >
                          نعم
                        </Button>
                        <Button
                          type="button"
                          variant={!hasDocument ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setHasDocument(false);
                            setDocuments([]);
                          }}
                        >
                          لا
                        </Button>
                      </div>
                    </div>

                    {hasDocument ? (
                      <div className="space-y-4">
                        {documents.map((d, i) => (
                          <div key={d.id ?? i} className="rounded-lg border bg-card p-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <Label className="mb-1 block text-sm">نوع المستند</Label>
                                <Select
                                  value={d.doc_type}
                                  onValueChange={(v) => setDoc(i, { doc_type: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {policy.document_types.map((o) => (
                                      <SelectItem key={o.code} value={o.code}>
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="mb-1 block text-sm">تاريخ المستند</Label>
                                <Input
                                  type="date"
                                  value={d.doc_date}
                                  onChange={(e) => setDoc(i, { doc_date: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-sm">الجهة المُصدِرة</Label>
                                <Input
                                  value={d.issuer}
                                  onChange={(e) => setDoc(i, { issuer: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-sm">ملاحظات</Label>
                                <Input
                                  value={d.notes}
                                  onChange={(e) => setDoc(i, { notes: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Input
                                type="file"
                                className="max-w-xs"
                                disabled={uploading}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void uploadFile(f, (p) => setDoc(i, { file_path: p }));
                                }}
                              />
                              {d.file_path && (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void openFile(d.file_path)}
                                  >
                                    <Eye className="me-1 h-4 w-4" /> عرض
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void openFile(d.file_path, true)}
                                  >
                                    <Download className="me-1 h-4 w-4" /> تنزيل
                                  </Button>
                                </>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() =>
                                  setDocuments((list) => list.filter((_, idx) => idx !== i))
                                }
                              >
                                <Trash2 className="me-1 h-4 w-4" /> حذف
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addDoc}>
                          <Plus className="me-1 h-4 w-4" /> إضافة مستند
                        </Button>
                      </div>
                    ) : (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>لا يوجد مستند</AlertTitle>
                        <AlertDescription>
                          لم يتم إرفاق مستند يثبت سبب انتهاء العلاقة العمالية، وقد يؤثر ذلك على
                          تقييم بعض المطالبات القانونية. يمكنك متابعة القضية.
                        </AlertDescription>
                      </Alert>
                    )}
                  </Card>

                  <Card className="p-6">
                    <Label className="mb-1 block text-sm">ملاحظات عامة</Label>
                    <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </Card>
                </>
              )}
            </div>

            {/* لوحة التحليل */}
            <div className="space-y-6">
              <Card className="p-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-bold">بطاقة انتهاء العلاقة</h2>
                  <Badge className={statusTone}>{analysis.statusLabel}</Badge>
                </div>
                <dl className="space-y-2 text-sm">
                  <Fact label="حالة العلاقة" value={label(policy.employment_statuses, employmentStatus)} />
                  <Fact label="سبب الانتهاء" value={selectedReason?.label ?? "—"} />
                  <Fact label="الجهة المنهية" value={label(policy.initiators, initiatedBy)} />
                  <Fact label="تاريخ الإنهاء" value={terminationDate || "—"} />
                  <Fact label="آخر يوم عمل" value={lastWorkingDay || "—"} />
                  <Fact
                    label="حالة الإشعار"
                    value={
                      noticeGiven
                        ? `موجود${noticePeriodDays ? ` — ${noticePeriodDays} يوماً` : ""}`
                        : "لا يوجد إشعار"
                    }
                  />
                  <Fact
                    label="المستندات"
                    value={documents.length ? `${documents.length} مستند` : "لا توجد مستندات"}
                  />
                  <Fact
                    label="مدة الخدمة التقديرية"
                    value={`${analysis.serviceYears.toFixed(2)} سنة`}
                  />
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRecheckTick((t) => t + 1);
                      setTouched(true);
                      toast.success("تم إعادة تحليل السبب والتحقق من البيانات");
                    }}
                  >
                    <RefreshCw className="me-1 h-4 w-4" /> تحليل السبب / إعادة التحقق
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={removeAll}
                  >
                    <Trash2 className="me-1 h-4 w-4" /> حذف البيانات
                  </Button>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="mb-3 font-bold">نتيجة التحليل القانوني</h2>
                <p className="text-sm">{analysis.statusMessage}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <EffectRow label="مكافأة نهاية الخدمة" value={analysis.effects.eosbLabel} />
                  <EffectRow label="التعويضات" value={analysis.effects.compensationLabel} />
                  <EffectRow label="بدل الإشعار" value={analysis.effects.noticeAllowanceLabel} />
                  <EffectRow
                    label="الحقوق المستبعدة"
                    value={
                      analysis.effects.excludedRights.length
                        ? analysis.effects.excludedRights.join("، ")
                        : "لا يوجد"
                    }
                  />
                  <EffectRow label="المواد النظامية" value={analysis.effects.legalRef} />
                </div>
                {analysis.noticeShortfallDays ? (
                  <p className="mt-3 text-xs text-amber-700">
                    نقص مدة الإشعار: {analysis.noticeShortfallDays} يوماً — سيُرسل إلى احتساب بدل
                    الإشعار.
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">{policy.notes}</p>
              </Card>

              <Card className="p-6">
                <h2 className="mb-3 flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> التنبيهات القانونية
                </h2>
                {analysis.warnings.length ? (
                  <ul className="space-y-2 text-xs">
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
                ) : (
                  <p className="text-xs text-muted-foreground">لا توجد تنبيهات.</p>
                )}
              </Card>

              {touched && errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>يرجى إكمال البيانات</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 space-y-1 text-xs">
                      {errors.map((er, i) => (
                        <li key={i}>• {er}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Card className="p-6">
                <h2 className="mb-2 flex items-center gap-2 font-bold">
                  <FileText className="h-4 w-4" /> التكامل مع المراحل التالية
                </h2>
                <p className="text-xs text-muted-foreground">
                  تُرسل نتيجة هذه الخطوة تلقائياً إلى مكافأة نهاية الخدمة، والتعويضات وبدل الإشعار،
                  ومحرك الحساب النهائي، والتقرير القانوني، وسجل التتبع — ولا يُعاد إدخال السبب في أي
                  مرحلة أخرى.
                </p>
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
                  {ongoing ? "حفظ والانتقال إلى التقرير المرحلي" : "حفظ والانتقال إلى الحساب"}
                  <ChevronRight className="ms-1 h-4 w-4" />
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/sa/social-insurance">
                    <ArrowLeft className="me-1 h-4 w-4" /> الرجوع إلى الخطوة 10
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}

function EffectRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
