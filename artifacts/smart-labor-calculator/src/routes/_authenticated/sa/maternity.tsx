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
import { Switch } from "@/components/ui/switch";
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
  Baby,
  ChevronRight,
  Download,
  Eye,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { money } from "@/lib/saudi/salary";
import { effectiveEnd } from "@/lib/saudi/contracts";
import {
  DELIVERY_TYPES,
  MATERNITY_DOCUMENT_TYPES,
  MATERNITY_PAYMENT_METHODS,
  MATERNITY_PAYMENT_STATUSES,
  MATERNITY_WAGE_BASES,
  MULTIPLE_BIRTH_OPTIONS,
  TERMINATION_PARTIES,
  analyzeMaternity,
  emptyMaternityLeave,
  emptyNursingRow,
  inclusiveDays,
  toMaternityPolicy,
  toNursingPolicy,
  validateMaternity,
  type MaternityLeaveRow,
  type MaternityPaymentStatus,
  type NursingRow,
} from "@/lib/saudi/maternity";

export const Route = createFileRoute("/_authenticated/sa/maternity")({
  head: () => ({
    meta: [
      { title: "الحمل والأمومة وساعة الرضاعة — الخطوة 9 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة التاسعة: احتساب مستحقات إجازة الأمومة وساعة الرضاعة والحماية النظامية من الإنهاء أثناء الحمل.",
      },
      { property: "og:title", content: "الحمل والأمومة وساعة الرضاعة — الخطوة 9" },
      {
        property: "og:description",
        content:
          "إدارة الحقوق النظامية للحمل وإجازة الأمومة وساعة الرضاعة وفق قواعد قابلة للتحديث من محرك القوانين.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaternityStep,
});

function MaternityStep() {
  const draft = useCaseDraft("SA", 9);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [gender, setGender] = useState<"male" | "female">("female");
  const [hadPregnancy, setHadPregnancy] = useState<boolean | null>(null);
  const [pregnancyStart, setPregnancyStart] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [actualDelivery, setActualDelivery] = useState("");
  const [deliveryType, setDeliveryType] = useState("");
  const [earlyDelivery, setEarlyDelivery] = useState(false);
  const [multipleBirth, setMultipleBirth] = useState("single");
  const [newbornDeceased, setNewbornDeceased] = useState(false);
  const [complications, setComplications] = useState(false);
  const [hasDoc, setHasDoc] = useState(false);
  const [docType, setDocType] = useState("");
  const [docFile, setDocFile] = useState("");
  const [endedDuringProtection, setEndedDuringProtection] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [terminationParty, setTerminationParty] = useState("");
  const [terminationProof, setTerminationProof] = useState("");
  const [wageChanged, setWageChanged] = useState(false);
  const [wageBasis, setWageBasis] = useState("last_actual_wage");
  const [returnedToWork, setReturnedToWork] = useState<boolean | null>(null);
  const [isNursing, setIsNursing] = useState<boolean | null>(null);
  const [leaves, setLeaves] = useState<MaternityLeaveRow[]>([]);
  const [nursing, setNursing] = useState<NursingRow[]>([]);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recalcKey, setRecalcKey] = useState(0);

  const policies = useQuery({
    queryKey: ["sa-maternity-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sa_regulatory_settings")
        .select("key, value")
        .in("key", ["maternity_leave", "nursing_hour"]);
      if (error) throw error;
      const map = new Map((data ?? []).map((r) => [r.key, r.value]));
      return {
        maternity: toMaternityPolicy(map.get("maternity_leave")),
        nursing: toNursingPolicy(map.get("nursing_hour")),
      };
    },
  });

  const salary = useQuery({
    queryKey: ["case-salary-maternity", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_salaries")
        .select("actual_salary, daily_salary, currency")
        .eq("case_id", caseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const contracts = useQuery({
    queryKey: ["case-contracts-maternity", caseId],
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

  const saved = useQuery({
    queryKey: ["case-maternity", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const [s, l, nrs] = await Promise.all([
        supabase.from("case_maternity_summary").select("*").eq("case_id", caseId!).maybeSingle(),
        supabase.from("case_maternity_leaves").select("*").eq("case_id", caseId!).order("sort_order"),
        supabase.from("case_nursing_hours").select("*").eq("case_id", caseId!).order("sort_order"),
      ]);
      if (s.error) throw s.error;
      if (l.error) throw l.error;
      if (nrs.error) throw nrs.error;
      return { summary: s.data, leaves: l.data ?? [], nursing: nrs.data ?? [] };
    },
  });

  useEffect(() => {
    if (!saved.data) return;
    const s = saved.data.summary;
    if (s) {
      setGender((s.gender as "male" | "female") ?? "female");
      setHadPregnancy(!!s.had_pregnancy);
      setPregnancyStart(s.pregnancy_start_date ?? "");
      setDeliveryDate(s.delivery_date ?? "");
      setActualDelivery(s.actual_delivery_date ?? "");
      setDeliveryType(s.delivery_type ?? "");
      setEarlyDelivery(!!s.early_delivery);
      setMultipleBirth(s.multiple_birth ?? "single");
      setNewbornDeceased(!!s.newborn_deceased);
      setComplications(!!s.medical_complications);
      setHasDoc(!!s.has_medical_document);
      setDocType(s.medical_document_type ?? "");
      setDocFile(s.medical_report_file ?? "");
      setEndedDuringProtection(!!s.ended_during_protection);
      setTerminationReason(s.termination_reason ?? "");
      setTerminationDate(s.termination_date ?? "");
      setTerminationParty(s.termination_party ?? "");
      setTerminationProof(s.termination_proof_file ?? "");
      setWageChanged(!!s.wage_changed);
      setWageBasis(s.wage_basis ?? "last_actual_wage");
      setReturnedToWork(!!s.returned_to_work);
      setIsNursing(!!s.is_nursing);
      setNotes(s.notes ?? "");
    }
    if (saved.data.leaves.length) {
      setLeaves(
        saved.data.leaves.map((r) => ({
          id: r.id,
          contract_id: r.contract_id ?? "",
          leave_start: r.leave_start ?? "",
          leave_end: r.leave_end ?? "",
          return_to_work_date: r.return_to_work_date ?? "",
          days: r.leave_days == null ? "" : Number(r.leave_days),
          extended: !!r.extended,
          extension_reason: r.extension_reason ?? "",
          extension_days: r.extension_days == null ? "" : Number(r.extension_days),
          has_document: !!r.has_document,
          medical_report_file: r.medical_report_file ?? "",
          payment_status: (r.payment_status as MaternityPaymentStatus) ?? "unpaid",
          paid_amount: r.paid_amount == null ? "" : Number(r.paid_amount),
          payment_method: r.payment_method ?? "",
          payment_date: r.payment_date ?? "",
          payment_proof_file: r.payment_proof_file ?? "",
          notes: r.notes ?? "",
        })),
      );
    }
    if (saved.data.nursing.length) {
      setNursing(
        saved.data.nursing.map((r) => ({
          id: r.id,
          delivery_date: r.delivery_date ?? "",
          return_to_work_date: r.return_to_work_date ?? "",
          nursing_start_date: r.nursing_start_date ?? "",
          nursing_end_date: r.nursing_end_date ?? "",
          daily_working_hours: r.daily_working_hours == null ? 8 : Number(r.daily_working_hours),
          notes: r.notes ?? "",
        })),
      );
    }
  }, [saved.data]);

  const currency = salary.data?.currency || "SAR";
  const dailyWage =
    Number(salary.data?.daily_salary ?? 0) || Number(salary.data?.actual_salary ?? 0) / 30;

  const span = useMemo(() => {
    const list = contracts.data ?? [];
    const starts = list.map((c) => c.start_date).filter(Boolean) as string[];
    const ends = list.map((c) => effectiveEnd(c as any)).filter(Boolean) as string[];
    return {
      start: starts.length ? starts.slice().sort()[0] : null,
      end: ends.length ? ends.slice().sort().reverse()[0] : null,
    };
  }, [contracts.data]);

  const serviceYears = useMemo(() => {
    if (!span.start) return 0;
    const end = span.end ?? new Date().toISOString().slice(0, 10);
    return Math.max(0, inclusiveDays(span.start, end) / 365.25);
  }, [span.start, span.end]);

  const input = useMemo(
    () => ({
      gender,
      hadPregnancy: !!hadPregnancy,
      deliveryDate,
      actualDeliveryDate: actualDelivery,
      earlyDelivery,
      multipleBirth,
      newbornDeceased,
      medicalComplications: complications,
      hasMedicalDocument: hasDoc && !!docFile,
      endedDuringProtection,
      terminationDate,
      terminationParty,
      terminationReason,
      hasTerminationProof: !!terminationProof,
      wageChanged,
      wageBasis,
      returnedToWork: !!returnedToWork,
      isNursing: !!isNursing,
      leaves,
      nursing,
      dailyWage,
      currency,
      policy: policies.data?.maternity,
      nursingPolicy: policies.data?.nursing,
      serviceYears,
      serviceStart: span.start,
      serviceEnd: span.end,
    }),
    [
      gender,
      hadPregnancy,
      deliveryDate,
      actualDelivery,
      earlyDelivery,
      multipleBirth,
      newbornDeceased,
      complications,
      hasDoc,
      docFile,
      endedDuringProtection,
      terminationDate,
      terminationParty,
      terminationReason,
      terminationProof,
      wageChanged,
      wageBasis,
      returnedToWork,
      isNursing,
      leaves,
      nursing,
      dailyWage,
      currency,
      policies.data,
      serviceYears,
      span.start,
      span.end,
      recalcKey,
    ],
  );

  const analysis = useMemo(() => analyzeMaternity(input), [input]);
  const errors = useMemo(
    () => (gender === "female" ? validateMaternity({ ...input, analysis }) : []),
    [gender, input, analysis],
  );
  const valid = errors.length === 0;

  const setLeave = (i: number, patch: Partial<MaternityLeaveRow>) =>
    setLeaves((list) =>
      list.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        if (("leave_start" in patch || "leave_end" in patch) && next.leave_start && next.leave_end) {
          next.days = inclusiveDays(next.leave_start, next.leave_end);
        }
        return next;
      }),
    );

  const setNursingRow = (i: number, patch: Partial<NursingRow>) =>
    setNursing((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const uploadFile = async (file: File, onDone: (path: string) => void) => {
    try {
      setUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("انتهت الجلسة، يرجى إعادة الدخول");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${caseId}/maternity-${Date.now()}.${ext}`;
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

  const FileField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div>
      <Label className="mb-1 block text-sm">{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          accept="image/*,application/pdf"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f, onChange);
          }}
        />
        {!!value && (
          <>
            <Button type="button" variant="outline" size="icon" onClick={() => void openFile(value)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void openFile(value, true)}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error("لا توجد قضية محفوظة");

      await supabase.from("case_maternity_leaves").delete().eq("case_id", caseId);
      await supabase.from("case_nursing_hours").delete().eq("case_id", caseId);

      const applicable = gender === "female";

      if (applicable && hadPregnancy && leaves.length) {
        const { error } = await supabase.from("case_maternity_leaves").insert(
          leaves.map((r, i) => {
            const res = analysis.leaves.find((l) => l.index === i);
            return {
              case_id: caseId,
              contract_id: r.contract_id || null,
              pregnancy_start_date: pregnancyStart || null,
              delivery_date: deliveryDate || null,
              leave_start: r.leave_start || null,
              leave_end: r.leave_end || null,
              return_to_work_date: r.return_to_work_date || null,
              leave_days: Number(r.days) || 0,
              extended: r.extended,
              extension_reason: r.extension_reason || null,
              extension_days: Number(r.extension_days) || 0,
              has_document: r.has_document,
              medical_report_file: r.medical_report_file || null,
              daily_wage: analysis.dailyWage,
              compensation_rate: res?.rate ?? 0,
              compensation_amount: res?.due ?? 0,
              payment_status: r.payment_status,
              paid_amount: r.payment_status === "unpaid" ? 0 : Number(r.paid_amount) || 0,
              remaining_amount: res?.remaining ?? 0,
              payment_method: r.payment_method || null,
              payment_date: r.payment_date || null,
              payment_proof_file: r.payment_proof_file || null,
              currency,
              applied_rule: analysis.policy as any,
              notes: r.notes || null,
              sort_order: i,
            };
          }),
        );
        if (error) throw error;
      }

      if (applicable && returnedToWork && isNursing && nursing.length) {
        const { error } = await supabase.from("case_nursing_hours").insert(
          nursing.map((r, i) => {
            const res = analysis.nursing[i];
            return {
              case_id: caseId,
              delivery_date: r.delivery_date || null,
              return_to_work_date: r.return_to_work_date || null,
              nursing_start_date: res?.start || r.nursing_start_date || null,
              nursing_end_date: res?.end || r.nursing_end_date || null,
              daily_working_hours: Number(r.daily_working_hours) || 8,
              daily_reduction_hours: res?.dailyReductionHours ?? 0,
              total_eligible_days: res?.days ?? 0,
              total_reduction_hours: res?.totalReductionHours ?? 0,
              paid: analysis.nursingPolicy.paid,
              applied_rule: analysis.nursingPolicy as any,
              notes: r.notes || null,
              sort_order: i,
            };
          }),
        );
        if (error) throw error;
      }

      const { error: sumErr } = await supabase.from("case_maternity_summary").upsert(
        {
          case_id: caseId,
          gender,
          had_pregnancy: applicable && !!hadPregnancy,
          pregnancy_start_date: pregnancyStart || null,
          delivery_date: deliveryDate || null,
          actual_delivery_date: actualDelivery || null,
          delivery_type: deliveryType || null,
          early_delivery: earlyDelivery,
          multiple_birth: multipleBirth,
          newborn_deceased: newbornDeceased,
          medical_complications: complications,
          has_medical_document: hasDoc,
          medical_document_type: docType || null,
          medical_report_file: docFile || null,
          ended_during_protection: endedDuringProtection,
          termination_reason: terminationReason || null,
          termination_date: terminationDate || null,
          termination_party: terminationParty || null,
          termination_proof_file: terminationProof || null,
          wage_changed: wageChanged,
          wage_basis: wageBasis,
          returned_to_work: !!returnedToWork,
          is_nursing: !!isNursing,
          daily_wage: analysis.dailyWage,
          total_due: analysis.totalDue,
          total_paid: analysis.totalPaid,
          excluded_amount: analysis.excludedAmount,
          remaining_amount: analysis.remainingAmount,
          currency,
          analysis: analysis as any,
          notes: notes || null,
        },
        { onConflict: "case_id" },
      );
      if (sumErr) throw sumErr;

      await draft.saveNowWith({
        maternity: { gender, had_pregnancy: !!hadPregnancy, analysis, currency },
      });
    },
    onSuccess: () => void saved.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات الأمومة"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (gender === "female" && hadPregnancy === null) {
      toast.error("يرجى الإجابة على سؤال الحمل أولاً");
      return;
    }
    if (gender === "female" && !valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ بيانات الأمومة وإعادة احتساب المطالبة");
    if (thenNext) navigate({ to: "/sa/social-insurance" });
  };

  const loading = draft.loading || saved.isLoading || contracts.isLoading;
  const showPregnancy = gender === "female";
  const showNursing = gender === "female" && (hadPregnancy === false || hadPregnancy === true);

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Baby className="h-3.5 w-3.5" /> الخطوة 9 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
            الحمل والأمومة وساعة الرضاعة
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُحمّل مدة الإجازة ونسبة الأجر ومدة ساعة الرضاعة والحماية من الإنهاء تلقائياً من محرك
            القوانين للدولة المختارة.
          </p>
        </div>

        {loading && (
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-40 w-full" />
          </Card>
        )}

        {!draft.loading && !caseId && (
          <Card className="p-8 text-center">
            <h2 className="mb-1 font-bold">أكمل الخطوات السابقة أولاً</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              يجب إنشاء القضية وإدخال العقود وبيانات الراتب قبل هذه الخطوة.
            </p>
            <Button asChild className="gap-2">
              <Link to="/sa/case-info">
                <ChevronRight className="h-4 w-4" /> الخطوة 1: بيانات القضية
              </Link>
            </Button>
          </Card>
        )}

        {!!caseId && !loading && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-3 font-bold">جنس العامل</h2>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={gender === "female" ? "default" : "outline"}
                  onClick={() => setGender("female")}
                >
                  أنثى
                </Button>
                <Button
                  variant={gender === "male" ? "default" : "outline"}
                  onClick={() => setGender("male")}
                >
                  ذكر
                </Button>
              </div>
              {gender === "male" && (
                <Alert className="mt-4">
                  <AlertTitle>لا ينطبق هذا الجزء</AlertTitle>
                  <AlertDescription>
                    حقوق الحمل والأمومة وساعة الرضاعة لا تنطبق، ويمكنك حفظ الخطوة والانتقال مباشرة
                    إلى الخطوة التالية.
                  </AlertDescription>
                </Alert>
              )}
            </Card>

            {showPregnancy && (
              <Card className="p-6">
                <h2 className="mb-3 font-bold">هل حدث حمل أثناء العلاقة العمالية؟</h2>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={hadPregnancy === true ? "default" : "outline"}
                    onClick={() => {
                      setHadPregnancy(true);
                      if (!leaves.length) setLeaves([emptyMaternityLeave()]);
                    }}
                  >
                    نعم
                  </Button>
                  <Button
                    variant={hadPregnancy === false ? "default" : "outline"}
                    onClick={() => setHadPregnancy(false)}
                  >
                    لا
                  </Button>
                </div>
                {hadPregnancy === false && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    لن تُحتسب مستحقات إجازة أمومة، وينتقل النظام إلى مرحلة ساعة الرضاعة إن كانت
                    منطبقة.
                  </p>
                )}
              </Card>
            )}

            {showPregnancy && hadPregnancy && (
              <>
                <Card className="p-6">
                  <h2 className="mb-4 font-bold">بيانات الحمل والولادة</h2>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label className="mb-1 block text-sm">تاريخ بداية الحمل (اختياري)</Label>
                      <Input
                        type="date"
                        value={pregnancyStart}
                        onChange={(e) => setPregnancyStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">تاريخ الولادة</Label>
                      <Input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">تاريخ الوضع الفعلي</Label>
                      <Input
                        type="date"
                        value={actualDelivery}
                        onChange={(e) => setActualDelivery(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">نوع الولادة (اختياري)</Label>
                      <Select value={deliveryType || "__none"} onValueChange={(v) => setDeliveryType(v === "__none" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_TYPES.map((t) => (
                            <SelectItem key={t.value || "__none"} value={t.value || "__none"}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">عدد المواليد</Label>
                      <Select value={multipleBirth} onValueChange={setMultipleBirth}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MULTIPLE_BIRTH_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <Label className="text-sm">هل كانت الولادة مبكرة؟</Label>
                      <Switch checked={earlyDelivery} onCheckedChange={setEarlyDelivery} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <Label className="text-sm">وفاة المولود</Label>
                      <Switch checked={newbornDeceased} onCheckedChange={setNewbornDeceased} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <Label className="text-sm">مضاعفات طبية موثقة</Label>
                      <Switch checked={complications} onCheckedChange={setComplications} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <Label className="text-sm">هل يوجد تقرير طبي؟</Label>
                      <Switch checked={hasDoc} onCheckedChange={setHasDoc} />
                    </div>
                  </div>

                  {hasDoc && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="mb-1 block text-sm">نوع المستند</Label>
                        <Select value={docType || "__none"} onValueChange={(v) => setDocType(v === "__none" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر نوع المستند" />
                          </SelectTrigger>
                          <SelectContent>
                            {MATERNITY_DOCUMENT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <FileField label="رفع المستند" value={docFile} onChange={setDocFile} />
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <Label className="text-sm">تغيّر الأجر أثناء إجازة الأمومة</Label>
                      <Switch checked={wageChanged} onCheckedChange={setWageChanged} />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">الأجر المعتمد في الحساب</Label>
                      <Select value={wageBasis} onValueChange={setWageBasis}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERNITY_WAGE_BASES.map((w) => (
                            <SelectItem key={w.value} value={w.value}>
                              {w.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="mb-3 font-bold">سياسة الأمومة المحمّلة من محرك القوانين</h2>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>مدة الإجازة النظامية: {analysis.policy.total_days} يوم</div>
                    <div>المدة المطبقة على الحالة: {analysis.legalTotalDays} يوم</div>
                    <div>ما قبل الوضع: {analysis.policy.pre_delivery_days} يوم</div>
                    <div>نسبة الأجر المطبقة: {Math.round(analysis.legalRate * 100)}%</div>
                    <div>الحد الأقصى للتمديد: {analysis.policy.max_extension_days} يوم</div>
                    <div>
                      التمديد: {analysis.policy.extension_paid ? "مدفوع الأجر" : "غير مدفوع الأجر"}
                    </div>
                    <div>
                      الحماية من الفصل:{" "}
                      {analysis.policy.termination_protected
                        ? `مقررة (${analysis.policy.protection_window_days} يوم)`
                        : "غير مقررة"}
                    </div>
                    <div>الأجر اليومي المعتمد: {money(analysis.dailyWage, currency)}</div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    الأساس النظامي: {analysis.policy.legal_basis} — مدة الخدمة المستمدة من العقود:{" "}
                    {span.start ?? "—"} إلى {span.end ?? "—"}
                  </p>
                </Card>

                <div className="space-y-4">
                  {leaves.map((r, i) => {
                    const res = analysis.leaves.find((l) => l.index === i);
                    return (
                      <Card key={r.id ?? i} className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="font-bold">إجازة الأمومة {i + 1}</h3>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLeaves((l) => l.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <Label className="mb-1 block text-sm">العقد المرتبط</Label>
                            <Select
                              value={r.contract_id || "__none"}
                              onValueChange={(v) =>
                                setLeave(i, { contract_id: v === "__none" ? "" : v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="غير محدد" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">غير محدد</SelectItem>
                                {(contracts.data ?? []).map((c: any, ci: number) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    العقد {ci + 1} — {c.start_date ?? "—"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">تاريخ بداية الإجازة</Label>
                            <Input
                              type="date"
                              value={r.leave_start}
                              onChange={(e) => setLeave(i, { leave_start: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">تاريخ نهاية الإجازة</Label>
                            <Input
                              type="date"
                              value={r.leave_end}
                              onChange={(e) => setLeave(i, { leave_end: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">تاريخ العودة للعمل</Label>
                            <Input
                              type="date"
                              value={r.return_to_work_date}
                              onChange={(e) => setLeave(i, { return_to_work_date: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">عدد الأيام</Label>
                            <Input
                              type="number"
                              min={0}
                              value={r.days}
                              onChange={(e) =>
                                setLeave(i, {
                                  days: e.target.value === "" ? "" : Number(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                            <Label className="text-sm">هل تم تمديد الإجازة؟</Label>
                            <Switch
                              checked={r.extended}
                              onCheckedChange={(v) => setLeave(i, { extended: v })}
                            />
                          </div>
                          {r.extended && (
                            <>
                              <div>
                                <Label className="mb-1 block text-sm">عدد أيام التمديد</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={r.extension_days}
                                  onChange={(e) =>
                                    setLeave(i, {
                                      extension_days:
                                        e.target.value === "" ? "" : Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label className="mb-1 block text-sm">سبب التمديد</Label>
                                <Input
                                  value={r.extension_reason}
                                  onChange={(e) =>
                                    setLeave(i, { extension_reason: e.target.value })
                                  }
                                />
                              </div>
                            </>
                          )}
                          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                            <Label className="text-sm">هل يوجد مستند مؤيد؟</Label>
                            <Switch
                              checked={r.has_document}
                              onCheckedChange={(v) => setLeave(i, { has_document: v })}
                            />
                          </div>
                          {r.has_document && (
                            <div className="md:col-span-2">
                              <FileField
                                label="رفع التقرير الطبي"
                                value={r.medical_report_file}
                                onChange={(v) => setLeave(i, { medical_report_file: v })}
                              />
                            </div>
                          )}
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          <div>
                            <Label className="mb-1 block text-sm">
                              هل تم صرف مستحقات إجازة الأمومة؟
                            </Label>
                            <Select
                              value={r.payment_status}
                              onValueChange={(v) =>
                                setLeave(i, { payment_status: v as MaternityPaymentStatus })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MATERNITY_PAYMENT_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {r.payment_status !== "unpaid" && (
                            <>
                              <div>
                                <Label className="mb-1 block text-sm">قيمة المبلغ المصروف</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={r.paid_amount}
                                  onChange={(e) =>
                                    setLeave(i, {
                                      paid_amount:
                                        e.target.value === "" ? "" : Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-sm">طريقة الصرف</Label>
                                <Select
                                  value={r.payment_method || "__none"}
                                  onValueChange={(v) =>
                                    setLeave(i, { payment_method: v === "__none" ? "" : v })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختر" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MATERNITY_PAYMENT_METHODS.map((m) => (
                                      <SelectItem key={m} value={m}>
                                        {m}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="mb-1 block text-sm">تاريخ الصرف</Label>
                                <Input
                                  type="date"
                                  value={r.payment_date}
                                  onChange={(e) => setLeave(i, { payment_date: e.target.value })}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <FileField
                                  label="إثبات السداد"
                                  value={r.payment_proof_file}
                                  onChange={(v) => setLeave(i, { payment_proof_file: v })}
                                />
                              </div>
                            </>
                          )}
                          <div className="md:col-span-3">
                            <Label className="mb-1 block text-sm">ملاحظات</Label>
                            <Textarea
                              rows={2}
                              value={r.notes}
                              onChange={(e) => setLeave(i, { notes: e.target.value })}
                            />
                          </div>
                        </div>

                        {!!res && (
                          <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <Badge variant="secondary">الأيام المحتسبة: {res.payableDays}</Badge>
                            <Badge variant="secondary">
                              النسبة: {Math.round(res.rate * 100)}%
                            </Badge>
                            <Badge variant="secondary">المستحق: {money(res.due, currency)}</Badge>
                            <Badge variant="secondary">المصروف: {money(res.paid, currency)}</Badge>
                            <Badge variant="secondary">
                              المستبعد: {money(res.excluded, currency)}
                            </Badge>
                            <Badge>المتبقي: {money(res.remaining, currency)}</Badge>
                          </div>
                        )}
                      </Card>
                    );
                  })}

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setLeaves((l) => [...l, emptyMaternityLeave()])}
                  >
                    <Plus className="h-4 w-4" /> إضافة إجازة أمومة
                  </Button>
                </div>

                <Card className="p-6">
                  <h2 className="mb-3 font-bold">
                    هل انتهت العلاقة العمالية أثناء الحمل أو أثناء إجازة الأمومة؟
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant={endedDuringProtection ? "default" : "outline"}
                      onClick={() => setEndedDuringProtection(true)}
                    >
                      نعم
                    </Button>
                    <Button
                      variant={!endedDuringProtection ? "default" : "outline"}
                      onClick={() => setEndedDuringProtection(false)}
                    >
                      لا
                    </Button>
                  </div>

                  {endedDuringProtection && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="mb-1 block text-sm">سبب انتهاء العلاقة</Label>
                        <Input
                          value={terminationReason}
                          onChange={(e) => setTerminationReason(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-sm">تاريخ الإنهاء</Label>
                        <Input
                          type="date"
                          value={terminationDate}
                          onChange={(e) => setTerminationDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-sm">الجهة التي أنهت العلاقة</Label>
                        <Select value={terminationParty} onValueChange={setTerminationParty}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر" />
                          </SelectTrigger>
                          <SelectContent>
                            {TERMINATION_PARTIES.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <FileField
                        label="المستندات المؤيدة"
                        value={terminationProof}
                        onChange={setTerminationProof}
                      />
                    </div>
                  )}

                  {!!analysis.protection.messages.length && (
                    <Alert className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>تحليل الحماية النظامية</AlertTitle>
                      <AlertDescription>
                        <ul className="list-inside list-disc space-y-1">
                          {analysis.protection.messages.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </Card>
              </>
            )}

            {showNursing && (
              <Card className="p-6">
                <h2 className="mb-3 font-bold">هل عادت العاملة للعمل بعد الولادة؟</h2>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={returnedToWork === true ? "default" : "outline"}
                    onClick={() => setReturnedToWork(true)}
                  >
                    نعم
                  </Button>
                  <Button
                    variant={returnedToWork === false ? "default" : "outline"}
                    onClick={() => {
                      setReturnedToWork(false);
                      setIsNursing(false);
                    }}
                  >
                    لا
                  </Button>
                </div>

                {returnedToWork && (
                  <>
                    <h3 className="mb-3 mt-6 font-bold">هل العاملة مرضعة؟</h3>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant={isNursing === true ? "default" : "outline"}
                        onClick={() => {
                          setIsNursing(true);
                          if (!nursing.length) setNursing([emptyNursingRow()]);
                        }}
                      >
                        نعم
                      </Button>
                      <Button
                        variant={isNursing === false ? "default" : "outline"}
                        onClick={() => setIsNursing(false)}
                      >
                        لا
                      </Button>
                    </div>
                  </>
                )}

                {returnedToWork && isNursing && (
                  <div className="mt-6 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      سياسة ساعة الرضاعة المحمّلة: {analysis.nursingPolicy.daily_reduction_hours} ساعة
                      يومياً لمدة {analysis.nursingPolicy.eligible_months} أشهر —{" "}
                      {analysis.nursingPolicy.paid ? "مدفوعة الأجر" : "غير مدفوعة الأجر"} —{" "}
                      {analysis.nursingPolicy.can_accumulate ? "يمكن تجميعها" : "لا يمكن تجميعها"} —{" "}
                      {analysis.nursingPolicy.legal_basis}
                    </p>

                    {nursing.map((r, i) => {
                      const res = analysis.nursing[i];
                      return (
                        <Card key={r.id ?? i} className="p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="font-bold">سجل الرضاعة {i + 1}</h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setNursing((l) => l.filter((_, idx) => idx !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div>
                              <Label className="mb-1 block text-sm">تاريخ الولادة</Label>
                              <Input
                                type="date"
                                value={r.delivery_date}
                                onChange={(e) =>
                                  setNursingRow(i, { delivery_date: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label className="mb-1 block text-sm">تاريخ العودة للعمل</Label>
                              <Input
                                type="date"
                                value={r.return_to_work_date}
                                onChange={(e) =>
                                  setNursingRow(i, { return_to_work_date: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label className="mb-1 block text-sm">
                                تاريخ انتهاء فترة الرضاعة (إن وجد)
                              </Label>
                              <Input
                                type="date"
                                value={r.nursing_end_date}
                                onChange={(e) =>
                                  setNursingRow(i, { nursing_end_date: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label className="mb-1 block text-sm">ساعات العمل اليومية</Label>
                              <Input
                                type="number"
                                min={1}
                                value={r.daily_working_hours}
                                onChange={(e) =>
                                  setNursingRow(i, {
                                    daily_working_hours:
                                      e.target.value === "" ? "" : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="mb-1 block text-sm">ملاحظات</Label>
                              <Input
                                value={r.notes}
                                onChange={(e) => setNursingRow(i, { notes: e.target.value })}
                              />
                            </div>
                          </div>
                          {!!res && (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <Badge variant="secondary">بداية الاستحقاق: {res.start || "—"}</Badge>
                              <Badge variant="secondary">نهاية الاستحقاق: {res.end || "—"}</Badge>
                              <Badge variant="secondary">الأيام: {res.days}</Badge>
                              <Badge variant="secondary">
                                التخفيض اليومي: {res.dailyReductionHours} ساعة
                              </Badge>
                              <Badge>إجمالي الساعات: {res.totalReductionHours}</Badge>
                            </div>
                          )}
                        </Card>
                      );
                    })}

                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => setNursing((l) => [...l, emptyNursingRow()])}
                    >
                      <Plus className="h-4 w-4" /> إضافة سجل رضاعة
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {gender === "female" && (
              <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-bold">ملخص الأمومة وساعة الرضاعة</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setRecalcKey((k) => k + 1)}
                  >
                    <RefreshCw className="h-4 w-4" /> إعادة الحساب
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="p-2 text-start">البداية</th>
                        <th className="p-2 text-start">النهاية</th>
                        <th className="p-2 text-start">الأيام</th>
                        <th className="p-2 text-start">المستحق</th>
                        <th className="p-2 text-start">المصروف</th>
                        <th className="p-2 text-start">المتبقي</th>
                        <th className="p-2 text-start">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.leaves.map((l) => (
                        <tr key={l.index} className="border-b last:border-0">
                          <td className="p-2">{l.start || "—"}</td>
                          <td className="p-2">{l.end || "—"}</td>
                          <td className="p-2">{l.payableDays}</td>
                          <td className="p-2">{money(l.due, currency)}</td>
                          <td className="p-2">{money(l.paid, currency)}</td>
                          <td className="p-2">{money(l.remaining, currency)}</td>
                          <td className="p-2">
                            {l.status === "unpaid"
                              ? "لم يُصرف"
                              : l.proven
                                ? "مصروف بإثبات"
                                : "مصروف دون إثبات"}
                          </td>
                        </tr>
                      ))}
                      {!analysis.leaves.length && (
                        <tr>
                          <td className="p-2 text-muted-foreground" colSpan={7}>
                            لا توجد إجازات أمومة مسجّلة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <h3 className="mb-2 text-sm font-bold">ساعة الرضاعة</h3>
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="p-2 text-start">بداية الاستحقاق</th>
                        <th className="p-2 text-start">نهاية الاستحقاق</th>
                        <th className="p-2 text-start">التخفيض اليومي</th>
                        <th className="p-2 text-start">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.nursing.map((x) => (
                        <tr key={x.index} className="border-b last:border-0">
                          <td className="p-2">{x.start || "—"}</td>
                          <td className="p-2">{x.end || "—"}</td>
                          <td className="p-2">{x.dailyReductionHours} ساعة</td>
                          <td className="p-2">
                            {x.status} {x.paid ? "— مدفوعة الأجر" : "— غير مدفوعة"}
                          </td>
                        </tr>
                      ))}
                      {!analysis.nursing.length && (
                        <tr>
                          <td className="p-2 text-muted-foreground" colSpan={4}>
                            لا توجد فترات رضاعة مسجّلة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">إجمالي المستحق</div>
                    <div className="font-bold">{money(analysis.totalDue, currency)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">المصروف</div>
                    <div className="font-bold">{money(analysis.totalPaid, currency)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">المستبعد بإثبات</div>
                    <div className="font-bold">{money(analysis.excludedAmount, currency)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">المتبقي المستحق</div>
                    <div className="font-bold">{money(analysis.remainingAmount, currency)}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border p-4">
                  <h3 className="mb-2 text-sm font-bold">طريقة الحساب خطوة بخطوة</h3>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                    {analysis.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>

                <div className="mt-4">
                  <Label className="mb-1 block text-sm">ملاحظات عامة</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </Card>
            )}

            {!!analysis.warnings.length && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>تنبيهات قانونية</AlertTitle>
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-1">
                    {analysis.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {touched && !!errors.length && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>يرجى تصحيح الأخطاء التالية</AlertTitle>
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-1">
                    {errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button asChild variant="ghost" className="gap-2">
                <Link to="/sa/sick-leave">
                  <ChevronRight className="h-4 w-4" /> الخطوة السابقة
                </Link>
              </Button>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={save.isPending}
                  onClick={() => void submit(false)}
                >
                  <Save className="h-4 w-4" /> حفظ
                </Button>
                <Button className="gap-2" disabled={save.isPending} onClick={() => void submit(true)}>
                  حفظ ومتابعة <ArrowLeft className="h-4 w-4" />
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
