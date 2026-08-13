import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, type Currency, type CalculatorInput, calculate, computeServiceDuration, computeLimitation } from "@/lib/calculator";
import { generateReportPDF } from "@/lib/pdf";
import { Trash2, Download, Search, Eye, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type CalcRow = {
  eos_benefit: number | string;
  day_overtime_amount: number | string;
  night_overtime_amount: number | string;
  leave_compensation: number | string;
  total_due: number | string;
};

type CalendarType = "gregorian" | "hijri";

/** عرض التاريخ حسب نوع التقويم المختار (ميلادي أو هجري) بأرقام إنجليزية. */
function formatDate(value: string | Date, cal: CalendarType, withTime = false) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  };
  const locale = cal === "hijri" ? "en-GB-u-ca-islamic-umalqura-nu-latn" : "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, opts).format(d) + (cal === "hijri" ? " هـ" : "");
  } catch {
    return new Intl.DateTimeFormat("en-GB", opts).format(d);
  }
}

/** بنود الحقوق المعروضة في تفاصيل الحساب المحفوظ. */
function rightsRows(c: CalcRow) {
  return [
    { label: "مكافأة نهاية الخدمة", value: Number(c.eos_benefit) },
    { label: "العمل الإضافي النهاري", value: Number(c.day_overtime_amount) },
    { label: "العمل الإضافي الليلي", value: Number(c.night_overtime_amount) },
    { label: "بدل الإجازات", value: Number(c.leave_compensation) },
    { label: "الإجمالي", value: Number(c.total_due) },
  ];
}

export const Route = createFileRoute("/_authenticated/calculations")({
  head: () => ({ meta: [{ title: "سجل الحسابات • حقوق العمال" }] }),
  component: Calcs,
});

