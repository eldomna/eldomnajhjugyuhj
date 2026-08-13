import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/calculator";
import { useApprovedLegalReferences, formatLegalReference, PENDING_REFERENCE_NOTICE } from "@/hooks/useLegalReferences";
import { legalArticle, legalCitation } from "@/lib/legal-articles";


import { useCalculatorStore } from "@/store/calculator";
import { generateReportPDF } from "@/lib/pdf";
import { addLocalDoc } from "@/lib/documents";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Download, Save, FileText, Info, FileSignature, Coins, Scale, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LegalClaimDialog } from "@/components/LegalClaimDialog";

const COLORS = ["#006838", "#D4A03B", "#0EA5E9", "#DC2626"];

export function CalculatorResults() {
  const { lastInput, lastResult } = useCalculatorStore();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["platform_settings_fx"],
    queryFn: async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return null;
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("enable_info_currency_conversion")
          .eq("id", 1)
          .maybeSingle();
        return data;
      } catch {
        return null;
      }
    },
    enabled: typeof navigator === "undefined" || navigator.onLine,
  });
  const showFxNote = Boolean(
    (settings as { enable_info_currency_conversion?: boolean } | null)?.enable_info_currency_conversion,
  );


  if (!lastInput || !lastResult) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p>أدخل البيانات واضغط "احتساب الحقوق" لعرض النتائج هنا.</p>
      </Card>
    );
  }

  const fr = lastResult.female_rights;

  const data = [
    { name: "نهاية الخدمة", value: lastResult.eos_benefit },
    { name: "إضافي نهاري", value: lastResult.day_overtime_amount },
    { name: "إضافي ليلي", value: lastResult.night_overtime_amount },
    { name: "يوم الجمعة", value: lastResult.friday_compensation || 0 },
    { name: "إجازات رسمية", value: lastResult.holiday_compensation || 0 },
    { name: "بدل الإنذار", value: lastResult.notice_indemnity || 0 },
    { name: "إجازات", value: lastResult.leave_compensation || 0 },
    { name: "حقوق المرأة العاملة", value: fr?.total || 0 },
  ].filter((d) => d.value > 0);

  const summary: { label: string; value: number }[] = [
    { label: "الأجر اليومي", value: lastResult.daily_rate },
    { label: "الأجر بالساعة", value: lastResult.hourly_rate },
    { label: "مكافأة نهاية الخدمة", value: lastResult.eos_benefit },
    { label: "تعويض إضافي نهاري (150%)", value: lastResult.day_overtime_amount },
    { label: "تعويض إضافي ليلي (200%)", value: lastResult.night_overtime_amount },
    { label: "بدل يوم الجمعة (200%)", value: lastResult.friday_compensation || 0 },
    { label: "أجر الإجازات الرسمية (200%)", value: lastResult.holiday_compensation || 0 },
    { label: "بدل الإنذار", value: lastResult.notice_indemnity || 0 },
    { label: "بدل الإجازات غير المستخدمة", value: lastResult.leave_compensation || 0 },
    { label: "ساعات تجاوز الحد أثناء الحمل/الرضاعة (150%)", value: fr?.extra_hours_amount || 0 },
    { label: "أجر إجازة الوضع", value: fr?.maternity_leave_amount || 0 },
  ].filter((s) => s.value > 0);
  if ((lastResult.eosb_advance_deduction || 0) > 0) {
    summary.push({ label: "− مكافأة مستلمة سابقاً", value: -(lastResult.eosb_advance_deduction || 0) });
  }


  const downloadPDF = async () => {
    setDownloading(true);
    try {
      // Official registration requires a signed-in user (server enforces too).
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        toast.error("يجب تسجيل الدخول لإصدار تقرير رسمي بسجل تحقق.");
        setDownloading(false);
        return;
      }
      // 1) Allocate a serial via secure server RPC
      const { data: reg, error: regErr } = await supabase.rpc("register_document", {
        p_employee_name: lastInput.employee_name || "",
        p_employer_name: lastInput.employer_name || "",
        p_monthly_salary: lastInput.monthly_salary,
        p_service_years: lastResult.years,
        p_service_months: lastResult.months,
        p_total_amount: lastResult.total_due,
        p_custom_clauses: "",
        p_currency: lastInput.currency,
        p_service_start_date: lastInput.service_start_date || null,
        p_service_end_date: lastInput.service_end_date || null,
      });
      if (regErr || !reg || reg.length === 0) {
        toast.error("تعذّر إصدار الرقم التسلسلي");
        return;
      }
      const { serial_number, created_at } = reg[0];
      const issuedAt = new Date(created_at);

      // 2) Fetch branding (admin-managed) + active PDF template
      const [{ data: settings }, { data: template }] = await Promise.all([
        supabase
          .from("platform_settings")
          .select("platform_name, logo_url, default_clauses, report_footer")
          .eq("id", 1)
          .maybeSingle(),
        supabase
          .from("pdf_templates")
          .select("watermark, signature_block, disclaimer, verification_statement")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
      ]);

      // 3) Generate PDF
      await generateReportPDF(
        lastInput,
        lastResult,
        {
          platformName: settings?.platform_name || "حاسبة العمال الذكية",
          logoUrl: settings?.logo_url ?? null,
          footer: settings?.report_footer ?? null,
        },
        {
          serial: serial_number,
          issuedAt,
          customClauses: settings?.default_clauses?.trim() || undefined,
          template: template
            ? {
                watermark: template.watermark,
                signatureBlock: template.signature_block,
                disclaimer: template.disclaimer,
                verificationStatement: template.verification_statement,
              }
            : undefined,
        },
      );

      // 4) Persist locally for offline verification fallback
      addLocalDoc({
        serial: serial_number,
        employee_name: lastInput.employee_name,
        employer_name: lastInput.employer_name,
        total_amount: lastResult.total_due,
        currency: lastInput.currency,
        issued_at: issuedAt.toISOString(),
      });

      // 5) Audit log (best-effort, fire-and-forget)
      import("@/lib/audit.functions")
        .then(({ logAudit }) =>
          logAudit({
            data: {
              action: "document.generate_pdf",
              target_type: "documents",
              target_id: serial_number,
              metadata: { total_amount: lastResult.total_due },
            },
          }).catch(() => {}),
        )
        .catch(() => {});

      toast.success(`تم إصدار التقرير برقم: ${serial_number}`);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "حدث خطأ أثناء إنشاء التقرير");
    } finally {
      setDownloading(false);
    }
  };

  const save = async () => {
    if (!lastInput || !lastResult) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      toast.info("سجّل الدخول لحفظ النتيجة في حسابك. سيتم استرجاع بياناتك تلقائياً.");
      navigate({ to: "/auth" });
      return;
    }
    const { error } = await supabase.from("calculations").insert({
      user_id: u.user.id,
      employee_name: lastInput.employee_name || "",
      employer_name: lastInput.employer_name || "",
      monthly_salary: lastInput.monthly_salary,
      currency: lastInput.currency,
      service_start_date: lastInput.service_start_date || null,
      service_end_date: lastInput.service_end_date || null,
      service_years: lastResult.years,
      service_months: lastResult.months,
      day_overtime_hours: lastInput.day_overtime_hours,
      night_overtime_hours: lastInput.night_overtime_hours,
      unused_leave_days: lastInput.unused_leave_days,
      daily_rate: lastResult.daily_rate,
      hourly_rate: lastResult.hourly_rate,
      total_service_years: lastResult.total_service_years,
      eos_benefit: lastResult.eos_benefit,
      day_overtime_amount: lastResult.day_overtime_amount,
      night_overtime_amount: lastResult.night_overtime_amount,
      // holiday_compensation is folded into leave_compensation persisted value
      // so the existing schema captures all monetary rights without migration.
      leave_compensation:
        (lastResult.leave_compensation || 0) + (lastResult.holiday_compensation || 0),
      total_due: lastResult.total_due,
      // لقطة كاملة للتقرير (المدخلات + النتيجة) لإعادة عرضه وتنزيله لاحقاً كما هو.
      payload: {
        version: 1,
        saved_at: new Date().toISOString(),
        input: lastInput,
        result: lastResult,
      } as unknown as never,

    });
    setSaving(false);
    if (error) {
      toast.error("تعذّر الحفظ");
    } else {
      toast.success("تم حفظ النتيجة في سجل حساباتك");
      navigate({ to: "/calculations" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden card-elev">
        <div className="gov-gradient text-primary-foreground p-6">
          <p className="text-sm opacity-90">إجمالي الحقوق المضمونة (تقديري)</p>
          <p className="text-4xl font-bold tracking-tight font-display mt-1 tabular-nums">
            {formatCurrency(lastResult.total_due, lastInput.currency)}
          </p>
          {(lastInput.employee_name || lastInput.employer_name) && (
            <p className="text-xs opacity-80 mt-2">
              {[lastInput.employee_name, lastInput.employer_name].filter(Boolean).join(" • ")}
            </p>
          )}
          <p className="text-[11px] opacity-75 mt-2 leading-relaxed">
            هذه نتيجة تقديرية بناءً على البيانات المدخلة ووفق قانون العمل اليمني، وليست بديلاً عن الاستشارة القانونية أو حكم القضاء.
          </p>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-3">
          {summary.map((s) => (
            <div key={s.label} className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <span className="font-semibold tabular-nums">{formatCurrency(s.value, lastInput.currency)}</span>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 space-y-2">
          <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>تم احتساب مكافأة نهاية الخدمة بناءً على آخر راتب فعلي قبل انتهاء الخدمة. جميع المبالغ بعملة {lastInput.currency} دون أي تحويل تلقائي.</span>
          </div>
          {showFxNote && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <Coins className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>القيم المحولة معلوماتية فقط ولا تستخدم في الحسابات القانونية.</span>
            </div>
          )}
        </div>
      </Card>

      {lastResult.legal_notes.length > 0 && (
        <Card className="p-5 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <h3 className="font-bold text-amber-900 dark:text-amber-200">ملاحظات قانونية</h3>
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-100/80 mb-4">
            القيم التالية تقديرات قضائية أو إدارية، تُعرض للاسترشاد فقط ولا تدخل ضمن إجمالي المستحقات المضمونة.
          </p>
          <div className="space-y-3">
            {lastResult.legal_notes.map((n) => (
              <div key={n.key} className="rounded-lg border border-amber-500/30 bg-background p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-semibold text-sm">{n.title}</span>
                  <span className="font-bold tabular-nums text-amber-800 dark:text-amber-200 text-xs">
                    التعويض يخضع لتقدير المحكمة
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">تقدير استرشادي للحسبة فقط: {n.formula} = {formatCurrency(n.amount, lastInput.currency)}</p>
                <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">⚠ {n.warning}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LimitationCard />

      <SickLeaveCard />

      <DetailedExplanation />


      <FinalSummaryTable />


      {data.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold mb-3">توزيع المستحقات</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v, lastInput.currency)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-bold">المراجع القانونية</h3>
        </div>
        <LegalRefsList />
      </Card>


      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">بيانات اختيارية لتقرير PDF</p>
        <p className="text-xs text-muted-foreground">
          يمكنك إضافة اسمك واسم جهة العمل لإظهارهما في التقرير الرسمي، أو تركهما فارغين.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="اسم العامل (اختياري)"
            value={lastInput.employee_name}
            onChange={(e) => useCalculatorStore.getState().setLast(
              { ...lastInput, employee_name: e.target.value }, lastResult,
            )}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="اسم جهة العمل (اختياري)"
            value={lastInput.employer_name}
            onChange={(e) => useCalculatorStore.getState().setLast(
              { ...lastInput, employer_name: e.target.value }, lastResult,
            )}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={downloadPDF} disabled={downloading} className="gap-2">
          <Download className="h-4 w-4" /> {downloading ? "جارٍ الإصدار..." : "تنزيل PDF رسمي"}
        </Button>
        <Button onClick={() => setClaimOpen(true)} variant="secondary" className="gap-2">
          <FileSignature className="h-4 w-4" /> إنشاء مطالبة قانونية
        </Button>
        <Button onClick={save} variant="outline" disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? "جارٍ الحفظ..." : "حفظ في حسابي"}
        </Button>
        <Button
          onClick={() => {
            useCalculatorStore.getState().newCalculation();
            toast.success("تم بدء حسبة جديدة");
            const el = document.getElementById("calculator");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          variant="ghost"
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" /> حسبة جديدة
        </Button>
      </div>

      <LegalClaimDialog open={claimOpen} onOpenChange={setClaimOpen} input={lastInput} result={lastResult} />
    </div>
  );
}

function LegalRefsList() {
  const { data, isLoading } = useApprovedLegalReferences();
  if (isLoading) return <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>;
  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground bg-muted/40 border border-dashed rounded p-3">
        {PENDING_REFERENCE_NOTICE}
      </div>
    );
  }
  return (
    <ul className="space-y-2 text-sm text-muted-foreground list-disc pr-5">
      {data.map((r) => <li key={r.id}>{formatLegalReference(r)}</li>)}
    </ul>
  );
}


function fmtNum(n: number, digits = 2): string {
  if (!isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
}

function DetailedExplanation() {
  const { lastInput: i, lastResult: r } = useCalculatorStore();
  if (!i || !r) return null;
  const cur = i.currency;
  const f = (v: number) => formatCurrency(v, cur);

  type Unit = "currency" | "duration" | "hours" | "days" | "none";
  type Row = {
    title: string;
    article: string;
    formula: string;
    substituted: string;
    amount: number;
    unit?: Unit;
    display?: string;
    note?: string;
  };
  const rows: Row[] = [];

  rows.push({
    title: "الأجر اليومي",
    article: "المادة 2 — تعريف الأجر",
    formula: "الراتب الشهري ÷ 30",
    substituted: `${fmtNum(i.monthly_salary)} ÷ 30 = ${fmtNum(r.daily_rate)}`,
    amount: r.daily_rate,
    unit: "currency",
  });
  rows.push({
    title: "الأجر بالساعة",
    article: "المادة 71 — ساعات العمل (8 ساعات/يوم)",
    formula: "الأجر اليومي ÷ 8",
    substituted: `${fmtNum(r.daily_rate)} ÷ 8 = ${fmtNum(r.hourly_rate)}`,
    amount: r.hourly_rate,
    unit: "currency",
  });

  rows.push({
    title: "مدة الخدمة",
    article: "المادة 120",
    formula: "تاريخ الانتهاء − تاريخ البدء",
    substituted: `${r.years} سنة و ${r.months} شهر و ${r.days} يوم (${fmtNum(r.total_service_years, 3)} سنة كسرية)`,
    amount: r.total_service_years,
    unit: "duration",
    display: `${r.years} سنة و ${r.months} شهر و ${r.days} يوم`,
    note: "تستخدم المدة الكسرية لاحتساب مكافأة نهاية الخدمة وأرصدة الإجازات.",
  });

  if (r.eos_benefit > 0) {
    const hasPeriods = (r.eos_breakdown?.length || 0) > 1;
    rows.push({
      title: "مكافأة نهاية الخدمة (EOSB)",
      article: "المادة 120 — أجر شهر عن كل سنة خدمة",
      formula: hasPeriods
        ? "مجموع (الراتب في كل فترة × سنوات الفترة)"
        : "آخر راتب × عدد سنوات الخدمة الكسرية",
      substituted: hasPeriods
        ? (r.eos_breakdown || [])
            .map((b) => `${fmtNum(b.salary)} × ${fmtNum(b.years, 3)} = ${fmtNum(b.amount)}`)
            .join("  +  ")
        : `${fmtNum(i.monthly_salary)} × ${fmtNum(r.total_service_years, 3)} = ${fmtNum(r.eos_benefit)}`,
      amount: r.eos_benefit,
    });
  }

  if (r.day_overtime_amount > 0) {
    rows.push({
      title: "تعويض العمل الإضافي النهاري (150%)",
      article: "المادة 56 — العمل الإضافي (+50%)",
      formula: "ساعات إضافية نهارية × الأجر بالساعة × 1.5",
      substituted: `${fmtNum(i.day_overtime_hours)} × ${fmtNum(r.hourly_rate)} × 1.5 = ${fmtNum(r.day_overtime_amount)}`,
      amount: r.day_overtime_amount,
    });
  }
  if (r.night_overtime_amount > 0) {
    rows.push({
      title: "تعويض العمل الإضافي الليلي (200%)",
      article: "المادة 56 — العمل الليلي (20:00–05:00)",
      formula: "ساعات إضافية ليلية × الأجر بالساعة × 2",
      substituted: `${fmtNum(i.night_overtime_hours)} × ${fmtNum(r.hourly_rate)} × 2 = ${fmtNum(r.night_overtime_amount)}`,
      amount: r.night_overtime_amount,
      note: "عند تداخل الساعة الإضافية مع الفترة الليلية لا تُجمع النسب (150% + 200%) بل تُطبَّق الأعلى فقط 200%.",
    });
  }

  if (r.friday_compensation > 0) {
    const totalDays = r.total_days;
    const fridays = Math.floor(totalDays / 7);
    const fh = Number(i.friday_worked_hours) || 0;
    const paid = i.friday_paid ? Number(i.friday_pay_received) || 0 : 0;
    rows.push({
      title: "بدل العمل يوم الجمعة (200%)",
      article: "المادة 77 — يوم الراحة الأسبوعية",
      formula: "عدد الجمع × ساعات العمل في الجمعة × الأجر بالساعة × 2 − ما تم دفعه",
      substituted: `${fridays} × ${fmtNum(fh)} × ${fmtNum(r.hourly_rate)} × 2 − ${fmtNum(paid)} = ${fmtNum(r.friday_compensation)}`,
      amount: r.friday_compensation,
    });
  }

  if (r.holiday_compensation > 0) {
    if (r.holiday_breakdown && r.holiday_breakdown.length > 0) {
      for (const hb of r.holiday_breakdown) {
        const formula = hb.hoursPerDay > 0
          ? "أيام العمل × ساعات العمل اليومية × الأجر بالساعة × 2"
          : "أيام العمل × الأجر اليومي × 2";
        const subst = hb.hoursPerDay > 0
          ? `${hb.daysWorked} × ${fmtNum(hb.hoursPerDay)} × ${fmtNum(r.hourly_rate)} × 2 = ${fmtNum(hb.amount)}`
          : `${hb.daysWorked} × ${fmtNum(r.daily_rate)} × 2 = ${fmtNum(hb.amount)}`;
        rows.push({
          title: `${hb.name} — ${hb.year} (200%)`,
          article: `${hb.start} → ${hb.end} • مجموع الأيام: ${hb.totalDays}`,
          formula,
          substituted: subst,
          amount: hb.amount,
        });
      }
    } else {
      const days = Math.max(0, Number(i.holiday_days_worked) || 0);
      rows.push({
        title: "بدل العمل في الإجازات الرسمية (200%)",
        article: "المادة 78 — الإجازات الرسمية",
        formula: "أيام الإجازات الرسمية × الأجر اليومي × 2",
        substituted: `${days} × ${fmtNum(r.daily_rate)} × 2 = ${fmtNum(r.holiday_compensation)}`,
        amount: r.holiday_compensation,
      });
    }
  }

  if (r.notice_indemnity > 0) {
    rows.push({
      title: "بدل الإنذار",
      article: "المادة 35 — مهلة الإنذار قبل الإنهاء",
      formula: "آخر راتب شهري × (1 − شهور الإنذار الممنوحة)",
      substituted: `${fmtNum(i.monthly_salary)} × (1 − ${i.notice_given ? i.notice_months || 0 : 0}) = ${fmtNum(r.notice_indemnity)}`,
      amount: r.notice_indemnity,
    });
  }

  if (r.leave_compensation > 0) {
    const entitled = 30 * r.total_service_years;
    const received = i.annual_leave_status === "partial" ? Number(i.annual_leave_days_received) || 0 : i.annual_leave_status === "full" ? Math.round(entitled) : 0;
    const unused = Math.max(0, Math.round(entitled - received));
    rows.push({
      title: "بدل الإجازات السنوية غير المستخدمة",
      article: "المادة 79 — 30 يوماً عن كل سنة خدمة",
      formula: "(الأيام المستحقة − الأيام الممنوحة) × الأجر اليومي",
      substituted: `(${fmtNum(entitled, 1)} − ${received}) ≈ ${unused} يوم × ${fmtNum(r.daily_rate)} = ${fmtNum(r.leave_compensation)}`,
      amount: r.leave_compensation,
      note: "تقدير قد تعدّله الجهة المختصة بحسب الكشوف الرسمية.",
    });
  }

  const fr = r.female_rights;
  if (fr && fr.extra_hours_amount > 0) {
    rows.push({
      title: "ساعات العمل الزائدة أثناء الحمل والرضاعة (150%)",
      article: "المواد 43–44 — حد 5 ساعات عمل يومياً من الشهر السادس للحمل وحتى 6 أشهر بعد الولادة",
      formula: "(ساعات العمل اليومية − 5) × عدد أيام الحماية × الأجر بالساعة × 1.5",
      substituted: `(${fmtNum(fr.actual_daily_hours)} − ${fmtNum(fr.legal_daily_hours, 0)}) × ${fmtNum(fr.pregnancy_days_worked + fr.lactation_days_worked, 0)} يوم × ${fmtNum(fr.hourly_rate)} × 1.5 = ${fmtNum(fr.extra_hours_amount)}`,
      amount: fr.extra_hours_amount,
    });
  }
  if (fr && fr.maternity_leave_amount > 0) {
    rows.push({
      title: "أجر إجازة الوضع",
      article: "المادة 45 — إجازة وضع بأجر كامل (60 يوماً / 80 يوماً للولادة المتعسرة أو التوأم)",
      formula: "أيام إجازة الوضع × الأجر اليومي",
      substituted: `${fmtNum(fr.maternity_leave_days, 0)} يوم × ${fmtNum(r.daily_rate)} = ${fmtNum(fr.maternity_leave_amount)}`,
      amount: fr.maternity_leave_amount,
      note: "تُحتسب فقط عند عدم منح الإجازة أو منحها بدون أجر.",
    });
  }


  if ((r.eosb_advance_deduction || 0) > 0) {
    rows.push({
      title: "خصم مكافأة مستلمة سابقاً",
      article: "ما تم دفعه فعلياً يُخصم من الإجمالي",
      formula: "− المبلغ المستلم سابقاً",
      substituted: `− ${fmtNum(r.eosb_advance_deduction)}`,
      amount: -r.eosb_advance_deduction,
    });
  }

  rows.push({
    title: "الإجمالي المضمون",
    article: "مجموع البنود السابقة",
    formula: "نهاية الخدمة + الإضافي + الجمعة + الإجازات الرسمية + الإنذار + الإجازات − الخصومات",
    substituted: `= ${fmtNum(r.total_due)}`,
    amount: r.total_due,
  });

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className="font-bold">التفسير التفصيلي لكل بند</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        يعرض المعادلة، المدخلات المستخدمة، والمادة القانونية المرجعية لكل مبلغ.
      </p>
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const unit: "currency" | "duration" | "hours" | "days" | "none" = row.unit ?? "currency";
          const rendered =
            row.display ??
            (unit === "currency" ? f(row.amount)
              : unit === "hours" ? `${fmtNum(row.amount)} ساعة`
              : unit === "days" ? `${fmtNum(row.amount)} يوم`
              : unit === "none" ? fmtNum(row.amount)
              : `${fmtNum(row.amount, 3)} سنة`);
          return (
            <div key={idx} className="rounded-lg border bg-card/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="font-semibold text-sm">{row.title}</span>
                <span className={`font-bold tabular-nums ${row.amount < 0 ? "text-red-600" : ""}`}>
                  {rendered}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">📜 {row.article}</p>
              <p className="text-xs">
                <span className="text-muted-foreground">المعادلة:</span> <span className="font-medium">{row.formula}</span>
              </p>
              <p className="text-xs tabular-nums" dir="ltr" style={{ textAlign: "right" }}>
                <span className="text-muted-foreground">الاحتساب:</span> {row.substituted}
              </p>
              {row.note && <p className="text-[11px] text-amber-700 dark:text-amber-300">⚠ {row.note}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FinalSummaryTable() {
  const { lastInput: i, lastResult: r } = useCalculatorStore();
  if (!i || !r) return null;
  const cur = i.currency;
  const f = (v: number) => formatCurrency(v, cur);

  const rows: { type: string; details: string; amount: number }[] = [];
  if (r.eos_benefit > 0)
    rows.push({ type: "مكافأة نهاية الخدمة", details: `${r.years} سنة و ${r.months} شهر و ${r.days} يوم — المادة 120`, amount: r.eos_benefit });
  if (r.day_overtime_amount > 0)
    rows.push({ type: "عمل إضافي نهاري (150%)", details: `${fmtNum(i.day_overtime_hours)} ساعة — المادة 56`, amount: r.day_overtime_amount });
  if (r.night_overtime_amount > 0)
    rows.push({ type: "عمل إضافي ليلي (200%)", details: `${fmtNum(i.night_overtime_hours)} ساعة — المادة 56`, amount: r.night_overtime_amount });
  if (r.friday_compensation > 0)
    rows.push({ type: "بدل العمل يوم الجمعة (200%)", details: "المادة 77 — يوم الراحة الأسبوعية", amount: r.friday_compensation });
  if (r.holiday_compensation > 0 && r.holiday_breakdown) {
    for (const hb of r.holiday_breakdown) {
      rows.push({
        type: `${hb.name} ${hb.year} (200%)`,
        details: `${hb.daysWorked} يوم${hb.hoursPerDay > 0 ? ` × ${fmtNum(hb.hoursPerDay)} ساعة` : ""}`,
        amount: hb.amount,
      });
    }
  }
  if (r.notice_indemnity > 0)
    rows.push({ type: "بدل الإنذار", details: "المادة 35", amount: r.notice_indemnity });
  if (r.leave_compensation > 0)
    rows.push({ type: "بدل الإجازات غير المستخدمة", details: "المادة 79", amount: r.leave_compensation });
  if (r.female_rights?.extra_hours_amount)
    rows.push({
      type: "ساعات زائدة أثناء الحمل/الرضاعة (150%)",
      details: `${fmtNum(r.female_rights.extra_hours_total)} ساعة — المادتان 43 و44`,
      amount: r.female_rights.extra_hours_amount,
    });
  if (r.female_rights?.maternity_leave_amount)
    rows.push({
      type: "أجر إجازة الوضع",
      details: `${fmtNum(r.female_rights.maternity_leave_days, 0)} يوم — المادة 45`,
      amount: r.female_rights.maternity_leave_amount,
    });

  if ((r.eosb_advance_deduction || 0) > 0)
    rows.push({ type: "خصم مكافأة مستلمة سابقاً", details: "يُخصم من الإجمالي", amount: -r.eosb_advance_deduction });

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className="font-bold">الملخص النهائي</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 text-right">
              <th className="border px-3 py-2 font-semibold">نوع الحق</th>
              <th className="border px-3 py-2 font-semibold">التفاصيل</th>
              <th className="border px-3 py-2 font-semibold text-left">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="border px-3 py-2">{row.type}</td>
                <td className="border px-3 py-2 text-muted-foreground text-xs">{row.details}</td>
                <td className={`border px-3 py-2 text-left tabular-nums font-semibold ${row.amount < 0 ? "text-red-600" : ""}`}>
                  {f(row.amount)}
                </td>
              </tr>
            ))}
            <tr className="bg-primary/5">
              <td className="border px-3 py-2 font-bold" colSpan={2}>الإجمالي النهائي</td>
              <td className="border px-3 py-2 text-left tabular-nums font-bold text-primary">
                {f(r.total_due)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {r.legal_notes.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          ⚠ بنود الفصل التعسفي لا تُضاف إلى الإجمالي — التعويض يخضع لتقدير المحكمة حسب ظروف القضية.
        </p>
      )}
    </Card>
  );
}


/** Statute of limitations (Art. 149) — its own standalone section. */
function LimitationCard() {
  const { lastResult } = useCalculatorStore();
  const lim = lastResult?.limitation;
  if (!lim) return null;

  const art = legalArticle("limitation");
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("ar-EG-u-nu-latn", { year: "numeric", month: "long", day: "numeric" }) : "—";

  const tone =
    lim.status === "expired"
      ? "border-red-500/40 bg-red-500/5"
      : lim.status === "expiring"
        ? "border-amber-500/40 bg-amber-500/5"
        : lim.status === "valid"
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border bg-muted/20";

  const headline =
    lim.status === "expired"
      ? "انتهت مدة التقادم — لا تُسمع الدعوى"
      : lim.status === "expiring"
        ? `تنبيه عاجل: تبقّى ${lim.days_remaining} يوماً فقط على انتهاء مدة التقادم`
        : lim.status === "valid"
          ? `الدعوى ما زالت مقبولة — تبقّى ${lim.days_remaining} يوماً`
          : "علاقة العمل ما زالت قائمة — لم تبدأ مدة التقادم بعد";

  return (
    <Card className={`p-5 ${tone}`}>
      <div className="flex items-center gap-2 mb-3">
        <Scale className="h-4 w-4 text-primary" />
        <h3 className="font-bold">تقادم الدعوى العمالية</h3>
      </div>

      <p className="font-semibold text-sm mb-3">{headline}</p>

      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <div className="rounded-lg border bg-background px-3 py-2">
          <span className="block text-[11px] text-muted-foreground">تاريخ انتهاء الخدمة</span>
          <span className="font-semibold">{lim.ongoing ? "مستمر" : fmt(lim.end_date)}</span>
        </div>
        <div className="rounded-lg border bg-background px-3 py-2">
          <span className="block text-[11px] text-muted-foreground">آخر موعد لرفع الدعوى</span>
          <span className="font-semibold">{fmt(lim.deadline)}</span>
        </div>
        <div className="rounded-lg border bg-background px-3 py-2">
          <span className="block text-[11px] text-muted-foreground">الأيام المتبقية</span>
          <span className="font-semibold tabular-nums">
            {lim.days_remaining === null ? "—" : lim.days_remaining < 0 ? "منتهية" : lim.days_remaining}
          </span>
        </div>
      </div>

      <div className="mt-3 rounded-md border bg-background/70 px-3 py-2 space-y-1">
        <p className="text-[11px] font-semibold text-primary">{legalCitation("limitation")}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{art.text}</p>
        <p className="text-xs leading-relaxed">{art.interpretation}</p>
      </div>
    </Card>
  );
}


/** Tiered sick-leave breakdown (Art. 80). */
function SickLeaveCard() {
  const { lastInput, lastResult } = useCalculatorStore();
  const sick = lastResult?.sick_leave;
  if (!lastInput || !sick?.applies) return null;

  const f = (n: number) => formatCurrency(n, lastInput.currency);
  const art = legalArticle("sick_leave");

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className="font-bold">الإجازات المرضية ({sick.days} يوماً)</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 text-right">
              <th className="border px-3 py-2 font-semibold">الشريحة</th>
              <th className="border px-3 py-2 font-semibold">الأيام</th>
              <th className="border px-3 py-2 font-semibold">نسبة الأجر</th>
              <th className="border px-3 py-2 font-semibold text-left">المستحق</th>
              <th className="border px-3 py-2 font-semibold text-left">الخصم</th>
            </tr>
          </thead>
          <tbody>
            {sick.tiers.map((t, i) => (
              <tr key={i}>
                <td className="border px-3 py-2">{t.label}</td>
                <td className="border px-3 py-2 tabular-nums">{t.days}</td>
                <td className="border px-3 py-2 tabular-nums">{Math.round(t.rate * 100)}%</td>
                <td className="border px-3 py-2 text-left tabular-nums font-semibold">{f(t.amount)}</td>
                <td className="border px-3 py-2 text-left tabular-nums text-red-600">{f(t.deduction)}</td>
              </tr>
            ))}
            <tr className="bg-primary/5 font-bold">
              <td className="border px-3 py-2" colSpan={3}>الإجمالي</td>
              <td className="border px-3 py-2 text-left tabular-nums text-primary">{f(sick.paid_amount)}</td>
              <td className="border px-3 py-2 text-left tabular-nums text-red-600">{f(sick.deduction_amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        الأجر اليومي المعتمد: {f(sick.daily_rate)} — الأجر الكامل لو دُفعت جميع الأيام: {f(sick.full_pay_amount)}
      </p>

      <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 space-y-1">
        <p className="text-[11px] font-semibold text-primary">{legalCitation("sick_leave")}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{art.text}</p>
        <p className="text-xs leading-relaxed">{art.interpretation}</p>
      </div>
    </Card>
  );
}

