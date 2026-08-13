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
  CalendarDays,
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
  LEAVE_PAYMENT_METHODS,
  LEAVE_PAYMENT_STATUSES,
  LEAVE_PROOF_TYPES,
  LEAVE_TYPES,
  WAGE_BASES,
  analyzeAnnualLeave,
  emptyCarryover,
  emptyLeaveTaken,
  emptySettlement,
  inclusiveDays,
  serviceSpan,
  toLeavePolicy,
  validateLeave,
  type CarryoverRow,
  type LeavePaymentStatus,
  type LeaveTakenRow,
  type LeaveType,
} from "@/lib/saudi/annualLeave";

export const Route = createFileRoute("/_authenticated/sa/annual-leave")({
  head: () => ({
    meta: [
      { title: "الإجازة السنوية وتعويض رصيد الإجازات — الخطوة 7 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة السابعة: احتساب الاستحقاق السنوي للإجازات، والإجازات المستخدمة والمرحّلة، ورصيد الإجازات النهائي وتعويضه النقدي.",
      },
      { property: "og:title", content: "الإجازة السنوية وتعويض رصيد الإجازات — الخطوة 7" },
      {
        property: "og:description",
        content:
          "تحليل استحقاق الإجازة السنوية لكل سنة خدمة واحتساب بدل رصيد الإجازات مع استبعاد المبالغ المصروفة بإثبات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnnualLeaveStep,
});

function AnnualLeaveStep() {
  const draft = useCaseDraft("SA", 7);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [hasClaim, setHasClaim] = useState<boolean | null>(null);
  const [hasCarryover, setHasCarryover] = useState<boolean | null>(null);
  const [taken, setTaken] = useState<LeaveTakenRow[]>([]);
  const [carryover, setCarryover] = useState<CarryoverRow[]>([]);
  const [settlement, setSettlement] = useState(emptySettlement());
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recalcKey, setRecalcKey] = useState(0);

  const policyQuery = useQuery({
    queryKey: ["sa-leave-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sa_regulatory_settings")
        .select("value")
        .eq("key", "annual_leave")
        .maybeSingle();
      if (error) throw error;
      return toLeavePolicy(data?.value);
    },
  });

  const salary = useQuery({
    queryKey: ["case-salary-leave", caseId],
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
    queryKey: ["case-contracts-leave", caseId],
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
    queryKey: ["case-leave", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const [t, c, s] = await Promise.all([
        supabase.from("case_leave_taken").select("*").eq("case_id", caseId!).order("sort_order"),
        supabase.from("case_leave_carryover").select("*").eq("case_id", caseId!).order("sort_order"),
        supabase.from("case_leave_settlement").select("*").eq("case_id", caseId!).maybeSingle(),
      ]);
      if (t.error) throw t.error;
      if (c.error) throw c.error;
      if (s.error) throw s.error;
      return { taken: t.data ?? [], carryover: c.data ?? [], settlement: s.data };
    },
  });

  useEffect(() => {
    if (!saved.data) return;
    if (saved.data.taken.length) {
      setTaken(
        saved.data.taken.map((r) => ({
          id: r.id,
          start_date: r.start_date ?? "",
          end_date: r.end_date ?? "",
          days: r.days == null ? "" : Number(r.days),
          leave_type: (r.leave_type as LeaveType) ?? "annual",
          notes: r.notes ?? "",
        })),
      );
    }
    if (saved.data.carryover.length) {
      setHasCarryover(true);
      setCarryover(
        saved.data.carryover.map((r) => ({
          id: r.id,
          from_year: r.from_year ?? "",
          days: r.days == null ? "" : Number(r.days),
          reason: r.reason ?? "",
          is_legal: !!r.is_legal,
          proof_file: r.proof_file ?? "",
          notes: r.notes ?? "",
        })),
      );
    }
    const s = saved.data.settlement;
    if (s) {
      setHasClaim(!!s.has_leave_claim);
      if (!s.has_carryover) setHasCarryover((v) => v ?? false);
      setSettlement({
        still_employed: !!s.still_employed,
        wage_changed: !!s.wage_changed,
        wage_basis: s.wage_basis ?? "last_actual_wage",
        payment_status: (s.payment_status as LeavePaymentStatus) ?? "unpaid",
        paid_amount: s.paid_amount == null ? "" : Number(s.paid_amount),
        payment_date: s.payment_date ?? "",
        payment_method: s.payment_method ?? "",
        proof_type: s.proof_type ?? "",
        proof_file: s.proof_file ?? "",
        notes: s.notes ?? "",
      });
    }
  }, [saved.data]);

  const currency = salary.data?.currency || "SAR";
  const dailyWage = Number(salary.data?.daily_salary ?? 0) ||
    Number(salary.data?.actual_salary ?? 0) / 30;

  // مدة الخدمة تُستمد من العقود ولا يمكن تعديلها يدوياً
  const span = useMemo(() => {
    const list = contracts.data ?? [];
    if (!list.length) return serviceSpan(null, null, 0);
    const starts = list.map((c) => c.start_date).filter(Boolean) as string[];
    const ends = list
      .map((c) => effectiveEnd(c as any))
      .filter(Boolean) as string[];
    const start = starts.length ? starts.slice().sort()[0] : null;
    const today = new Date().toISOString().slice(0, 10);
    const end = settlement.still_employed
      ? today
      : ends.length
        ? ends.slice().sort().reverse()[0]
        : today;
    // الانقطاعات غير المحتسبة بين العقود
    const ordered = list
      .slice()
      .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
    let gapDays = 0;
    for (let i = 1; i < ordered.length; i += 1) {
      const prevEnd = effectiveEnd(ordered[i - 1] as any);
      const curStart = ordered[i].start_date;
      if (!prevEnd || !curStart) continue;
      const d = inclusiveDays(prevEnd, curStart) - 2;
      if (d > 0) gapDays += d;
    }
    return serviceSpan(start, end, gapDays);
  }, [contracts.data, settlement.still_employed]);

  const analysis = useMemo(
    () =>
      analyzeAnnualLeave({
        span,
        taken,
        carryover: hasCarryover ? carryover : [],
        settlement,
        dailyWage,
        currency,
        policy: policyQuery.data,
      }),
    [span, taken, carryover, hasCarryover, settlement, dailyWage, currency, policyQuery.data, recalcKey],
  );

  const errors = useMemo(
    () =>
      hasClaim
        ? validateLeave({ taken, carryover: hasCarryover ? carryover : [], settlement, span, analysis })
        : [],
    [hasClaim, taken, carryover, hasCarryover, settlement, span, analysis],
  );
  const valid = errors.length === 0;

  const setTakenRow = (i: number, patch: Partial<LeaveTakenRow>) =>
    setTaken((list) =>
      list.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        if (("start_date" in patch || "end_date" in patch) && next.start_date && next.end_date) {
          next.days = inclusiveDays(next.start_date, next.end_date);
        }
        return next;
      }),
    );

  const setCarryRow = (i: number, patch: Partial<CarryoverRow>) =>
    setCarryover((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const uploadProof = async (file: File, onDone: (path: string) => void) => {
    try {
      setUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("انتهت الجلسة، يرجى إعادة الدخول");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${caseId}/leave-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("case-proofs").upload(path, file, { upsert: true });
      if (error) throw error;
      onDone(path);
      toast.success("تم رفع المستند");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر رفع المستند");
    } finally {
      setUploading(false);
    }
  };

  const openProof = async (path: string, download = false) => {
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
      await Promise.all([
        supabase.from("case_leave_taken").delete().eq("case_id", caseId),
        supabase.from("case_leave_carryover").delete().eq("case_id", caseId),
        supabase.from("case_annual_leave").delete().eq("case_id", caseId),
      ]);

      if (hasClaim && taken.length) {
        const { error } = await supabase.from("case_leave_taken").insert(
          taken.map((r, i) => ({
            case_id: caseId,
            start_date: r.start_date || null,
            end_date: r.end_date || null,
            days: Number(r.days) || 0,
            leave_type: r.leave_type,
            notes: r.notes || null,
            sort_order: i,
          })),
        );
        if (error) throw error;
      }

      if (hasClaim && hasCarryover && carryover.length) {
        const { error } = await supabase.from("case_leave_carryover").insert(
          carryover.map((r, i) => ({
            case_id: caseId,
            from_year: r.from_year === "" ? null : Number(r.from_year),
            days: Number(r.days) || 0,
            reason: r.reason || null,
            is_legal: r.is_legal,
            proof_file: r.proof_file || null,
            notes: r.notes || null,
            sort_order: i,
          })),
        );
        if (error) throw error;
      }

      if (hasClaim && analysis.years.length) {
        const { error } = await supabase.from("case_annual_leave").insert(
          analysis.years.map((y, i) => ({
            case_id: caseId,
            service_year: y.serviceYear,
            period_start: y.periodStart,
            period_end: y.periodEnd,
            period_days: y.periodDays,
            entitlement_days: y.entitlementDays,
            used_days: y.usedDays,
            carried_forward_days: i === 0 ? analysis.carriedLegal : 0,
            remaining_days: Math.max(0, y.entitlementDays - y.usedDays),
            daily_wage: analysis.dailyWage,
            compensation_amount: i === analysis.years.length - 1 ? analysis.finalDue : 0,
            currency,
            legal_basis: y.legalBasis,
            sort_order: i,
          })),
        );
        if (error) throw error;
      }

      const { error: setErr } = await supabase.from("case_leave_settlement").upsert(
        {
          case_id: caseId,
          has_leave_claim: !!hasClaim,
          has_carryover: !!hasCarryover,
          still_employed: settlement.still_employed,
          wage_changed: settlement.wage_changed,
          wage_basis: settlement.wage_basis,
          payment_status: settlement.payment_status,
          paid_amount: analysis.paidAmount,
          remaining_amount: analysis.finalDue,
          compensation_amount: analysis.compensation,
          daily_wage: analysis.dailyWage,
          currency,
          payment_date: settlement.payment_date || null,
          payment_method: settlement.payment_method || null,
          proof_type: settlement.proof_type || null,
          proof_file: settlement.proof_file || null,
          analysis: analysis as any,
          notes: settlement.notes || null,
        },
        { onConflict: "case_id" },
      );
      if (setErr) throw setErr;

      await draft.saveNowWith({
        annual_leave: {
          has_claim: !!hasClaim,
          analysis,
          currency,
        },
      });
    },
    onSuccess: () => void saved.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات الإجازات"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (hasClaim === null) {
      toast.error("يرجى الإجابة على السؤال أولاً");
      return;
    }
    if (hasClaim && !valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ بيانات الإجازات وإعادة احتساب المطالبة");
    if (thenNext) navigate({ to: "/sa/sick-leave" });
  };

  const loading = draft.loading || saved.isLoading || contracts.isLoading;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <CalendarDays className="h-3.5 w-3.5" /> الخطوة 7 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
            الإجازة السنوية وتعويض رصيد الإجازات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            يُحتسب الاستحقاق لكل سنة خدمة وفق سياسة الإجازات المعتمدة في محرك القوانين، ويُستبعد ما ثبت
            صرفه من المطالبة النهائية.
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
              <h2 className="mb-3 font-bold">هل يوجد رصيد إجازات سنوية أو بدل إجازة غير مصروف؟</h2>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={hasClaim === true ? "default" : "outline"}
                  onClick={() => {
                    setHasClaim(true);
                    if (!taken.length) setTaken([emptyLeaveTaken()]);
                  }}
                >
                  نعم
                </Button>
                <Button
                  variant={hasClaim === false ? "default" : "outline"}
                  onClick={() => {
                    setHasClaim(false);
                    setTaken([]);
                    setCarryover([]);
                    setHasCarryover(false);
                  }}
                >
                  لا
                </Button>
              </div>
              {hasClaim === false && (
                <p className="mt-3 text-sm text-muted-foreground">
                  لا توجد مطالبة برصيد إجازات — يمكنك الحفظ والانتقال إلى الخطوة التالية.
                </p>
              )}
            </Card>

            {hasClaim && (
              <>
                {/* سياسة الإجازات ومدة الخدمة */}
                <Card className="grid gap-4 p-6 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <h3 className="font-bold">سياسة الإجازات المعتمدة (من محرك القوانين)</h3>
                  </div>
                  <Info label="الاستحقاق الأساسي" value={`${analysis.policy.base_days} يوم/سنة`} />
                  <Info
                    label={`بعد ${analysis.policy.long_service_years} سنوات`}
                    value={`${analysis.policy.long_service_days} يوم/سنة`}
                  />
                  <Info label="الحد الأقصى للترحيل" value={`${analysis.policy.max_carryover_days} يوم`} />
                  <Info
                    label="صلاحية الرصيد"
                    value={`${analysis.policy.carryover_validity_months} شهر`}
                  />
                  <Info
                    label="التعويض النقدي"
                    value={analysis.policy.cash_compensation_allowed ? "مسموح" : "غير مسموح"}
                  />
                  <Info
                    label="احتساب السنة غير المكتملة"
                    value={analysis.policy.prorate_partial_year ? "بالنسبة والتناسب" : "لا يُحتسب"}
                  />
                </Card>

                <Card className="grid gap-4 p-6 sm:grid-cols-4">
                  <div className="sm:col-span-4">
                    <h3 className="font-bold">مدة الخدمة (تُستمد من العقود — غير قابلة للتعديل)</h3>
                  </div>
                  <Info label="بداية الخدمة" value={span.start ?? "—"} />
                  <Info label="نهاية الخدمة" value={span.end ?? "—"} />
                  <Info
                    label="مدة الخدمة"
                    value={`${span.years} سنة، ${span.months} شهر، ${span.days} يوم`}
                  />
                  <Info label="الانقطاعات غير المحتسبة" value={`${span.gapDays} يوم`} />
                </Card>

                {/* الاستحقاق السنوي */}
                <Card className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-right">
                      <tr>
                        <th className="p-3">سنة الخدمة</th>
                        <th className="p-3">الفترة</th>
                        <th className="p-3">مدة الخدمة</th>
                        <th className="p-3">نسبة الاستحقاق</th>
                        <th className="p-3">الاستحقاق</th>
                        <th className="p-3">المستخدم</th>
                        <th className="p-3">الأساس النظامي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.years.map((y) => (
                        <tr key={y.serviceYear} className="border-t">
                          <td className="p-3">{y.serviceYear}</td>
                          <td className="p-3 whitespace-nowrap">{y.periodStart} — {y.periodEnd}</td>
                          <td className="p-3">{y.fullYear ? "سنة كاملة" : `${y.periodDays} يوم`}</td>
                          <td className="p-3">{Math.round(y.ratio * 100)}%</td>
                          <td className="p-3 font-semibold">{y.entitlementDays} يوم</td>
                          <td className="p-3">{y.usedDays} يوم</td>
                          <td className="p-3 text-xs text-muted-foreground">{y.legalBasis}</td>
                        </tr>
                      ))}
                      {!analysis.years.length && (
                        <tr>
                          <td className="p-4 text-muted-foreground" colSpan={7}>
                            لا توجد سنوات خدمة محتسبة — تأكد من إدخال العقود في الخطوة 2.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>

                {/* الإجازات المستخدمة */}
                <Card className="space-y-4 p-6">
                  <h3 className="font-bold">الإجازات المستخدمة</h3>
                  {taken.map((row, i) => (
                    <div key={i} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">سجل {i + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-destructive"
                          onClick={() => setTaken((l) => l.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4" /> حذف
                        </Button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-4">
                        <div>
                          <Label>تاريخ البداية</Label>
                          <Input
                            type="date"
                            value={row.start_date}
                            onChange={(e) => setTakenRow(i, { start_date: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>تاريخ النهاية</Label>
                          <Input
                            type="date"
                            value={row.end_date}
                            onChange={(e) => setTakenRow(i, { end_date: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>عدد الأيام</Label>
                          <Input
                            type="number"
                            step="0.5"
                            value={row.days}
                            onChange={(e) =>
                              setTakenRow(i, { days: e.target.value === "" ? "" : Number(e.target.value) })
                            }
                          />
                        </div>
                        <div>
                          <Label>نوع الإجازة</Label>
                          <Select
                            value={row.leave_type}
                            onValueChange={(v) => setTakenRow(i, { leave_type: v as LeaveType })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LEAVE_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={row.notes}
                          onChange={(e) => setTakenRow(i, { notes: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="gap-2" onClick={() => setTaken((l) => [...l, emptyLeaveTaken()])}>
                    <Plus className="h-4 w-4" /> إضافة إجازة
                  </Button>
                </Card>

                {/* الإجازات المرحّلة */}
                <Card className="space-y-4 p-6">
                  <h3 className="font-bold">هل يوجد رصيد مرحّل من سنوات سابقة؟</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant={hasCarryover === true ? "default" : "outline"}
                      onClick={() => {
                        setHasCarryover(true);
                        if (!carryover.length) setCarryover([emptyCarryover()]);
                      }}
                    >
                      نعم
                    </Button>
                    <Button
                      variant={hasCarryover === false ? "default" : "outline"}
                      onClick={() => {
                        setHasCarryover(false);
                        setCarryover([]);
                      }}
                    >
                      لا
                    </Button>
                  </div>

                  {hasCarryover &&
                    carryover.map((row, i) => (
                      <div key={i} className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">رصيد مرحّل {i + 1}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive"
                            onClick={() => setCarryover((l) => l.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-4 w-4" /> حذف
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <Label>السنة</Label>
                            <Input
                              type="number"
                              value={row.from_year}
                              onChange={(e) =>
                                setCarryRow(i, {
                                  from_year: e.target.value === "" ? "" : Number(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>عدد الأيام</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={row.days}
                              onChange={(e) =>
                                setCarryRow(i, { days: e.target.value === "" ? "" : Number(e.target.value) })
                              }
                            />
                          </div>
                          <div>
                            <Label>سبب الترحيل</Label>
                            <Input
                              value={row.reason}
                              onChange={(e) => setCarryRow(i, { reason: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-6">
                          <label className="flex items-center gap-2 text-sm">
                            <Switch
                              checked={row.is_legal}
                              onCheckedChange={(v) => setCarryRow(i, { is_legal: v })}
                            />
                            هل الترحيل نظامي؟
                          </label>
                          <div>
                            <Label className="text-xs">المستند المؤيد</Label>
                            <Input
                              type="file"
                              disabled={uploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void uploadProof(f, (path) => setCarryRow(i, { proof_file: path }));
                              }}
                            />
                          </div>
                          {row.proof_file && (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => void openProof(row.proof_file)}>
                                <Eye className="h-3.5 w-3.5" /> عرض
                              </Button>
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => void openProof(row.proof_file, true)}>
                                <Download className="h-3.5 w-3.5" /> تنزيل
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                  {hasCarryover && (
                    <Button variant="outline" className="gap-2" onClick={() => setCarryover((l) => [...l, emptyCarryover()])}>
                      <Plus className="h-4 w-4" /> إضافة رصيد مرحّل
                    </Button>
                  )}
                </Card>

                {/* الحالات الخاصة */}
                <Card className="space-y-4 p-6">
                  <h3 className="font-bold">حالات خاصة</h3>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={settlement.still_employed}
                      onCheckedChange={(v) => setSettlement((s) => ({ ...s, still_employed: v }))}
                    />
                    العامل ما زال على رأس العمل
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={settlement.wage_changed}
                      onCheckedChange={(v) => setSettlement((s) => ({ ...s, wage_changed: v }))}
                    />
                    هل تغيّر الأجر الأساسي أو الفعلي خلال مدة الخدمة؟
                  </label>
                  {settlement.wage_changed && (
                    <div className="sm:max-w-sm">
                      <Label>أساس احتساب الأجر</Label>
                      <Select
                        value={settlement.wage_basis}
                        onValueChange={(v) => setSettlement((s) => ({ ...s, wage_basis: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {WAGE_BASES.map((w) => (
                            <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </Card>

                {/* الصرف السابق */}
                <Card className="space-y-4 p-6">
                  <h3 className="font-bold">هل سبق صرف بدل الإجازة؟</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label>حالة الصرف</Label>
                      <Select
                        value={settlement.payment_status}
                        onValueChange={(v) =>
                          setSettlement((s) => ({ ...s, payment_status: v as LeavePaymentStatus }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEAVE_PAYMENT_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {settlement.payment_status === "partial" && (
                      <div>
                        <Label>المبلغ المصروف</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={settlement.paid_amount}
                          onChange={(e) =>
                            setSettlement((s) => ({
                              ...s,
                              paid_amount: e.target.value === "" ? "" : Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                    )}
                    {settlement.payment_status !== "unpaid" && (
                      <>
                        <div>
                          <Label>تاريخ الصرف</Label>
                          <Input
                            type="date"
                            value={settlement.payment_date}
                            onChange={(e) =>
                              setSettlement((s) => ({ ...s, payment_date: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label>طريقة السداد</Label>
                          <Select
                            value={settlement.payment_method}
                            onValueChange={(v) => setSettlement((s) => ({ ...s, payment_method: v }))}
                          >
                            <SelectTrigger><SelectValue placeholder="اختر الطريقة" /></SelectTrigger>
                            <SelectContent>
                              {LEAVE_PAYMENT_METHODS.map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>نوع إثبات السداد</Label>
                          <Select
                            value={settlement.proof_type}
                            onValueChange={(v) => setSettlement((s) => ({ ...s, proof_type: v }))}
                          >
                            <SelectTrigger><SelectValue placeholder="اختر الإثبات" /></SelectTrigger>
                            <SelectContent>
                              {LEAVE_PROOF_TYPES.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>ملف الإثبات</Label>
                          <Input
                            type="file"
                            disabled={uploading}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void uploadProof(f, (path) => setSettlement((s) => ({ ...s, proof_file: path })));
                            }}
                          />
                          {settlement.proof_file && (
                            <div className="mt-2 flex gap-2">
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => void openProof(settlement.proof_file)}>
                                <Eye className="h-3.5 w-3.5" /> عرض
                              </Button>
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => void openProof(settlement.proof_file, true)}>
                                <Download className="h-3.5 w-3.5" /> تنزيل
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={settlement.notes}
                      onChange={(e) => setSettlement((s) => ({ ...s, notes: e.target.value }))}
                    />
                  </div>
                </Card>

                {/* ملخص الرصيد والتعويض */}
                <Card className="grid gap-4 p-6 sm:grid-cols-4">
                  <Info label="إجمالي الأيام المستحقة" value={`${analysis.totalEntitlement} يوم`} />
                  <Info label="الإجازات المستخدمة" value={`${analysis.totalUsed} يوم`} />
                  <Info label="الرصيد المرحّل النظامي" value={`${analysis.carriedLegal} يوم`} />
                  <Info label="الرصيد النهائي" value={`${analysis.balanceDays} يوم`} strong />
                  <Info label="الأجر اليومي" value={`${money(analysis.dailyWage)} ${currency}`} />
                  <Info label="قيمة التعويض" value={`${money(analysis.compensation)} ${currency}`} />
                  <Info label="المبالغ المستبعدة" value={`${money(analysis.excludedAmount)} ${currency}`} />
                  <Info label="المبلغ النهائي المستحق" value={`${money(analysis.finalDue)} ${currency}`} strong />
                  <div className="sm:col-span-4 flex flex-wrap items-center gap-3">
                    <Badge variant={analysis.finalDue > 0 ? "destructive" : "secondary"}>
                      {analysis.status}
                    </Badge>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setRecalcKey((k) => k + 1)}>
                      <RefreshCw className="h-3.5 w-3.5" /> إعادة الحساب
                    </Button>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="mb-2 font-bold">طريقة الحساب خطوة بخطوة</h3>
                  <ol className="list-decimal space-y-1 pe-5 text-sm text-muted-foreground">
                    {analysis.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </Card>

                {analysis.warnings.map((w, i) => (
                  <Alert key={i} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>تنبيه قانوني</AlertTitle>
                    <AlertDescription>{w}</AlertDescription>
                  </Alert>
                ))}

                {touched && errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>يرجى تصحيح الأخطاء</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pe-5">
                        {errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild className="gap-2">
                <Link to="/sa/unpaid-salaries">
                  <ChevronRight className="h-4 w-4" /> الخطوة السابقة
                </Link>
              </Button>
              <Button variant="secondary" className="gap-2" disabled={save.isPending} onClick={() => void submit(false)}>
                <Save className="h-4 w-4" /> حفظ
              </Button>
              <Button className="gap-2" disabled={save.isPending} onClick={() => void submit(true)}>
                حفظ ومتابعة <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
      <ContactBar />
      <FooterAttribution />
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={strong ? "text-lg font-bold" : "font-semibold"}>{value}</p>
    </div>
  );
}