function Calcs() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [cal, setCal] = useState<CalendarType>("gregorian");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [employer, setEmployer] = useState("all");
  const [currency, setCurrency] = useState("all");


  const { data, isLoading } = useQuery({
    queryKey: ["calculations"],
    queryFn: async () => {
      const { data } = await supabase.from("calculations").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const rows = useMemo(() => data ?? [], [data]);

  // قوائم جهات العمل والعملات المتاحة فعلياً داخل حسابات المستخدم.
  const employers = useMemo(
    () => Array.from(new Set(rows.map((c) => c.employer_name).filter(Boolean))).sort(),
    [rows],
  );
  const currencies = useMemo(
    () => Array.from(new Set(rows.map((c) => c.currency ?? "YER"))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const needle = q.trim();
    return rows.filter((c) => {
      if (needle && !c.employee_name.includes(needle) && !c.employer_name.includes(needle)) return false;
      if (employer !== "all" && c.employer_name !== employer) return false;
      if (currency !== "all" && (c.currency ?? "YER") !== currency) return false;
      const ts = new Date(c.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }, [rows, q, employer, currency, from, to]);

  const hasFilters = Boolean(q || from || to || employer !== "all" || currency !== "all");
  const clearFilters = () => {
    setQ(""); setFrom(""); setTo(""); setEmployer("all"); setCurrency("all");
  };


  const del = async (id: string) => {
    if (!confirm("حذف هذا الحساب؟")) return;
    const { error } = await supabase.from("calculations").delete().eq("id", id);
    if (error) return toast.error("فشل الحذف");
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["calculations"] });
    qc.invalidateQueries({ queryKey: ["calc-recent"] });
    qc.invalidateQueries({ queryKey: ["calc-count"] });
  };

  const dl = async (c: typeof filtered[number]) => {
    const { data: settings } = await supabase.from("platform_settings").select("platform_name, logo_url").eq("id", 1).maybeSingle();

    // إذا كانت اللقطة الكاملة للتقرير محفوظة نستخدمها كما هي لإصدار نفس التقرير.
    const snap = c.payload as unknown as { input?: CalculatorInput; result?: Record<string, unknown> } | null;
    if (snap?.input && snap?.result) {
      await generateReportPDF(
        snap.input,
        snap.result as never,
        {
          platformName: settings?.platform_name || "حاسبة العمال الذكية",
          logoUrl: settings?.logo_url ?? null,
        },
        {
          serial: c.serial_number || `RPT-${c.id.slice(0, 8).toUpperCase()}`,
          issuedAt: new Date(c.created_at),
        },
      );
      return;
    }

    // الصفوف القديمة بدون لقطة: نعيد بناء المدخلات من الأعمدة المحفوظة.

    let start = c.service_start_date as string | null;
    let end = c.service_end_date as string | null;
    if (!start || !end) {
      const endDate = new Date(c.created_at);
      const totalMonths = (c.service_years || 0) * 12 + (c.service_months || 0);
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - totalMonths);
      start = startDate.toISOString().slice(0, 10);
      end = endDate.toISOString().slice(0, 10);
    }
    const input: CalculatorInput = {
      employee_name: c.employee_name,
      employer_name: c.employer_name,
      monthly_salary: Number(c.monthly_salary),
      currency: (c.currency ?? "YER") as Currency,
      service_start_date: start,
      service_end_date: end,
      day_overtime_hours: Number(c.day_overtime_hours),
      night_overtime_hours: Number(c.night_overtime_hours),
      unused_leave_days: Number(c.unused_leave_days),
      unfair_dismissal: false,
    };
    const dur = computeServiceDuration(start, end);
    const result = {
      ...dur,
      daily_rate: Number(c.daily_rate),
      hourly_rate: Number(c.hourly_rate),
      historical_daily_rate: Number(c.daily_rate),
      historical_hourly_rate: Number(c.hourly_rate),
      female_rights: null,
      sick_leave: null,
      limitation: computeLimitation({ employment_status: "ended", service_end_date: end }),

      total_service_years: Number(c.total_service_years),

      eos_benefit: Number(c.eos_benefit),
      day_overtime_amount: Number(c.day_overtime_amount),
      night_overtime_amount: Number(c.night_overtime_amount),
      leave_compensation: Number(c.leave_compensation),
      friday_compensation: 0,
      notice_indemnity: 0,
      eosb_advance_deduction: 0,
      unfair_dismissal_compensation: 0,
      holiday_compensation: 0,
      legal_notes: [],
      total_due: Number(c.total_due),
    };
    void calculate; // keep import live in case row is missing data
    await generateReportPDF(
      input,
      result,
      {
        platformName: settings?.platform_name || "حاسبة العمال الذكية",
        logoUrl: settings?.logo_url ?? null,
      },
      {
        serial: c.serial_number || `RPT-${c.id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date(c.created_at),
      },
    );
  };


  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">سجل الحسابات</h1>
            <p className="text-sm text-muted-foreground">جميع الحسابات المحفوظة في حسابك.</p>
          </div>
          <Button asChild><Link to="/calculator">حساب جديد</Link></Button>
        </div>

        <Card className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم العامل أو جهة العمل..." className="pr-10" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">من تاريخ</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">إلى تاريخ</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">نوع التقويم</Label>
              <Select value={cal} onValueChange={(v) => setCal(v as CalendarType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gregorian">ميلادي</SelectItem>
                  <SelectItem value="hijri">هجري</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">جهة العمل</Label>
              <Select value={employer} onValueChange={setEmployer}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {employers.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">العملة</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>النتائج: <span className="tabular-nums text-foreground font-medium">{filtered.length}</span> من {rows.length}</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="gap-1 h-8" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> مسح التصفية
              </Button>
            )}
          </div>
        </Card>


        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">لا توجد نتائج.</Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{c.employee_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.employer_name} • <span dir="ltr">{formatDate(c.created_at, cal, true)}</span>
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">الإجمالي</p>
                    <p className="font-bold text-primary tabular-nums">{formatCurrency(Number(c.total_due), c.currency ?? "YER")}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="icon" variant="outline" onClick={() => setOpenId(openId === c.id ? null : c.id)} aria-label="تفاصيل">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => dl(c)}>
                      <Download className="h-4 w-4" /> تنزيل PDF
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => del(c.id)} aria-label="حذف"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>

                {openId === c.id && (
                  <div className="mt-4 border-t pt-3 text-sm space-y-3">
                    <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>العامل: <span className="text-foreground font-medium">{c.employee_name || "—"}</span></div>
                      <div>جهة العمل: <span className="text-foreground font-medium">{c.employer_name || "—"}</span></div>
                      <div>الراتب الشهري: <span className="text-foreground font-medium tabular-nums">{formatCurrency(Number(c.monthly_salary), c.currency ?? "YER")}</span></div>
                      <div>مدة الخدمة: <span className="text-foreground font-medium tabular-nums">{c.service_years} سنة و {c.service_months} شهر</span></div>
                      {c.service_start_date && (
                        <div>
                          فترة الخدمة:{" "}
                          <span className="text-foreground font-medium" dir="ltr">
                            {formatDate(c.service_start_date, cal)} — {c.service_end_date ? formatDate(c.service_end_date, cal) : "—"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2">
                      {rightsRows(c).map((r) => (
                        <div key={r.label} className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-1.5">
                          <span className="text-xs text-muted-foreground">{r.label}</span>
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.value, c.currency ?? "YER")}</span>
                        </div>
                      ))}
                    </div>
                    {!c.payload && (
                      <p className="text-[11px] text-muted-foreground">
                        هذا الحساب محفوظ قبل تفعيل حفظ التقرير الكامل، لذا يُعاد بناء التقرير من البيانات المخزنة.
                      </p>
                    )}
                  </div>
                )}
              </Card>

            ))}
          </div>
        )}
      </main>
    </div>
  );
}
