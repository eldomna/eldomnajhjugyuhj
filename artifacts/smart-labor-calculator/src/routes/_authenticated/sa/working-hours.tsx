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
  Clock,
  Info,
  Lock,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import { money } from "@/lib/saudi/salary";
import {
  OVERTIME_MODES,
  OVERTIME_MULTIPLIER,
  SHIFT_TYPES,
  analyzeWorkingHours,
  defaultSettings,
  emptyHoliday,
  emptyOvertime,
  emptyWeekend,
  validateWorkingHours,
  type HolidayRow,
  type OvertimeMode,
  type OvertimeRow,
  type ShiftType,
  type WeekendRow,
  type WorkingHoursSettings,
} from "@/lib/saudi/workingHours";

export const Route = createFileRoute("/_authenticated/sa/working-hours")({
  head: () => ({
    meta: [
      { title: "ساعات العمل — الخطوة 5 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة الخامسة: ساعات العمل اليومية ونظام الدوام والساعات الإضافية والعمل في أيام الراحة والإجازات الرسمية مع احتساب المستحقات تلقائياً من أجر الساعة.",
      },
      { property: "og:title", content: "ساعات العمل والساعات الإضافية — الخطوة 5" },
      {
        property: "og:description",
        content: "احتساب مستحقات الساعات الإضافية والعمل في أيام الراحة والإجازات الرسمية تلقائياً.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkingHoursStep,
});

function WorkingHoursStep() {
  const draft = useCaseDraft("SA", 5);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [settings, setSettings] = useState<WorkingHoursSettings>(defaultSettings);
  const [overtime, setOvertime] = useState<OvertimeRow[]>([]);
  const [weekend, setWeekend] = useState<WeekendRow[]>([]);
  const [holiday, setHoliday] = useState<HolidayRow[]>([]);
  const [touched, setTouched] = useState(false);

  const salary = useQuery({
    queryKey: ["case-salary-hourly", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_salaries")
        .select("hourly_salary,daily_salary,actual_salary")
        .eq("case_id", caseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saved = useQuery({
    queryKey: ["case-working-hours", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const [wh, ot, wk, hd] = await Promise.all([
        supabase.from("case_working_hours").select("*").eq("case_id", caseId!).maybeSingle(),
        supabase.from("case_overtime").select("*").eq("case_id", caseId!).order("sort_order"),
        supabase.from("case_weekend_work").select("*").eq("case_id", caseId!).order("sort_order"),
        supabase.from("case_holiday_work").select("*").eq("case_id", caseId!).order("sort_order"),
      ]);
      if (wh.error) throw wh.error;
      if (ot.error) throw ot.error;
      if (wk.error) throw wk.error;
      if (hd.error) throw hd.error;
      return { wh: wh.data, ot: ot.data ?? [], wk: wk.data ?? [], hd: hd.data ?? [] };
    },
  });

  useEffect(() => {
    if (!saved.data) return;
    const { wh, ot, wk, hd } = saved.data;
    if (wh) {
      setSettings({
        daily_hours: Number(wh.daily_hours ?? 8),
        weekly_days: Number(wh.weekly_days ?? 6),
        shift_type: (wh.shift_type as ShiftType) ?? "morning",
        fingerprint_system: !!wh.fingerprint_system,
        attendance_system: !!wh.attendance_system,
        has_overtime: !!wh.has_overtime,
        overtime_entry_mode: (wh.overtime_entry_mode as OvertimeMode) ?? "total",
        overtime_total_hours: Number(wh.overtime_total_hours ?? 0),
        has_weekend_work: !!wh.has_weekend_work,
        has_holiday_work: !!wh.has_holiday_work,
      });
    }
    setOvertime(
      ot.map((r) => ({
        id: r.id,
        start_date: r.start_date ?? "",
        end_date: r.end_date ?? "",
        period_label: r.period_label ?? "",
        hours: r.hours ?? "",
        reason: r.reason ?? "",
        notes: r.notes ?? "",
      })),
    );
    setWeekend(
      wk.map((r) => ({
        id: r.id,
        start_date: r.start_date ?? "",
        end_date: r.end_date ?? "",
        days: r.days ?? "",
        hours: r.hours ?? "",
        notes: r.notes ?? "",
      })),
    );
    setHoliday(
      hd.map((r) => ({
        id: r.id,
        holiday_name: r.holiday_name ?? "",
        holiday_date: r.holiday_date ?? "",
        end_date: r.end_date ?? "",
        days: r.days ?? "",
        hours: r.hours ?? "",
        compensated: !!r.compensated,
        notes: r.notes ?? "",
      })),
    );
  }, [saved.data]);

  const hourlyRate = Number(salary.data?.hourly_salary ?? 0);

  // إعادة الحساب تلقائياً عند أي تغيير في المدخلات أو أجر الساعة
  const analysis = useMemo(
    () => analyzeWorkingHours({ settings, overtime, weekend, holiday, hourlyRate }),
    [settings, overtime, weekend, holiday, hourlyRate],
  );
  const errors = useMemo(
    () => validateWorkingHours({ settings, overtime, weekend, holiday }),
    [settings, overtime, weekend, holiday],
  );
  const valid = errors.length === 0 && analysis.conflicts.length === 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error("لا توجد قضية محفوظة");
      const { error: whErr } = await supabase.from("case_working_hours").upsert(
        {
          case_id: caseId,
          daily_hours: Number(settings.daily_hours) || 8,
          weekly_days: Number(settings.weekly_days) || 6,
          shift_type: settings.shift_type,
          fingerprint_system: settings.fingerprint_system,
          attendance_system: settings.attendance_system,
          has_overtime: settings.has_overtime,
          overtime_entry_mode: settings.overtime_entry_mode,
          overtime_total_hours: Number(settings.overtime_total_hours) || 0,
          has_weekend_work: settings.has_weekend_work,
          has_holiday_work: settings.has_holiday_work,
          analysis: analysis as never,
        },
        { onConflict: "case_id" },
      );
      if (whErr) throw whErr;

      // استبدال السجلات التفصيلية بالمدخلات الحالية (المصدر الوحيد للحقيقة هو الشاشة)
      await Promise.all([
        supabase.from("case_overtime").delete().eq("case_id", caseId),
        supabase.from("case_weekend_work").delete().eq("case_id", caseId),
        supabase.from("case_holiday_work").delete().eq("case_id", caseId),
      ]);

      const otRate = hourlyRate * OVERTIME_MULTIPLIER;
      const dailyHours = Number(settings.daily_hours) || 8;

      if (settings.has_overtime && settings.overtime_entry_mode !== "total" && overtime.length) {
        const { error } = await supabase.from("case_overtime").insert(
          overtime.map((r, i) => ({
            case_id: caseId,
            start_date: r.start_date || null,
            end_date: r.end_date || null,
            period_label: r.period_label || null,
            hours: Number(r.hours) || 0,
            reason: r.reason || null,
            notes: r.notes || null,
            amount: Math.round((Number(r.hours) || 0) * otRate * 100) / 100,
            sort_order: i,
          })),
        );
        if (error) throw error;
      }

      if (settings.has_weekend_work && weekend.length) {
        const { error } = await supabase.from("case_weekend_work").insert(
          weekend.map((r, i) => {
            const d = Number(r.days) || 0;
            const h = Number(r.hours) || d * dailyHours;
            return {
              case_id: caseId,
              start_date: r.start_date || null,
              end_date: r.end_date || null,
              days: d,
              hours: h,
              notes: r.notes || null,
              amount: Math.round(h * otRate * 100) / 100,
              sort_order: i,
            };
          }),
        );
        if (error) throw error;
      }

      if (settings.has_holiday_work && holiday.length) {
        const { error } = await supabase.from("case_holiday_work").insert(
          holiday.map((r, i) => {
            const d = Number(r.days) || 1;
            const h = Number(r.hours) || d * dailyHours;
            return {
              case_id: caseId,
              holiday_name: r.holiday_name || null,
              holiday_date: r.holiday_date || null,
              end_date: r.end_date || null,
              days: d,
              hours: h,
              compensated: r.compensated,
              notes: r.notes || null,
              amount: r.compensated ? 0 : Math.round(h * otRate * 100) / 100,
              sort_order: i,
            };
          }),
        );
        if (error) throw error;
      }

      await draft.saveNowWith({
        working_hours: {
          settings,
          analysis,
          hourly_salary: hourlyRate,
          overtime_multiplier: OVERTIME_MULTIPLIER,
          currency: "SAR",
        },
      });
    },
    onSuccess: () => void saved.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات ساعات العمل"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (!valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ ساعات العمل وإعادة احتساب جميع المستحقات المرتبطة");
    if (thenNext) navigate({ to: "/sa/unpaid-salaries" });
  };

  const setS = (patch: Partial<WorkingHoursSettings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Clock className="h-3.5 w-3.5" /> الخطوة 5 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">🇸🇦 ساعات العمل والساعات الإضافية</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُحتسب المستحقات تلقائياً من أجر الساعة المحسوب في خطوة الراتب، وتُعاد بالكامل بعد أي تعديل.
          </p>
        </div>

        {(draft.loading || saved.isLoading) && (
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-40 w-full" />
          </Card>
        )}

        {!draft.loading && !caseId && (
          <Card className="p-8 text-center">
            <h2 className="mb-1 font-bold">أكمل الخطوات السابقة أولاً</h2>
            <Button asChild className="mt-3 gap-2">
              <Link to="/sa/case-info">
                <ChevronRight className="h-4 w-4" /> الخطوة 1: بيانات القضية
              </Link>
            </Button>
          </Card>
        )}

        {caseId && !saved.isLoading && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              {/* أولاً: ساعات العمل */}
              <Card className="p-5">
                <h2 className="mb-4 font-bold">أولاً: عدد ساعات العمل</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">عدد ساعات العمل اليومية *</Label>
                    <Input
                      dir="ltr"
                      inputMode="decimal"
                      placeholder="8"
                      value={String(settings.daily_hours ?? "")}
                      onChange={(e) => setS({ daily_hours: e.target.value as never })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">عدد أيام العمل الأسبوعية *</Label>
                    <div className="flex gap-2">
                      {[5, 6, 7].map((d) => (
                        <Button
                          key={d}
                          type="button"
                          size="sm"
                          variant={Number(settings.weekly_days) === d ? "default" : "outline"}
                          onClick={() => setS({ weekly_days: d })}
                        >
                          {d} أيام
                        </Button>
                      ))}
                      <Input
                        dir="ltr"
                        className="w-20"
                        inputMode="numeric"
                        placeholder="مخصص"
                        value={String(settings.weekly_days ?? "")}
                        onChange={(e) => setS({ weekly_days: e.target.value as never })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">نظام الدوام</Label>
                    <Select
                      value={settings.shift_type}
                      onValueChange={(v) => setS({ shift_type: v as ShiftType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIFT_TYPES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ToggleRow
                    label="هل يوجد نظام بصمة؟"
                    checked={settings.fingerprint_system}
                    onChange={(v) => setS({ fingerprint_system: v })}
                  />
                  <ToggleRow
                    label="هل يوجد سجل حضور وانصراف؟"
                    checked={settings.attendance_system}
                    onChange={(v) => setS({ attendance_system: v })}
                  />
                </div>
              </Card>

              {/* ثانياً: الساعات الإضافية */}
              <Card className="p-5">
                <h2 className="mb-3 font-bold">ثانياً: ساعات العمل الإضافية</h2>
                <ToggleRow
                  label="هل عمل العامل ساعات إضافية؟"
                  checked={settings.has_overtime}
                  onChange={(v) => setS({ has_overtime: v })}
                />
                {settings.has_overtime && (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">طريقة الإدخال</Label>
                      <Select
                        value={settings.overtime_entry_mode}
                        onValueChange={(v) => setS({ overtime_entry_mode: v as OvertimeMode })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OVERTIME_MODES.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label} — {m.hint}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {settings.overtime_entry_mode === "total" ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs">إجمالي عدد الساعات الإضافية</Label>
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          placeholder="0"
                          value={String(settings.overtime_total_hours ?? "")}
                          onChange={(e) => setS({ overtime_total_hours: e.target.value as never })}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {overtime.map((r, i) => (
                          <div key={i} className="rounded-lg border bg-muted/30 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold">
                                {settings.overtime_entry_mode === "monthly" ? `الشهر ${i + 1}` : `الفترة ${i + 1}`}
                              </span>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => setOvertime((s) => s.filter((_, j) => j !== i))}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <Field label="من تاريخ">
                                <Input
                                  type="date"
                                  dir="ltr"
                                  value={r.start_date}
                                  onChange={(e) =>
                                    setOvertime((s) =>
                                      s.map((x, j) => (j === i ? { ...x, start_date: e.target.value } : x)),
                                    )
                                  }
                                />
                              </Field>
                              <Field label="إلى تاريخ">
                                <Input
                                  type="date"
                                  dir="ltr"
                                  value={r.end_date}
                                  onChange={(e) =>
                                    setOvertime((s) =>
                                      s.map((x, j) => (j === i ? { ...x, end_date: e.target.value } : x)),
                                    )
                                  }
                                />
                              </Field>
                              <Field label="عدد الساعات">
                                <Input
                                  dir="ltr"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={String(r.hours ?? "")}
                                  onChange={(e) =>
                                    setOvertime((s) => s.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))
                                  }
                                />
                              </Field>
                              <Field label="سبب العمل الإضافي">
                                <Input
                                  value={r.reason}
                                  onChange={(e) =>
                                    setOvertime((s) => s.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))
                                  }
                                />
                              </Field>
                              <div className="sm:col-span-2">
                                <Field label="ملاحظات">
                                  <Textarea
                                    rows={2}
                                    value={r.notes}
                                    onChange={(e) =>
                                      setOvertime((s) =>
                                        s.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)),
                                      )
                                    }
                                  />
                                </Field>
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => setOvertime((s) => [...s, emptyOvertime()])}
                        >
                          <Plus className="h-4 w-4" />
                          {settings.overtime_entry_mode === "monthly" ? "إضافة شهر آخر" : "إضافة فترة أخرى"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* ثالثاً: أيام الراحة */}
              <Card className="p-5">
                <h2 className="mb-3 font-bold">ثالثاً: العمل في أيام الراحة الأسبوعية</h2>
                <ToggleRow
                  label="هل عمل العامل في يوم الراحة الأسبوعية؟"
                  checked={settings.has_weekend_work}
                  onChange={(v) => setS({ has_weekend_work: v })}
                />
                {settings.has_weekend_work && (
                  <div className="mt-4 space-y-3">
                    {weekend.map((r, i) => (
                      <div key={i} className="rounded-lg border bg-muted/30 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold">الفترة {i + 1}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setWeekend((s) => s.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="من تاريخ">
                            <Input
                              type="date"
                              dir="ltr"
                              value={r.start_date}
                              onChange={(e) =>
                                setWeekend((s) => s.map((x, j) => (j === i ? { ...x, start_date: e.target.value } : x)))
                              }
                            />
                          </Field>
                          <Field label="إلى تاريخ">
                            <Input
                              type="date"
                              dir="ltr"
                              value={r.end_date}
                              onChange={(e) =>
                                setWeekend((s) => s.map((x, j) => (j === i ? { ...x, end_date: e.target.value } : x)))
                              }
                            />
                          </Field>
                          <Field label="عدد الأيام">
                            <Input
                              dir="ltr"
                              inputMode="decimal"
                              placeholder="0"
                              value={String(r.days ?? "")}
                              onChange={(e) =>
                                setWeekend((s) => s.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))
                              }
                            />
                          </Field>
                          <Field label="عدد الساعات">
                            <Input
                              dir="ltr"
                              inputMode="decimal"
                              placeholder="تلقائي من عدد الأيام"
                              value={String(r.hours ?? "")}
                              onChange={(e) =>
                                setWeekend((s) => s.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))
                              }
                            />
                          </Field>
                          <div className="sm:col-span-2">
                            <Field label="ملاحظات">
                              <Textarea
                                rows={2}
                                value={r.notes}
                                onChange={(e) =>
                                  setWeekend((s) => s.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))
                                }
                              />
                            </Field>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => setWeekend((s) => [...s, emptyWeekend()])}
                    >
                      <Plus className="h-4 w-4" /> إضافة فترة أخرى
                    </Button>
                  </div>
                )}
              </Card>

              {/* رابعاً: الإجازات الرسمية */}
              <Card className="p-5">
                <h2 className="mb-3 font-bold">رابعاً: العمل أثناء الإجازات الرسمية</h2>
                <ToggleRow
                  label="هل عمل العامل أثناء الإجازات الرسمية؟"
                  checked={settings.has_holiday_work}
                  onChange={(v) => setS({ has_holiday_work: v })}
                />
                {settings.has_holiday_work && (
                  <div className="mt-4 space-y-3">
                    {holiday.map((r, i) => (
                      <div key={i} className="rounded-lg border bg-muted/30 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold">الإجازة {i + 1}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setHoliday((s) => s.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="اسم الإجازة">
                            <Input
                              value={r.holiday_name}
                              placeholder="عيد الفطر / اليوم الوطني ..."
                              onChange={(e) =>
                                setHoliday((s) =>
                                  s.map((x, j) => (j === i ? { ...x, holiday_name: e.target.value } : x)),
                                )
                              }
                            />
                          </Field>
                          <Field label="تاريخ الإجازة">
                            <Input
                              type="date"
                              dir="ltr"
                              value={r.holiday_date}
                              onChange={(e) =>
                                setHoliday((s) =>
                                  s.map((x, j) => (j === i ? { ...x, holiday_date: e.target.value } : x)),
                                )
                              }
                            />
                          </Field>
                          <Field label="عدد الأيام">
                            <Input
                              dir="ltr"
                              inputMode="decimal"
                              placeholder="1"
                              value={String(r.days ?? "")}
                              onChange={(e) =>
                                setHoliday((s) => s.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))
                              }
                            />
                          </Field>
                          <Field label="عدد الساعات">
                            <Input
                              dir="ltr"
                              inputMode="decimal"
                              placeholder="تلقائي من عدد الأيام"
                              value={String(r.hours ?? "")}
                              onChange={(e) =>
                                setHoliday((s) => s.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))
                              }
                            />
                          </Field>
                          <div className="sm:col-span-2">
                            <ToggleRow
                              label="هل تم تعويض العامل عنها سابقاً؟"
                              checked={r.compensated}
                              onChange={(v) =>
                                setHoliday((s) => s.map((x, j) => (j === i ? { ...x, compensated: v } : x)))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => setHoliday((s) => [...s, emptyHoliday()])}
                    >
                      <Plus className="h-4 w-4" /> إضافة إجازة أخرى
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            {/* النتائج */}
            <div className="space-y-4 lg:col-span-2">
              <Card className="p-5">
                <h2 className="mb-3 flex items-center gap-2 font-bold">
                  <Info className="h-4 w-4 text-primary" /> نتائج التحليل (تلقائية)
                </h2>
                <dl className="space-y-2 text-sm">
                  <Fact label="أجر الساعة (من خطوة الراتب)" value={money(analysis.overtime.hourlyRate)} />
                  <Fact label="إجمالي الساعات الإضافية" value={`${analysis.overtime.hours} ساعة`} />
                  <Fact label="عدد الأيام" value={`${analysis.overtime.days} يوم`} />
                  <Fact label="متوسط الساعات لليوم" value={`${analysis.overtime.avgPerDay} ساعة`} />
                  <Fact label={`مستحقات الساعات الإضافية (×${OVERTIME_MULTIPLIER})`} value={money(analysis.overtime.amount)} />
                  <Fact label="أيام الراحة" value={`${analysis.weekend.days} يوم / ${analysis.weekend.hours} ساعة`} />
                  <Fact label="مستحقات أيام الراحة" value={money(analysis.weekend.amount)} />
                  <Fact
                    label="الإجازات الرسمية"
                    value={`${analysis.holiday.count} إجازة / ${analysis.holiday.days} يوم`}
                  />
                  <Fact label="أيام مُعوّضة سابقاً" value={`${analysis.holiday.compensatedDays} يوم`} />
                  <Fact label="مستحقات الإجازات الرسمية" value={money(analysis.holiday.amount)} />
                  <Fact label="إجمالي المستحقات" value={money(analysis.totalAmount)} />
                </dl>
                <Alert className="mt-4">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>قيمة الساعة غير قابلة للإدخال</AlertTitle>
                  <AlertDescription className="text-xs">
                    يعتمد النظام على أجر الساعة المحسوب في الخطوة 4 فقط، وتُعاد جميع النتائج تلقائياً عند تعديل الراتب أو
                    الساعات أو الأيام أو الإجازات.
                  </AlertDescription>
                </Alert>
                {hourlyRate <= 0 && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>أجر الساعة غير متوفر</AlertTitle>
                    <AlertDescription className="text-xs">
                      أكمل خطوة الراتب أولاً حتى تُحتسب المستحقات المالية.
                    </AlertDescription>
                  </Alert>
                )}
              </Card>

              <Card className="space-y-3 p-5">
                <h3 className="font-bold">التحقق قبل الانتقال</h3>
                {analysis.duplicatesRemoved > 0 && (
                  <p className="text-xs text-muted-foreground">
                    تم استبعاد {analysis.duplicatesRemoved} سطراً مكرراً تلقائياً من الحساب.
                  </p>
                )}
                {analysis.conflicts.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>تعارضات في الفترات</AlertTitle>
                    <AlertDescription className="text-xs">
                      <ul className="list-disc space-y-1 pe-4">
                        {analysis.conflicts.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                {touched && errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>يرجى تصحيح ما يلي</AlertTitle>
                    <AlertDescription className="text-xs">
                      <ul className="list-disc space-y-1 pe-4">
                        {errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                {valid && (
                  <ul className="list-disc space-y-1 pe-4 text-xs text-muted-foreground">
                    <li>جميع التواريخ صحيحة ولا يوجد تداخل</li>
                    <li>لا توجد ساعات أو أيام سالبة</li>
                    <li>تم استبعاد التكرار واحتساب المستحقات</li>
                  </ul>
                )}
                <Button className="w-full gap-2" disabled={save.isPending} onClick={() => void submit(false)}>
                  <Save className="h-4 w-4" /> حفظ ساعات العمل
                </Button>
              </Card>
            </div>
          </div>
        )}

        {caseId && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" className="gap-1">
              <Link to="/sa/salary">
                <ChevronRight className="h-4 w-4" /> السابق: بيانات الراتب
              </Link>
            </Button>
            <Button className="gap-2" disabled={!valid || save.isPending} onClick={() => void submit(true)}>
              التالي: الحاسبة <ArrowLeft className="h-4 w-4" />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">{checked ? "نعم" : "لا"}</span>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
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
