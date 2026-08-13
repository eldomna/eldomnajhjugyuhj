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
  ChevronRight,
  Download,
  Eye,
  HeartPulse,
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
  MEDICAL_REPORT_TYPES,
  SICK_LEAVE_KINDS,
  SICK_PAYMENT_METHODS,
  SICK_PAYMENT_STATUSES,
  SICK_WAGE_BASES,
  analyzeSickLeave,
  emptySickLeave,
  inclusiveDays,
  toSickPolicy,
  validateSickLeave,
  type SickLeaveRow,
  type SickPaymentStatus,
} from "@/lib/saudi/sickLeave";

export const Route = createFileRoute("/_authenticated/sa/sick-leave")({
  head: () => ({
    meta: [
      { title: "الإجازة المرضية — الخطوة 8 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة الثامنة: احتساب مدد الإجازة المرضية ونسب الأجر لكل مرحلة والتحقق من التقارير الطبية وإثباتات السداد.",
      },
      { property: "og:title", content: "الإجازة المرضية — الخطوة 8" },
      {
        property: "og:description",
        content:
          "تقسيم الإجازة المرضية إلى مراحل بنسب أجر قابلة للتحديث من محرك القوانين واحتساب المتبقي المستحق.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SickLeaveStep,
});

function SickLeaveStep() {
  const draft = useCaseDraft("SA", 8);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [hasSick, setHasSick] = useState<boolean | null>(null);
  const [rows, setRows] = useState<SickLeaveRow[]>([]);
  const [endedDuringLeave, setEndedDuringLeave] = useState(false);
  const [wageChanged, setWageChanged] = useState(false);
  const [wageBasis, setWageBasis] = useState("last_actual_wage");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recalcKey, setRecalcKey] = useState(0);

  const policyQuery = useQuery({
    queryKey: ["sa-sick-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sa_regulatory_settings")
        .select("value")
        .eq("key", "sick_leave")
        .maybeSingle();
      if (error) throw error;
      return toSickPolicy(data?.value);
    },
  });

  const salary = useQuery({
    queryKey: ["case-salary-sick", caseId],
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
    queryKey: ["case-contracts-sick", caseId],
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
    queryKey: ["case-sick-leave", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const [l, s] = await Promise.all([
        supabase.from("case_sick_leaves").select("*").eq("case_id", caseId!).order("sort_order"),
        supabase
          .from("case_sick_leave_summary")
          .select("*")
          .eq("case_id", caseId!)
          .maybeSingle(),
      ]);
      if (l.error) throw l.error;
      if (s.error) throw s.error;
      return { leaves: l.data ?? [], summary: s.data };
    },
  });

  useEffect(() => {
    if (!saved.data) return;
    if (saved.data.leaves.length) {
      setRows(
        saved.data.leaves.map((r) => ({
          id: r.id,
          contract_id: r.contract_id ?? "",
          start_date: r.start_date ?? "",
          end_date: r.end_date ?? "",
          days: r.total_days == null ? "" : Number(r.total_days),
          leave_kind: r.leave_kind ?? "sick",
          illness_reason: r.illness_reason ?? "",
          medical_provider: r.medical_provider ?? "",
          medical_report_number: r.medical_report_number ?? "",
          has_medical_report: !!r.has_medical_report,
          medical_report_type: r.medical_report_type ?? "",
          medical_report_file: r.medical_report_file ?? "",
          payment_status: (r.payment_status as SickPaymentStatus) ?? "unpaid",
          paid_amount: r.paid_amount == null ? "" : Number(r.paid_amount),
          payment_method: r.payment_method ?? "",
          payment_date: r.payment_date ?? "",
          proof_type: r.proof_type ?? "",
          proof_file: r.proof_file ?? "",
          notes: r.notes ?? "",
        })),
      );
    }
    const s = saved.data.summary;
    if (s) {
      setHasSick(!!s.has_sick_leave);
      setEndedDuringLeave(!!s.ended_during_sick_leave);
      setWageChanged(!!s.wage_changed);
      setWageBasis(s.wage_basis ?? "last_actual_wage");
      setNotes(s.notes ?? "");
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

  const analysis = useMemo(
    () =>
      analyzeSickLeave({
        rows: hasSick ? rows : [],
        dailyWage,
        currency,
        policy: policyQuery.data,
        serviceStart: span.start,
        serviceEnd: span.end,
        endedDuringLeave,
        wageChanged,
        wageBasis,
      }),
    [
      rows,
      hasSick,
      dailyWage,
      currency,
      policyQuery.data,
      span.start,
      span.end,
      endedDuringLeave,
      wageChanged,
      wageBasis,
      recalcKey,
    ],
  );

  const errors = useMemo(
    () =>
      hasSick
        ? validateSickLeave({
            rows,
            analysis,
            serviceStart: span.start,
            serviceEnd: span.end,
            policy: policyQuery.data,
          })
        : [],
    [hasSick, rows, analysis, span.start, span.end, policyQuery.data],
  );
  const valid = errors.length === 0;

  const setRow = (i: number, patch: Partial<SickLeaveRow>) =>
    setRows((list) =>
      list.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        if (("start_date" in patch || "end_date" in patch) && next.start_date && next.end_date) {
          next.days = inclusiveDays(next.start_date, next.end_date);
        }
        return next;
      }),
    );

  const uploadFile = async (file: File, onDone: (path: string) => void) => {
    try {
      setUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("انتهت الجلسة، يرجى إعادة الدخول");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${caseId}/sick-${Date.now()}.${ext}`;
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
      await supabase.from("case_sick_leaves").delete().eq("case_id", caseId);

      if (hasSick && rows.length) {
        const { error } = await supabase.from("case_sick_leaves").insert(
          rows.map((r, i) => {
            const res = analysis.leaves.find((l) => l.index === i);
            return {
              case_id: caseId,
              contract_id: r.contract_id || null,
              start_date: r.start_date || null,
              end_date: r.end_date || null,
              total_days: Number(r.days) || 0,
              leave_kind: r.leave_kind,
              illness_reason: r.illness_reason || null,
              medical_provider: r.medical_provider || null,
              medical_report_number: r.medical_report_number || null,
              has_medical_report: r.has_medical_report,
              medical_report_type: r.medical_report_type || null,
              medical_report_file: r.medical_report_file || null,
              daily_wage: analysis.dailyWage,
              compensation_rate: res?.avgRate ?? 0,
              compensation_amount: res?.due ?? 0,
              payment_status: r.payment_status,
              paid_amount: r.payment_status === "unpaid" ? 0 : Number(r.paid_amount) || 0,
              remaining_amount: res?.remaining ?? 0,
              payment_method: r.payment_method || null,
              payment_date: r.payment_date || null,
              proof_type: r.proof_type || null,
              proof_file: r.proof_file || null,
              currency,
              stages: (res?.stages ?? []) as any,
              notes: r.notes || null,
              sort_order: i,
            };
          }),
        );
        if (error) throw error;
      }

      const { error: sumErr } = await supabase.from("case_sick_leave_summary").upsert(
        {
          case_id: caseId,
          has_sick_leave: !!hasSick,
          ended_during_sick_leave: endedDuringLeave,
          wage_changed: wageChanged,
          wage_basis: wageBasis,
          leaves_count: hasSick ? rows.length : 0,
          total_days: analysis.effectiveDays,
          total_due: analysis.totalDue,
          total_paid: analysis.totalPaid,
          excluded_amount: analysis.excludedAmount,
          remaining_amount: analysis.remainingAmount,
          daily_wage: analysis.dailyWage,
          currency,
          analysis: analysis as any,
          notes: notes || null,
        },
        { onConflict: "case_id" },
      );
      if (sumErr) throw sumErr;

      await draft.saveNowWith({
        sick_leave: { has_sick_leave: !!hasSick, analysis, currency },
      });
    },
    onSuccess: () => void saved.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات الإجازة المرضية"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (hasSick === null) {
      toast.error("يرجى الإجابة على السؤال أولاً");
      return;
    }
    if (hasSick && !valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ بيانات الإجازة المرضية وإعادة احتساب المطالبة");
    if (thenNext) navigate({ to: "/sa/maternity" });
  };

  const loading = draft.loading || saved.isLoading || contracts.isLoading;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <HeartPulse className="h-3.5 w-3.5" /> الخطوة 8 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">الإجازة المرضية</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُقسّم الإجازة إلى مراحل بنسب أجر محمّلة من محرك القوانين، ويُستبعد ما ثبت صرفه من
            المطالبة النهائية.
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
              <h2 className="mb-3 font-bold">هل حصل العامل على إجازة مرضية أثناء العلاقة العمالية؟</h2>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={hasSick === true ? "default" : "outline"}
                  onClick={() => {
                    setHasSick(true);
                    if (!rows.length) setRows([emptySickLeave()]);
                  }}
                >
                  نعم
                </Button>
                <Button
                  variant={hasSick === false ? "default" : "outline"}
                  onClick={() => setHasSick(false)}
                >
                  لا
                </Button>
              </div>
              {hasSick === false && (
                <p className="mt-3 text-sm text-muted-foreground">
                  لن يتم احتساب أي مستحقات إجازة مرضية، ويمكنك الانتقال إلى الخطوة التالية.
                </p>
              )}
            </Card>

            {hasSick && (
              <>
                <Card className="p-6">
                  <h2 className="mb-3 font-bold">السياسة القانونية المحمّلة</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-muted-foreground">
                        <tr className="border-b">
                          <th className="p-2 text-start">المرحلة</th>
                          <th className="p-2 text-start">الأيام</th>
                          <th className="p-2 text-start">نسبة الأجر</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.policy.tiers.map((t, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-2">{i + 1}</td>
                            <td className="p-2">
                              {t.from} – {t.to}
                            </td>
                            <td className="p-2">{Math.round(t.rate * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    الحد الأقصى السنوي: {analysis.policy.annual_max_days} يوم — إعادة احتساب السنة
                    المرضية: {analysis.policy.year_reset} — التقرير الطبي:{" "}
                    {analysis.policy.requires_medical_report ? "مطلوب" : "غير مطلوب"} — الأجر اليومي
                    المعتمد: {money(analysis.dailyWage, currency)}
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="mb-4 font-bold">الحالات الخاصة</h2>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <Label className="text-sm">انتهت الخدمة أثناء الإجازة المرضية</Label>
                      <Switch checked={endedDuringLeave} onCheckedChange={setEndedDuringLeave} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <Label className="text-sm">تغيّر الأجر أثناء فترة المرض</Label>
                      <Switch checked={wageChanged} onCheckedChange={setWageChanged} />
                    </div>
                    <div>
                      <Label className="mb-1 block text-sm">الأجر المعتمد في الحساب</Label>
                      <Select value={wageBasis} onValueChange={setWageBasis}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SICK_WAGE_BASES.map((w) => (
                            <SelectItem key={w.value} value={w.value}>
                              {w.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(span.start || span.end) && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      مدة الخدمة المستمدة من العقود: {span.start ?? "—"} إلى {span.end ?? "—"}
                    </p>
                  )}
                </Card>

                <div className="space-y-4">
                  {rows.map((r, i) => {
                    const res = analysis.leaves.find((l) => l.index === i);
                    return (
                      <Card key={r.id ?? i} className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="font-bold">الإجازة المرضية {i + 1}</h3>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRows((list) => list.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <Label className="mb-1 block text-sm">تاريخ البداية</Label>
                            <Input
                              type="date"
                              value={r.start_date}
                              onChange={(e) => setRow(i, { start_date: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">تاريخ النهاية</Label>
                            <Input
                              type="date"
                              value={r.end_date}
                              onChange={(e) => setRow(i, { end_date: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">عدد الأيام</Label>
                            <Input
                              type="number"
                              min={0}
                              value={r.days}
                              onChange={(e) =>
                                setRow(i, {
                                  days: e.target.value === "" ? "" : Number(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">نوع الإجازة</Label>
                            <Select
                              value={r.leave_kind}
                              onValueChange={(v) => setRow(i, { leave_kind: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SICK_LEAVE_KINDS.map((k) => (
                                  <SelectItem key={k.value} value={k.value}>
                                    {k.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">سبب المرض (اختياري)</Label>
                            <Input
                              value={r.illness_reason}
                              onChange={(e) => setRow(i, { illness_reason: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">العقد المرتبط (اختياري)</Label>
                            <Select
                              value={r.contract_id || "none"}
                              onValueChange={(v) =>
                                setRow(i, { contract_id: v === "none" ? "" : v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">غير محدد</SelectItem>
                                {(contracts.data ?? []).map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.contract_number} — {c.start_date}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">الجهة الطبية المصدرة</Label>
                            <Input
                              value={r.medical_provider}
                              onChange={(e) => setRow(i, { medical_provider: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-sm">رقم التقرير الطبي (اختياري)</Label>
                            <Input
                              value={r.medical_report_number}
                              onChange={(e) => setRow(i, { medical_report_number: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* التقرير الطبي */}
                        <div className="mt-5 rounded-lg border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <Label className="text-sm font-semibold">هل يوجد تقرير طبي؟</Label>
                            <Switch
                              checked={r.has_medical_report}
                              onCheckedChange={(v) => setRow(i, { has_medical_report: v })}
                            />
                          </div>
                          {r.has_medical_report ? (
                            <div className="mt-3 grid gap-4 md:grid-cols-2">
                              <div>
                                <Label className="mb-1 block text-sm">نوع المستند</Label>
                                <Select
                                  value={r.medical_report_type || MEDICAL_REPORT_TYPES[0]}
                                  onValueChange={(v) => setRow(i, { medical_report_type: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MEDICAL_REPORT_TYPES.map((t) => (
                                      <SelectItem key={t} value={t}>
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="mb-1 block text-sm">ملف التقرير الطبي</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="file"
                                    accept="image/*,.pdf"
                                    disabled={uploading}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f)
                                        void uploadFile(f, (p) =>
                                          setRow(i, { medical_report_file: p }),
                                        );
                                    }}
                                  />
                                  {r.medical_report_file && (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => void openFile(r.medical_report_file)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => void openFile(r.medical_report_file, true)}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Alert variant="destructive" className="mt-3">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                لا يوجد تقرير طبي مؤيد للإجازة المرضية، وقد يؤثر ذلك على قبول
                                المطالبة وفق النظام المعمول به.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>

                        {/* الصرف */}
                        <div className="mt-5 rounded-lg border p-4">
                          <Label className="mb-2 block text-sm font-semibold">
                            هل تم صرف الأجر أثناء الإجازة المرضية؟
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {SICK_PAYMENT_STATUSES.map((s) => (
                              <Button
                                key={s.value}
                                size="sm"
                                variant={r.payment_status === s.value ? "default" : "outline"}
                                onClick={() => setRow(i, { payment_status: s.value })}
                              >
                                {s.label}
                              </Button>
                            ))}
                          </div>

                          {r.payment_status !== "unpaid" && (
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div>
                                <Label className="mb-1 block text-sm">قيمة المبلغ المصروف</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={r.paid_amount}
                                  onChange={(e) =>
                                    setRow(i, {
                                      paid_amount:
                                        e.target.value === "" ? "" : Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-sm">تاريخ الصرف</Label>
                                <Input
                                  type="date"
                                  value={r.payment_date}
                                  onChange={(e) => setRow(i, { payment_date: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-sm">طريقة السداد</Label>
                                <Select
                                  value={r.payment_method || undefined}
                                  onValueChange={(v) => setRow(i, { payment_method: v, proof_type: v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختر طريقة السداد" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SICK_PAYMENT_METHODS.map((m) => (
                                      <SelectItem key={m} value={m}>
                                        {m}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="mb-1 block text-sm">إثبات السداد</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="file"
                                    accept="image/*,.pdf"
                                    disabled={uploading}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) void uploadFile(f, (p) => setRow(i, { proof_file: p }));
                                    }}
                                  />
                                  {r.proof_file && (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => void openFile(r.proof_file)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => void openFile(r.proof_file, true)}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {r.payment_status !== "unpaid" && !r.proof_file && (
                            <Alert variant="destructive" className="mt-3">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                تم إدخال وجود صرف دون إثبات، وقد يكون محل نظر أمام الجهة القضائية،
                                ولا يتم استبعاد المبلغ تلقائياً.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>

                        <div className="mt-4">
                          <Label className="mb-1 block text-sm">ملاحظات</Label>
                          <Textarea
                            rows={2}
                            value={r.notes}
                            onChange={(e) => setRow(i, { notes: e.target.value })}
                          />
                        </div>

                        {res && (
                          <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            <div className="rounded-lg bg-muted/50 p-3 text-sm">
                              <div className="text-muted-foreground">الأيام المحتسبة</div>
                              <div className="font-bold">{res.effectiveDays}</div>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3 text-sm">
                              <div className="text-muted-foreground">المستحق</div>
                              <div className="font-bold">{money(res.due, currency)}</div>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3 text-sm">
                              <div className="text-muted-foreground">المستبعد بإثبات</div>
                              <div className="font-bold">{money(res.excluded, currency)}</div>
                            </div>
                            <div className="rounded-lg bg-primary-soft p-3 text-sm">
                              <div className="text-muted-foreground">المتبقي</div>
                              <div className="font-bold text-primary">
                                {money(res.remaining, currency)}
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => setRows((list) => [...list, emptySickLeave()])}
                    >
                      <Plus className="h-4 w-4" /> إضافة إجازة مرضية
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setRecalcKey((k) => k + 1);
                        toast.success("تم إعادة الحساب");
                      }}
                    >
                      <RefreshCw className="h-4 w-4" /> إعادة الحساب
                    </Button>
                  </div>
                </div>

                {/* جدول الملخص */}
                <Card className="p-6">
                  <h2 className="mb-3 font-bold">ملخص الإجازات المرضية</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-muted-foreground">
                        <tr className="border-b">
                          <th className="p-2 text-start">البداية</th>
                          <th className="p-2 text-start">النهاية</th>
                          <th className="p-2 text-start">الأيام</th>
                          <th className="p-2 text-start">نسبة الأجر</th>
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
                            <td className="p-2">{l.effectiveDays}</td>
                            <td className="p-2">{Math.round(l.avgRate * 100)}%</td>
                            <td className="p-2">{money(l.due, currency)}</td>
                            <td className="p-2">{money(l.paid, currency)}</td>
                            <td className="p-2 font-semibold">{money(l.remaining, currency)}</td>
                            <td className="p-2">
                              <Badge variant={l.proven ? "secondary" : "outline"}>
                                {l.status === "unpaid"
                                  ? "لم يُصرف"
                                  : l.proven
                                    ? "مصروف بإثبات"
                                    : "مصروف بدون إثبات"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        {!analysis.leaves.length && (
                          <tr>
                            <td colSpan={8} className="p-3 text-center text-muted-foreground">
                              لا توجد بيانات
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-muted/50 p-3 text-sm">
                      <div className="text-muted-foreground">إجمالي الأيام</div>
                      <div className="font-bold">{analysis.effectiveDays}</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-sm">
                      <div className="text-muted-foreground">إجمالي المستحق</div>
                      <div className="font-bold">{money(analysis.totalDue, currency)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-sm">
                      <div className="text-muted-foreground">المبالغ المستبعدة</div>
                      <div className="font-bold">{money(analysis.excludedAmount, currency)}</div>
                    </div>
                    <div className="rounded-lg bg-primary-soft p-3 text-sm">
                      <div className="text-muted-foreground">المتبقي المستحق</div>
                      <div className="font-bold text-primary">
                        {money(analysis.remainingAmount, currency)}
                      </div>
                    </div>
                  </div>

                  {!!analysis.stageTotals.length && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground">
                          <tr className="border-b">
                            <th className="p-2 text-start">المرحلة</th>
                            <th className="p-2 text-start">الأيام</th>
                            <th className="p-2 text-start">نسبة الأجر</th>
                            <th className="p-2 text-start">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.stageTotals.map((s) => (
                            <tr key={s.stage} className="border-b last:border-0">
                              <td className="p-2">{s.stage}</td>
                              <td className="p-2">{s.days}</td>
                              <td className="p-2">{Math.round(s.rate * 100)}%</td>
                              <td className="p-2">{money(s.amount, currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

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
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button asChild variant="ghost" className="gap-2">
                <Link to="/sa/annual-leave">
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
