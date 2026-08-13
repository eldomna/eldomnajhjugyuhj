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
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { money } from "@/lib/saudi/salary";
import { effectiveEnd } from "@/lib/saudi/contracts";
import {
  SI_EMPLOYMENT_CATEGORIES,
  SI_NATIONALITY_CATEGORIES,
  SI_PAYMENT_STATUSES,
  SI_PROOF_TYPES,
  SI_REGISTRATION_STATES,
  SI_REGISTRATION_STATUSES,
  SI_SECTORS,
  SI_SUBJECT_OPTIONS,
  analyzeSocialInsurance,
  emptyMonthRow,
  insurableWageBreakdown,
  monthName,
  serviceMonths,
  toSocialInsurancePolicy,
  validateSocialInsurance,
  type SIMonthRow,
  type SIPaymentStatus,
} from "@/lib/saudi/socialInsurance";

const ALLOWANCE_LABELS: Record<string, string> = {
  basic_salary: "الراتب الأساسي",
  housing_allowance: "بدل السكن",
  transport_allowance: "بدل النقل",
  communication_allowance: "بدل الاتصالات",
  work_nature_allowance: "بدل طبيعة العمل",
  risk_allowance: "بدل المخاطر",
  delegation_allowance: "بدل الانتداب",
  other_allowances: "بدلات أخرى",
  fixed_commission: "عمولة ثابتة",
  fixed_bonus: "مكافأة ثابتة",
  other_benefits: "مزايا أخرى",
};

