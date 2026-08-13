import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ContactBar } from "@/components/ContactBar";
import { FooterAttribution } from "@/components/FooterAttribution";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Hourglass,
  Info,
  RefreshCw,
  Save,
  ScrollText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { fmtDate, type Contract, type RenewItem } from "@/lib/saudi/contracts";
import {
  addDays,
  analyzeReTrial,
  diffDays,
  emptyReTrial,
  emptyTrial,
  validateTrial,
  verifyTermination,
  type ReTrialAnswers,
  type TerminationRight,
  type TrialPeriod,
  type WhoTerminated,
} from "@/lib/saudi/trialPeriod";

export const Route = createFileRoute("/_authenticated/sa/trial-periods")({
  head: () => ({
    meta: [
      { title: "فترة التجربة — الخطوة 3 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة الثالثة: فترة تجربة مستقلة لكل عقد مع التمديد وحق الإنهاء والتحقق من صحة الإنهاء وإعادة فترة التجربة.",
      },
      { property: "og:title", content: "فترة التجربة — الخطوة 3" },
      { property: "og:description", content: "إدارة فترة التجربة لكل عقد على حدة مع تحليل قانوني فوري." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrialPeriodsStep,
});

type TrialRow = TrialPeriod & { id: string; case_id: string; renew_history?: RenewItem[] };

function TrialPeriodsStep() {
  const draft = useCaseDraft("SA", 3);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const caseId = draft.draftId;

  const [index, setIndex] = useState(0);
  const [forms, setForms] = useState<Record<string, TrialPeriod>>({});
  const [retrial, setRetrial] = useState<ReTrialAnswers>(emptyReTrial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const contracts = useQuery({
    queryKey: ["case-contracts", caseId],
    enabled: !!caseId,
    queryFn: async (): Promise<Contract[]> => {
      const { data, error } = await supabase
        .from("case_contracts")
        .select("*")
        .eq("case_id", caseId!)
        .is("deleted_at", null)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as Contract[]).map((c) => ({
        ...c,
        renew_history: Array.isArray(c.renew_history) ? c.renew_history : [],
      }));
    },
  });

  const trials = useQuery({
    queryKey: ["trial-periods", caseId],
    enabled: !!caseId,
    queryFn: async (): Promise<TrialRow[]> => {
      const { data, error } = await supabase
        .from("contract_trial_periods")
        .select("*")
        .eq("case_id", caseId!);
      if (error) throw error;
      return (data ?? []) as unknown as TrialRow[];
    },
  });

  const list = contracts.data ?? [];

  useEffect(() => {
    if (!list.length) return;
    setForms((prev) => {
      const next = { ...prev };
      list.forEach((c) => {
        if (next[c.id]) return;
        const saved = trials.data?.find((t) => t.contract_id === c.id);
        next[c.id] = saved
          ? {
              ...emptyTrial(c.id),
              ...saved,
              re_trial_analysis: saved.re_trial_analysis ?? {},
            }
          : emptyTrial(c.id);
      });
      return next;
    });
    const anySaved = trials.data?.find((t) => (t.re_trial_analysis as ReTrialAnswers)?.worked_before !== undefined);
    if (anySaved) setRetrial({ ...emptyReTrial, ...(anySaved.re_trial_analysis as ReTrialAnswers) });
  }, [list, trials.data]);

  const current = list[index];
  const form = current ? forms[current.id] ?? emptyTrial(current.id) : null;

  const set = <K extends keyof TrialPeriod>(k: K, v: TrialPeriod[K]) => {
    if (!current) return;
    setForms((s) => ({ ...s, [current.id]: { ...(s[current.id] ?? emptyTrial(current.id)), [k]: v } }));
  };

  // احتساب تاريخ النهاية تلقائياً من المدة
  useEffect(() => {
    if (!form || !current) return;
    if (form.has_trial_period && form.trial_start_date && form.trial_duration_days && form.trial_duration_days > 0) {
      const end = addDays(form.trial_start_date, form.trial_duration_days);
      if (end !== form.trial_end_date) set("trial_end_date", end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.trial_start_date, form?.trial_duration_days, form?.has_trial_period]);

  useEffect(() => {
    if (!form) return;
    if (form.is_extended && form.extension_start_date && form.extension_duration_days && form.extension_duration_days > 0) {
      const end = addDays(form.extension_start_date, form.extension_duration_days);
      if (end !== form.extension_end_date) set("extension_end_date", end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.extension_start_date, form?.extension_duration_days, form?.is_extended]);

  const errors = useMemo(
    () => (form && current ? validateTrial(form, current) : {}),
    [form, current],
  );
  const verdict = useMemo(() => (form ? verifyTermination(form) : null), [form]);
  const retrialAnalysis = useMemo(() => analyzeReTrial(retrial), [retrial]);

  const save = useMutation({
    mutationFn: async (t: TrialPeriod) => {
      if (!caseId) throw new Error("لا توجد قضية محفوظة");
      const payload = {
        case_id: caseId,
        contract_id: t.contract_id,
        has_trial_period: t.has_trial_period,
        trial_start_date: t.has_trial_period ? t.trial_start_date : null,
        trial_duration_days: t.has_trial_period ? t.trial_duration_days : null,
        trial_end_date: t.has_trial_period ? t.trial_end_date : null,
        is_extended: t.has_trial_period ? t.is_extended : false,
        extension_duration_days: t.is_extended ? t.extension_duration_days : null,
        extension_reason: t.is_extended ? t.extension_reason : null,
        extension_start_date: t.is_extended ? t.extension_start_date : null,
        extension_end_date: t.is_extended ? t.extension_end_date : null,
        termination_right: t.has_trial_period ? t.termination_right : null,
        ended_during_trial: t.has_trial_period ? t.ended_during_trial : false,
        who_terminated: t.ended_during_trial ? t.who_terminated : null,
        re_trial_analysis: analyzeReTrial(retrial) as never,
      };
      const { error } = await supabase
        .from("contract_trial_periods")
        .upsert(payload, { onConflict: "contract_id" });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["trial-periods", caseId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات فترة التجربة"),
  });

  const saveAndNextContract = async () => {
    if (!form || !current) return;
    setTouched((t) => ({ ...t, [current.id]: true }));
    if (form.has_trial_period && Object.keys(errors).length > 0) {
      toast.error("يرجى تصحيح البيانات قبل الانتقال إلى العقد التالي");
      return;
    }
    await save.mutateAsync(form);
    toast.success(form.has_trial_period ? "تم حفظ فترة التجربة" : "تم الحفظ: لا توجد فترة تجربة لهذا العقد");
    if (index < list.length - 1) setIndex((i) => i + 1);
  };

  const savedIds = new Set((trials.data ?? []).map((t) => t.contract_id));

  const finalChecks = useMemo(() => {
    const checks = [
      { ok: list.length > 0, label: "وجود عقد واحد على الأقل" },
      { ok: list.every((c) => savedIds.has(c.id)), label: "اكتمال بيانات فترة التجربة لكل عقد" },
      {
        ok: list.every((c) => {
          const f = forms[c.id];
          return f ? Object.keys(validateTrial(f, c)).length === 0 : false;
        }),
        label: "صحة التواريخ وعدم تعارض البيانات",
      },
      {
        ok: list.every((c) => {
          const f = forms[c.id];
          if (!f?.is_extended) return true;
          return (f.trial_duration_days ?? 0) + (f.extension_duration_days ?? 0) <= 180;
        }),
        label: "عدم تجاوز مدة التمديد للحد النظامي",
      },
      { ok: retrialAnalysis.reasons.length > 0, label: "نجاح تحليل إعادة فترة التجربة" },
    ];
    return { checks, allOk: checks.every((c) => c.ok) };
  }, [list, forms, savedIds, retrialAnalysis]);

  const goNext = async () => {
    if (!finalChecks.allOk) {
      toast.error("لا يمكن الانتقال قبل اكتمال بيانات جميع العقود");
      return;
    }
    const ok = await draft.saveNowWith({
      trial_periods: {
        contracts: list.map((c) => {
          const f = forms[c.id];
          return {
            contract_number: c.contract_number,
            has_trial_period: f?.has_trial_period ?? false,
            trial_days: f?.trial_duration_days ?? 0,
            extension_days: f?.extension_duration_days ?? 0,
            total_trial_days: (f?.trial_duration_days ?? 0) + (f?.extension_duration_days ?? 0),
            termination_right: f?.termination_right ?? null,
            ended_during_trial: f?.ended_during_trial ?? false,
            who_terminated: f?.who_terminated ?? null,
            termination_lawful: f ? verifyTermination(f).lawful : true,
          };
        }),
        re_trial_analysis: retrialAnalysis,
      },
    });
    if (!ok) {
      toast.error("تعذّر حفظ نتائج الخطوة، أعد المحاولة");
      return;
    }
    navigate({ to: "/sa/salary" });
  };

  const showErr = (k: string) =>
    current && touched[current.id] && errors[k] ? (
      <p className="text-[11px] font-medium text-destructive">{errors[k]}</p>
    ) : null;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Hourglass className="h-3.5 w-3.5" /> الخطوة 3 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">🇸🇦 إدارة فترة التجربة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            فترة تجربة مستقلة لكل عقد — لا تُستخدم بيانات عقد لعقد آخر.
          </p>
        </div>

        {(draft.loading || contracts.isLoading) && (
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-32 w-full" />
          </Card>
        )}

        {!draft.loading && !caseId && (
          <Card className="p-8 text-center">
            <ScrollText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="mb-1 font-bold">أكمل الخطوات السابقة أولاً</h2>
            <Button asChild className="mt-3 gap-2">
              <Link to="/sa/case-info">
                <ChevronRight className="h-4 w-4" /> الخطوة 1: بيانات القضية
              </Link>
            </Button>
          </Card>
        )}

        {caseId && contracts.isError && (
          <Card className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <p className="mb-4 text-sm text-muted-foreground">
              {(contracts.error as Error)?.message ?? "تعذّر تحميل العقود"}
            </p>
            <Button variant="outline" className="gap-2" onClick={() => void contracts.refetch()}>
              <RefreshCw className="h-4 w-4" /> إعادة المحاولة
            </Button>
          </Card>
        )}

        {caseId && !contracts.isLoading && !contracts.isError && list.length === 0 && (
          <Card className="p-8 text-center">
            <ScrollText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="mb-1 font-bold">لا توجد عقود</h2>
            <p className="mb-4 text-sm text-muted-foreground">أضف العقود في الخطوة الثانية أولاً.</p>
            <Button asChild className="gap-2">
              <Link to="/sa/contracts">
                <ChevronRight className="h-4 w-4" /> الخطوة 2: بيانات العقود
              </Link>
            </Button>
          </Card>
        )}

        {caseId && current && form && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              {/* شريط العقود */}
              <Card className="flex flex-wrap items-center gap-2 p-3">
                {list.map((c, i) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={i === index ? "default" : "outline"}
                    className="gap-1"
                    onClick={() => setIndex(i)}
                  >
                    عقد {c.contract_number}
                    {savedIds.has(c.id) && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </Button>
                ))}
              </Card>

              <Card className="space-y-5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      عقد رقم {current.contract_number}
                      {current.contract_name ? ` — ${current.contract_name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(current.start_date)} → {fmtDate(current.actual_end_date ?? current.end_date)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    العقد {index + 1} من {list.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">هل يحتوي هذا العقد على فترة تجربة؟</Label>
                  <RadioGroup
                    className="flex gap-6"
                    value={form.has_trial_period ? "yes" : "no"}
                    onValueChange={(v) => set("has_trial_period", v === "yes")}
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="yes" /> نعم
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="no" /> لا
                    </label>
                  </RadioGroup>
                </div>

                {form.has_trial_period && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">تاريخ بداية فترة التجربة</Label>
                        <Input
                          type="date"
                          dir="ltr"
                          value={form.trial_start_date ?? ""}
                          onChange={(e) => set("trial_start_date", e.target.value || null)}
                        />
                        {showErr("trial_start_date")}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">مدة فترة التجربة (بالأيام)</Label>
                        <Input
                          type="number"
                          dir="ltr"
                          min={1}
                          value={form.trial_duration_days ?? ""}
                          onChange={(e) =>
                            set("trial_duration_days", e.target.value ? Number(e.target.value) : null)
                          }
                        />
                        {showErr("trial_duration_days")}
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">تاريخ نهاية فترة التجربة (يُحتسب تلقائياً)</Label>
                        <Input
                          type="date"
                          dir="ltr"
                          value={form.trial_end_date ?? ""}
                          onChange={(e) => set("trial_end_date", e.target.value || null)}
                        />
                        {showErr("trial_end_date")}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">هل تم تمديد فترة التجربة؟</Label>
                      <RadioGroup
                        className="flex gap-6"
                        value={form.is_extended ? "yes" : "no"}
                        onValueChange={(v) => set("is_extended", v === "yes")}
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="yes" /> نعم
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="no" /> لا
                        </label>
                      </RadioGroup>
                    </div>

                    {form.is_extended && (
                      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">مدة التمديد (بالأيام)</Label>
                          <Input
                            type="number"
                            dir="ltr"
                            min={1}
                            value={form.extension_duration_days ?? ""}
                            onChange={(e) =>
                              set("extension_duration_days", e.target.value ? Number(e.target.value) : null)
                            }
                          />
                          {showErr("extension_duration_days")}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">تاريخ بداية التمديد</Label>
                          <Input
                            type="date"
                            dir="ltr"
                            value={form.extension_start_date ?? ""}
                            onChange={(e) => set("extension_start_date", e.target.value || null)}
                          />
                          {showErr("extension_start_date")}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">تاريخ نهاية التمديد (يُحتسب تلقائياً)</Label>
                          <Input
                            type="date"
                            dir="ltr"
                            value={form.extension_end_date ?? ""}
                            onChange={(e) => set("extension_end_date", e.target.value || null)}
                          />
                          {showErr("extension_end_date")}
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">سبب التمديد</Label>
                          <Textarea
                            rows={2}
                            value={form.extension_reason ?? ""}
                            onChange={(e) => set("extension_reason", e.target.value || null)}
                          />
                          {showErr("extension_reason")}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">
                        من يحق له إنهاء العقد أثناء فترة التجربة؟
                      </Label>
                      <RadioGroup
                        className="flex flex-wrap gap-6"
                        value={form.termination_right ?? ""}
                        onValueChange={(v) => set("termination_right", v as TerminationRight)}
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="worker" /> العامل فقط
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="employer" /> صاحب العمل فقط
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="both" /> كلا الطرفين
                        </label>
                      </RadioGroup>
                      {showErr("termination_right")}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">هل انتهى العقد أثناء فترة التجربة؟</Label>
                      <RadioGroup
                        className="flex gap-6"
                        value={form.ended_during_trial ? "yes" : "no"}
                        onValueChange={(v) => set("ended_during_trial", v === "yes")}
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="yes" /> نعم
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="no" /> لا
                        </label>
                      </RadioGroup>
                    </div>

                    {form.ended_during_trial && (
                      <div className="space-y-2 rounded-lg border p-4">
                        <Label className="text-sm font-semibold">من الذي أنهى العقد؟</Label>
                        <RadioGroup
                          className="flex gap-6"
                          value={form.who_terminated ?? ""}
                          onValueChange={(v) => set("who_terminated", v as WhoTerminated)}
                        >
                          <label className="flex items-center gap-2 text-sm">
                            <RadioGroupItem value="worker" /> العامل
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <RadioGroupItem value="employer" /> صاحب العمل
                          </label>
                        </RadioGroup>
                        {showErr("who_terminated")}
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronRight className="h-4 w-4" /> العقد السابق
                  </Button>
                  <Button className="gap-2" disabled={save.isPending} onClick={() => void saveAndNextContract()}>
                    <Save className="h-4 w-4" />
                    {index < list.length - 1 ? "حفظ والانتقال للعقد التالي" : "حفظ بيانات هذا العقد"}
                  </Button>
                </div>
              </Card>

              {/* إعادة فترة التجربة */}
              <Card className="space-y-4 p-5">
                <h2 className="font-bold">التحقق من إعادة فترة التجربة</h2>
                <YesNo
                  label="هل سبق للعامل العمل لدى نفس صاحب العمل؟"
                  value={retrial.worked_before}
                  onChange={(v) => setRetrial((s) => ({ ...s, worked_before: v }))}
                />
                {retrial.worked_before && (
                  <div className="space-y-4 rounded-lg border p-4">
                    <YesNo
                      label="هل الوظيفة الجديدة مختلفة اختلافاً جوهرياً؟"
                      value={retrial.materially_different_job}
                      onChange={(v) => setRetrial((s) => ({ ...s, materially_different_job: v }))}
                    />
                    <YesNo
                      label="هل يوجد عقد جديد مستقل؟"
                      value={retrial.new_independent_contract}
                      onChange={(v) => setRetrial((s) => ({ ...s, new_independent_contract: v }))}
                    />
                    <YesNo
                      label="هل يسمح النظام بإعادة فترة التجربة؟"
                      value={retrial.system_allows_retrial}
                      onChange={(v) => setRetrial((s) => ({ ...s, system_allows_retrial: v }))}
                    />
                  </div>
                )}
              </Card>
            </div>

            {/* لوحة التحليل */}
            <div className="space-y-4 lg:col-span-2">
              <Card className="p-5">
                <h2 className="mb-3 flex items-center gap-2 font-bold">
                  <Info className="h-4 w-4 text-primary" /> ملخص فترة التجربة
                </h2>
                <dl className="space-y-2 text-sm">
                  <Fact label="فترة تجربة" value={form.has_trial_period ? "نعم" : "لا"} />
                  {form.has_trial_period && (
                    <>
                      <Fact label="المدة" value={`${form.trial_duration_days ?? 0} يوم`} />
                      <Fact label="من" value={fmtDate(form.trial_start_date)} />
                      <Fact label="إلى" value={fmtDate(form.trial_end_date)} />
                      <Fact label="تمديد" value={form.is_extended ? `${form.extension_duration_days ?? 0} يوم` : "لا"} />
                      <Fact
                        label="إجمالي التجربة"
                        value={`${(form.trial_duration_days ?? 0) + (form.is_extended ? form.extension_duration_days ?? 0 : 0)} يوم`}
                      />
                      {form.trial_start_date && form.trial_end_date && (
                        <Fact
                          label="فرق التواريخ"
                          value={`${diffDays(form.trial_start_date, form.trial_end_date)} يوم`}
                        />
                      )}
                    </>
                  )}
                </dl>
              </Card>

              {verdict?.checked && (
                <Alert variant={verdict.lawful ? "default" : "destructive"}>
                  {verdict.lawful ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <AlertTitle>{verdict.lawful ? "إنهاء صحيح أثناء فترة التجربة" : "إنهاء مخالف للعقد"}</AlertTitle>
                  <AlertDescription className="text-xs">
                    <p>{verdict.message}</p>
                    <ul className="mt-1 list-disc space-y-1 pe-4">
                      {verdict.effects.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Alert variant={retrialAnalysis.valid ? "default" : "destructive"}>
                {retrialAnalysis.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <AlertTitle>
                  {retrialAnalysis.valid ? "إعادة فترة التجربة صحيحة" : "تنبيه: إعادة فترة التجربة غير صحيحة"}
                </AlertTitle>
                <AlertDescription className="text-xs">
                  <ul className="mt-1 list-disc space-y-1 pe-4">
                    {retrialAnalysis.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <p className="mt-2">لا يتم حذف أي بيانات — تُستخدم هذه النتيجة لاحقاً في التعويضات.</p>
                </AlertDescription>
              </Alert>

              <Card className="p-5">
                <h3 className="mb-3 font-bold">التحقق النهائي</h3>
                <ul className="space-y-2 text-xs">
                  {finalChecks.checks.map((c) => (
                    <li key={c.label} className="flex items-center gap-2">
                      {c.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={c.ok ? "" : "text-destructive"}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        )}

        {caseId && list.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" className="gap-1">
              <Link to="/sa/contracts">
                <ChevronRight className="h-4 w-4" /> السابق: بيانات العقود
              </Link>
            </Button>
            <Button className="gap-2" disabled={!finalChecks.allOk} onClick={() => void goNext()}>
              التالي: بيانات الراتب <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t bg-card/50">
        <div className="container mx-auto px-4 py-4 text-center">
          <FooterAttribution />
          <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
            <ContactBar className="mb-3" />
            <p>© {new Date().getFullYear()} حاسبة العمال الذكية</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <RadioGroup className="flex gap-6" value={value ? "yes" : "no"} onValueChange={(v) => onChange(v === "yes")}>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="yes" /> نعم
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="no" /> لا
        </label>
      </RadioGroup>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed pb-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