export const Route = createFileRoute("/_authenticated/sa/social-insurance")({
  head: () => ({
    meta: [
      { title: "التأمينات الاجتماعية والاشتراكات — الخطوة 10 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة العاشرة: مراجعة التسجيل في التأمينات الاجتماعية واحتساب اشتراكات العامل وصاحب العمل واكتشاف الفروقات والانقطاعات.",
      },
      { property: "og:title", content: "التأمينات الاجتماعية والاشتراكات — الخطوة 10" },
      {
        property: "og:description",
        content:
          "احتساب الاشتراكات الشهرية وفق نسب وحدود قابلة للتحديث من محرك القوانين، مع كشف الفروقات وأشهر عدم التسجيل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SocialInsuranceStep,
});

function SocialInsuranceStep() {
  const draft = useCaseDraft("SA", 10);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [isSubject, setIsSubject] = useState("unknown");
  const [exemptionReason, setExemptionReason] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState("not_registered");
  const [registrationDate, setRegistrationDate] = useState("");
  const [coverageStart, setCoverageStart] = useState("");
  const [coverageEnd, setCoverageEnd] = useState("");
  const [nationalityCategory, setNationalityCategory] = useState("citizen");
  const [employmentCategory, setEmploymentCategory] = useState("full_time");
  const [sector, setSector] = useState("private");
  const [months, setMonths] = useState<SIMonthRow[]>([]);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const policyQuery = useQuery({
    queryKey: ["sa-social-insurance-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sa_regulatory_settings")
        .select("key, value")
        .eq("key", "social_insurance")
        .maybeSingle();
      if (error) throw error;
      return toSocialInsurancePolicy(data?.value);
    },
  });

  const salary = useQuery({
    queryKey: ["case-salary-si", caseId],
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

  const contracts = useQuery({
    queryKey: ["case-contracts-si", caseId],
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
    queryKey: ["case-social-insurance", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const [s, m] = await Promise.all([
        supabase.from("case_social_insurance").select("*").eq("case_id", caseId!).maybeSingle(),
        supabase
          .from("case_social_insurance_monthly")
          .select("*")
          .eq("case_id", caseId!)
          .order("sort_order"),
      ]);
      if (s.error) throw s.error;
      if (m.error) throw m.error;
      return { summary: s.data, months: m.data ?? [] };
    },
  });

  const policy = policyQuery.data;
  const currency = salary.data?.currency || "SAR";

  const breakdown = useMemo(
    () => (policy ? insurableWageBreakdown(salary.data as any, policy) : null),
    [policy, salary.data],
  );
  const baseInsurableWage = breakdown?.insurable ?? 0;

  const span = useMemo(() => {
    const list = contracts.data ?? [];
    const starts = list.map((c) => c.start_date).filter(Boolean) as string[];
    const ends = list.map((c) => effectiveEnd(c as any)).filter(Boolean) as string[];
    return {
      start: starts.length ? starts.slice().sort()[0] : null,
      end: ends.length ? ends.slice().sort().reverse()[0] : null,
    };
  }, [contracts.data]);

  // تحميل البيانات المحفوظة
  useEffect(() => {
    if (!saved.data || hydrated) return;
    const s = saved.data.summary;
    if (s) {
      setIsSubject(s.is_subject ?? "unknown");
      setExemptionReason(s.exemption_reason ?? "");
      setRegistrationNumber(s.registration_number ?? "");
      setRegistrationStatus(s.registration_status ?? "not_registered");
      setRegistrationDate(s.registration_date ?? "");
      setCoverageStart(s.coverage_start_date ?? "");
      setCoverageEnd(s.coverage_end_date ?? "");
      setNationalityCategory(s.nationality_category ?? "citizen");
      setEmploymentCategory(s.employment_category ?? "full_time");
      setSector(s.sector ?? "private");
      setNotes(s.notes ?? "");
    }
    if (saved.data.months.length) {
      setMonths(
        saved.data.months.map((r) => ({
          id: r.id,
          year: Number(r.contribution_year),
          month: Number(r.contribution_month),
          key: r.period_key || `${r.contribution_year}-${String(r.contribution_month).padStart(2, "0")}`,
          actual_wage: Number(r.actual_wage) || 0,
          registered_wage: Number(r.registered_wage) || 0,
          registration_state: r.registration_state ?? "registered",
          payment_status: (r.payment_status as SIPaymentStatus) ?? "unpaid",
          paid_amount: r.paid_amount == null ? "" : Number(r.paid_amount),
          payment_date: r.payment_date ?? "",
          payment_reference: r.payment_reference ?? "",
          payment_entity: r.payment_entity ?? "",
          payment_proof_type: r.payment_proof_type ?? "",
          payment_proof_file: r.payment_proof_file ?? "",
          notes: r.notes ?? "",
        })),
      );
    }
    setHydrated(true);
  }, [saved.data, hydrated]);

  // توليد أشهر الخدمة تلقائياً
  const generateMonths = (force = false) => {
    const list = serviceMonths(span.start, span.end);
    if (!list.length) {
      if (force) toast.error("لا توجد مدة خدمة محددة من الخطوة الثانية (العقود)");
      return;
    }
    setMonths((prev) => {
      const byKey = new Map(prev.map((r) => [r.key, r]));
      return list.map((m) => {
        const old = byKey.get(m.key);
        if (old && !force) return old;
        if (old)
          return { ...old, actual_wage: old.actual_wage === "" ? baseInsurableWage : old.actual_wage };
        return emptyMonthRow(m.year, m.month, baseInsurableWage);
      });
    });
  };

  useEffect(() => {
    if (!hydrated || months.length || !span.start || !baseInsurableWage) return;
    generateMonths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, span.start, span.end, baseInsurableWage]);

  const input = useMemo(
    () => ({
      isSubject,
      exemptionReason,
      registrationStatus,
      registrationDate,
      coverageStart,
      coverageEnd,
      nationalityCategory,
      employmentCategory,
      sector,
      months,
      baseInsurableWage,
      currency,
      policy,
      serviceStart: span.start,
      serviceEnd: span.end,
    }),
    [
      isSubject,
      exemptionReason,
      registrationStatus,
      registrationDate,
      coverageStart,
      coverageEnd,
      nationalityCategory,
      employmentCategory,
      sector,
      months,
      baseInsurableWage,
      currency,
      policy,
      span.start,
      span.end,
    ],
  );

  const analysis = useMemo(() => analyzeSocialInsurance(input), [input]);
  const errors = useMemo(
    () => validateSocialInsurance({ ...input, analysis }),
    [input, analysis],
  );
  const valid = errors.length === 0;

  const setMonth = (i: number, patch: Partial<SIMonthRow>) =>
    setMonths((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const uploadFile = async (file: File, onDone: (path: string) => void) => {
    try {
      setUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("انتهت الجلسة، يرجى إعادة الدخول");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${caseId}/insurance-${Date.now()}.${ext}`;
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

      const { data: summary, error: sumErr } = await supabase
        .from("case_social_insurance")
        .upsert(
          {
            case_id: caseId,
            is_subject: isSubject,
            exemption_reason: exemptionReason || null,
            registration_number: registrationNumber || null,
            registration_status: registrationStatus,
            registration_date: registrationDate || null,
            coverage_start_date: coverageStart || null,
            coverage_end_date: coverageEnd || null,
            nationality_category: nationalityCategory,
            employment_category: employmentCategory,
            sector,
            insurable_wage: analysis.baseInsurableWage,
            employee_contribution_rate: analysis.employeeRate,
            employer_contribution_rate: analysis.employerRate,
            employee_contribution_amount: analysis.monthlyEmployee,
            employer_contribution_amount: analysis.monthlyEmployer,
            total_contribution: analysis.monthlyEmployee + analysis.monthlyEmployer,
            total_due: analysis.totalDue,
            total_paid: analysis.totalPaid,
            total_difference: analysis.totalDifference,
            remaining_amount: analysis.totalRemaining,
            payment_status:
              analysis.totalRemaining <= 0 && analysis.totalDue > 0
                ? "paid"
                : analysis.totalPaid > 0
                  ? "partial"
                  : "unpaid",
            currency,
            applied_rule: analysis.policy as any,
            analysis: analysis as any,
            notes: notes || null,
          },
          { onConflict: "case_id" },
        )
        .select("id")
        .single();
      if (sumErr) throw sumErr;

      await supabase.from("case_social_insurance_monthly").delete().eq("case_id", caseId);

      if (isSubject === "yes" && months.length) {
        const { error } = await supabase.from("case_social_insurance_monthly").insert(
          months.map((r, i) => {
            const res = analysis.months[i];
            return {
              case_id: caseId,
              insurance_id: summary?.id ?? null,
              contribution_month: r.month,
              contribution_year: r.year,
              period_key: r.key,
              actual_wage: Number(r.actual_wage) || 0,
              insurable_wage: res?.insurableWage ?? 0,
              registered_wage: res?.registeredWage ?? 0,
              employee_rate: res?.employeeRate ?? 0,
              employer_rate: res?.employerRate ?? 0,
              employee_contribution: res?.employeeContribution ?? 0,
              employer_contribution: res?.employerContribution ?? 0,
              total_contribution: res?.total ?? 0,
              registration_state: r.registration_state,
              payment_status: r.payment_status,
              paid_amount: res?.paid ?? 0,
              remaining_amount: res?.remaining ?? 0,
              difference_amount: res?.difference ?? 0,
              payment_date: r.payment_date || null,
              payment_reference: r.payment_reference || null,
              payment_entity: r.payment_entity || null,
              payment_proof_type: r.payment_proof_type || null,
              payment_proof_file: r.payment_proof_file || null,
              currency,
              notes: r.notes || null,
              sort_order: i,
            };
          }),
        );
        if (error) throw error;
      }

      await draft.saveNowWith({
        social_insurance: {
          is_subject: isSubject,
          registration_status: registrationStatus,
          analysis,
          currency,
        },
      });
    },
    onSuccess: () => void saved.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات التأمينات"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (isSubject === "yes" && !valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ بيانات التأمينات الاجتماعية");
    if (thenNext) navigate({ to: "/sa/termination" });
  };

  const loading = draft.loading || saved.isLoading || contracts.isLoading || policyQuery.isLoading;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> الخطوة 10 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
            التأمينات الاجتماعية والاشتراكات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُحمّل نسب الاشتراك وحدود الأجر التأميني والفروع والاستثناءات تلقائياً من محرك القوانين
            للدولة المختارة، وتُطبق نسبة كل فترة وفق تاريخ سريانها.
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
            {/* الخطوة الأولى: الخضوع */}
            <Card className="p-6">
              <h2 className="mb-1 font-bold">
                هل يخضع العامل لنظام التأمينات الاجتماعية أو الضمان الاجتماعي في الدولة المختارة؟
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">
                النظام المطبق: {analysis.policy.system_name}
              </p>
              <div className="flex flex-wrap gap-3">
                {SI_SUBJECT_OPTIONS.map((o) => (
                  <Button
                    key={o.value}
                    variant={isSubject === o.value ? "default" : "outline"}
                    onClick={() => setIsSubject(o.value)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>

              {isSubject === "no" && (
                <div className="mt-4 space-y-3">
                  <Alert>
                    <AlertTitle>العامل غير خاضع للنظام</AlertTitle>
                    <AlertDescription>
                      لن يتم احتساب أي اشتراكات، وسيوضَّح سبب الإعفاء في التقرير النهائي. يمكنك حفظ
                      الخطوة والانتقال مباشرة إلى الخطوة التالية.
                    </AlertDescription>
                  </Alert>
                  <div>
                    <Label className="mb-1 block text-sm">سبب عدم الخضوع / الإعفاء</Label>
                    <Textarea
                      rows={2}
                      value={exemptionReason}
                      onChange={(e) => setExemptionReason(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </Card>

            {isSubject === "yes" && (
              <>
                {/* الخطوة الثانية: بيانات التسجيل */}
                <Card className="p-6">
                  <h2 className="mb-4 font-bold">بطاقة بيانات التسجيل</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label className="mb-1 block text-sm">رقم الاشتراك (اختياري)</Label>
                      <Input
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">حالة التسجيل</Label>
                      <Select value={registrationStatus} onValueChange={setRegistrationStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SI_REGISTRATION_STATUSES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">تاريخ التسجيل</Label>
                      <Input
                        type="date"
                        value={registrationDate}
                        onChange={(e) => setRegistrationDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">تاريخ بدء الاشتراك</Label>
                      <Input
                        type="date"
                        value={coverageStart}
                        onChange={(e) => setCoverageStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">تاريخ انتهاء الاشتراك (إن وجد)</Label>
                      <Input
                        type="date"
                        value={coverageEnd}
                        onChange={(e) => setCoverageEnd(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">مدة الخدمة (من الخطوة 2)</Label>
                      <Input readOnly value={`${span.start ?? "—"} → ${span.end ?? "مستمر"}`} />
                    </div>
                  </div>
                </Card>

                {/* الخطوة الثالثة: نوع العامل */}
                <Card className="p-6">
                  <h2 className="mb-1 font-bold">نوع العامل والقواعد المطبقة</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    تُجلب الجنسية والدولة والقطاع ونوع العقد من ملف القضية، ويمكن تعديل التصنيف
                    لتطبيق القاعدة الصحيحة.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label className="mb-1 block text-sm">الجنسية (من الخطوة 1)</Label>
                      <Input readOnly value={draft.info?.nationality || "—"} />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">فئة الجنسية</Label>
                      <Select value={nationalityCategory} onValueChange={setNationalityCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SI_NATIONALITY_CATEGORIES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">نوع العامل</Label>
                      <Select value={employmentCategory} onValueChange={setEmploymentCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SI_EMPLOYMENT_CATEGORIES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">القطاع</Label>
                      <Select value={sector} onValueChange={setSector}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SI_SECTORS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* الخطوة الرابعة: القواعد المحمّلة */}
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      title="نسبة اشتراك العامل"
                      value={`${(analysis.employeeRate * 100).toFixed(2)}%`}
                    />
                    <StatCard
                      title="نسبة اشتراك صاحب العمل"
                      value={`${(analysis.employerRate * 100).toFixed(2)}%`}
                    />
                    <StatCard
                      title="الحد الأدنى للأجر التأميني"
                      value={money(analysis.policy.min_insurable_wage, currency)}
                    />
                    <StatCard
                      title="الحد الأعلى للأجر التأميني"
                      value={money(analysis.policy.max_insurable_wage, currency)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>الفروع التأمينية:</span>
                    {analysis.branches.length ? (
                      analysis.branches.map((b) => (
                        <Badge key={b} variant="secondary">
                          {b}
                        </Badge>
                      ))
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    الأساس النظامي: {analysis.policy.legal_basis} — نسبة غرامة التأخير:{" "}
                    {(analysis.policy.late_penalty_rate * 100).toFixed(2)}%
                  </p>
                  {analysis.exemptByCategory && (
                    <Alert className="mt-4">
                      <AlertTitle>نوع عامل مستثنى</AlertTitle>
                      <AlertDescription>
                        هذا التصنيف مستثنى من الاشتراك وفق محرك القوانين، فلن تُحتسب أي اشتراكات.
                      </AlertDescription>
                    </Alert>
                  )}
                </Card>

                {/* الخطوة الخامسة: الأجر الخاضع */}
                <Card className="p-6">
                  <h2 className="mb-1 font-bold">الأجر الخاضع للاشتراك</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    يُحتسب الأجر التأميني من البدلات الداخلة فقط وفق محرك القوانين، ثم تُطبق الحدود.
                  </p>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <h3 className="mb-2 text-sm font-semibold">البدلات الداخلة في الأجر التأميني</h3>
                      <ul className="space-y-1 text-sm">
                        {(breakdown?.included ?? []).map((r) => (
                          <li key={r.key} className="flex justify-between">
                            <span>{ALLOWANCE_LABELS[r.key] ?? r.key}</span>
                            <span>{money(r.amount, currency)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border p-4">
                      <h3 className="mb-2 text-sm font-semibold">البدلات غير الداخلة</h3>
                      {breakdown?.excluded.length ? (
                        <ul className="space-y-1 text-sm">
                          {breakdown.excluded.map((r) => (
                            <li key={r.key} className="flex justify-between text-muted-foreground">
                              <span>{ALLOWANCE_LABELS[r.key] ?? r.key}</span>
                              <span>{money(r.amount, currency)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">لا توجد بدلات مستبعدة.</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <StatCard title="مجموع البدلات الداخلة" value={money(breakdown?.raw ?? 0, currency)} />
                    <StatCard title="الأجر الخاضع للاشتراك" value={money(baseInsurableWage, currency)} />
                    <StatCard
                      title="إجمالي الاشتراك الشهري"
                      value={money(analysis.monthlyEmployee + analysis.monthlyEmployer, currency)}
                    />
                  </div>
                  {breakdown?.cappedByMax && (
                    <p className="mt-2 text-xs text-amber-600">
                      تم تطبيق الحد الأعلى للأجر التأميني على الأجر المحتسب.
                    </p>
                  )}
                  {breakdown?.raisedByMin && (
                    <p className="mt-2 text-xs text-amber-600">
                      تم رفع الأجر إلى الحد الأدنى للأجر التأميني وفق القاعدة النظامية.
                    </p>
                  )}
                </Card>

                {/* الخطوات 6-8: جدول الأشهر */}
                <Card className="p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold">بطاقة الاشتراكات الشهرية</h2>
                      <p className="text-sm text-muted-foreground">
                        مراجعة جميع أشهر الخدمة ({analysis.monthsCount} شهراً) مع حالة التسجيل والسداد.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="gap-2" onClick={() => generateMonths(false)}>
                        <RefreshCw className="h-4 w-4" /> تحديث الاشتراكات
                      </Button>
                      <Button variant="outline" className="gap-2" onClick={() => generateMonths(true)}>
                        <RefreshCw className="h-4 w-4" /> إعادة الحساب من الأجر
                      </Button>
                    </div>
                  </div>

                  {!months.length && (
                    <p className="text-sm text-muted-foreground">
                      لا توجد أشهر بعد. تأكد من إدخال العقود (الخطوة 2) والراتب (الخطوة 4) ثم اضغط
                      «تحديث الاشتراكات».
                    </p>
                  )}

                  <div className="space-y-4">
                    {months.map((row, i) => {
                      const res = analysis.months[i];
                      return (
                        <div key={row.key} className="rounded-lg border p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {monthName(row.month)} {row.year}
                              </span>
                              <Badge variant={res?.counted ? "secondary" : "outline"}>
                                {SI_REGISTRATION_STATES.find((s) => s.value === row.registration_state)
                                  ?.label ?? row.registration_state}
                              </Badge>
                              {res?.proofMissing && (
                                <Badge variant="destructive">سداد دون مستند</Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMonths((l) => l.filter((_, idx) => idx !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <Label className="mb-1 block text-xs">الأجر الفعلي</Label>
                              <Input
                                type="number"
                                value={row.actual_wage}
                                onChange={(e) =>
                                  setMonth(i, {
                                    actual_wage: e.target.value === "" ? "" : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label className="mb-1 block text-xs">الأجر المسجل بالتأمينات</Label>
                              <Input
                                type="number"
                                value={row.registered_wage}
                                onChange={(e) =>
                                  setMonth(i, {
                                    registered_wage:
                                      e.target.value === "" ? "" : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label className="mb-1 block text-xs">حالة التسجيل</Label>
                              <Select
                                value={row.registration_state}
                                onValueChange={(v) => setMonth(i, { registration_state: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SI_REGISTRATION_STATES.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="mb-1 block text-xs">هل تم سداد الاشتراكات؟</Label>
                              <Select
                                value={row.payment_status}
                                onValueChange={(v) =>
                                  setMonth(i, { payment_status: v as SIPaymentStatus })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SI_PAYMENT_STATUSES.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {row.payment_status !== "unpaid" && (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div>
                                <Label className="mb-1 block text-xs">قيمة المسدد</Label>
                                <Input
                                  type="number"
                                  value={row.paid_amount}
                                  onChange={(e) =>
                                    setMonth(i, {
                                      paid_amount:
                                        e.target.value === "" ? "" : Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-xs">تاريخ السداد</Label>
                                <Input
                                  type="date"
                                  value={row.payment_date}
                                  onChange={(e) => setMonth(i, { payment_date: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-xs">رقم العملية</Label>
                                <Input
                                  value={row.payment_reference}
                                  onChange={(e) =>
                                    setMonth(i, { payment_reference: e.target.value })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-xs">الجهة</Label>
                                <Input
                                  value={row.payment_entity}
                                  onChange={(e) => setMonth(i, { payment_entity: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-xs">نوع إثبات السداد</Label>
                                <Select
                                  value={row.payment_proof_type}
                                  onValueChange={(v) => setMonth(i, { payment_proof_type: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختر" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SI_PROOF_TYPES.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="sm:col-span-2 lg:col-span-3">
                                <Label className="mb-1 block text-xs">إثبات السداد</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    disabled={uploading}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f)
                                        void uploadFile(f, (p) =>
                                          setMonth(i, { payment_proof_file: p }),
                                        );
                                    }}
                                  />
                                  {!!row.payment_proof_file && (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => void openFile(row.payment_proof_file)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => void openFile(row.payment_proof_file, true)}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setMonth(i, { payment_proof_file: "" })}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                                {res?.proofMissing && (
                                  <p className="mt-1 text-xs text-amber-600">
                                    تم تسجيل وجود سداد دون مستند مؤيد، وقد يتطلب ذلك التحقق عند
                                    المراجعة القانونية.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 grid gap-2 rounded-md bg-muted/50 p-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
                            <Fact label="الأجر الخاضع" value={money(res?.insurableWage ?? 0, currency)} />
                            <Fact
                              label="اشتراك العامل"
                              value={money(res?.employeeContribution ?? 0, currency)}
                            />
                            <Fact
                              label="اشتراك صاحب العمل"
                              value={money(res?.employerContribution ?? 0, currency)}
                            />
                            <Fact label="الإجمالي" value={money(res?.total ?? 0, currency)} />
                            <Fact label="المسدد" value={money(res?.paid ?? 0, currency)} />
                            <Fact label="المتبقي" value={money(res?.remaining ?? 0, currency)} />
                          </div>

                          <div className="mt-3">
                            <Label className="mb-1 block text-xs">ملاحظات</Label>
                            <Input
                              value={row.notes}
                              onChange={(e) => setMonth(i, { notes: e.target.value })}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* الخطوات 9-10: الفروقات */}
                <Card className="p-6">
                  <h2 className="mb-4 font-bold">الفروقات والملخص المالي</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="إجمالي الاشتراكات المستحقة" value={money(analysis.totalDue, currency)} />
                    <StatCard title="اشتراكات العامل" value={money(analysis.totalEmployee, currency)} />
                    <StatCard title="اشتراكات صاحب العمل" value={money(analysis.totalEmployer, currency)} />
                    <StatCard title="المسدد" value={money(analysis.totalPaid, currency)} />
                    <StatCard title="المتبقي" value={money(analysis.totalRemaining, currency)} />
                    <StatCard title="فروقات الأجر المسجل" value={money(analysis.totalDifference, currency)} />
                    <StatCard title="أشهر عدم التسجيل" value={`${analysis.unregisteredMonths} شهر`} />
                    <StatCard title="أشهر التسجيل الناقص" value={`${analysis.partialMonths} شهر`} />
                  </div>
                </Card>

                {/* طريقة الحساب */}
                <Card className="p-6">
                  <h2 className="mb-3 font-bold">طريقة الحساب خطوة بخطوة</h2>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                    {analysis.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </Card>
              </>
            )}

            <Card className="p-6">
              <Label className="mb-1 block text-sm">ملاحظات عامة</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Card>

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
                <Link to="/sa/maternity">
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

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
