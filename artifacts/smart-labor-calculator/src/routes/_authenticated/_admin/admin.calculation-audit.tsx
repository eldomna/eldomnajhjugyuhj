import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApprovedLegalReferences, formatLegalReference, PENDING_REFERENCE_NOTICE } from "@/hooks/useLegalReferences";
import { formatCurrency, formatDateAr, formatServiceDuration, computeServiceDuration } from "@/lib/calculator";
import { ShieldCheck, FileSearch, ArrowRight, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/calculation-audit")({
  component: CalculationAuditPage,
});

type CalcRow = {
  id: string;
  user_id: string | null;
  employee_name: string | null;
  employer_name: string | null;
  monthly_salary: number;
  currency: string | null;
  service_start_date: string | null;
  service_end_date: string | null;
  service_years: number | null;
  service_months: number | null;
  day_overtime_hours: number;
  night_overtime_hours: number;
  unused_leave_days: number;
  daily_rate: number;
  hourly_rate: number;
  total_service_years: number;
  eos_benefit: number;
  day_overtime_amount: number;
  night_overtime_amount: number;
  leave_compensation: number;
  total_due: number;
  serial_number: string | null;
  created_at: string;
};

function CalculationAuditPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin", "calculation-audit", search],
    queryFn: async () => {
      let q = supabase
        .from("calculations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`employee_name.ilike.${s},employer_name.ilike.${s},serial_number.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CalcRow[];
    },
  });

  const selected = rows?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">تدقيق الحسابات</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-3">
          مراجعة شفافة لكل عملية احتساب: المعادلات المستخدمة، مصدر الراتب، العملة، المراجع القانونية، والتاريخ — دون الحاجة إلى مراجعة الكود البرمجي.
        </p>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم الموظف أو صاحب العمل أو الرقم التسلسلي..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </Card>

        <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40 text-sm font-semibold">
              الحسابات الأخيرة {rows ? `(${rows.length})` : ""}
            </div>
            <div className="max-h-[640px] overflow-auto divide-y">
              {isLoading && <div className="p-4 text-sm text-muted-foreground">جارٍ التحميل...</div>}
              {!isLoading && (rows?.length ?? 0) === 0 && (
                <div className="p-4 text-sm text-muted-foreground">لا توجد حسابات مطابقة.</div>
              )}
              {rows?.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-right px-4 py-3 hover:bg-muted/40 transition-colors ${
                    selectedId === r.id ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{r.employee_name || "—"}</span>
                    <Badge variant="outline" className="text-[10px]">{r.currency || "YER"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.employer_name || "—"}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between mt-1">
                    <span>{r.serial_number || `#${r.id.slice(0, 8)}`}</span>
                    <span>{new Date(r.created_at).toLocaleDateString("ar-EG")}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            {!selected ? (
              <Card className="p-10 text-center text-muted-foreground">
                <ArrowRight className="h-6 w-6 mx-auto mb-2 opacity-50" />
                اختر حساباً من القائمة لعرض تفاصيل التدقيق الكاملة.
              </Card>
            ) : (
              <AuditDetails calc={selected} />
            )}
          </div>
        </div>

        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          ← العودة إلى لوحة الإدارة
        </Link>
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-dashed last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium text-right ${mono ? "tabular-nums" : ""}`}>{value}</span>
    </div>
  );
}

function AuditDetails({ calc }: { calc: CalcRow }) {
  const cur = (calc.currency || "YER") as "YER" | "SAR" | "USD";
  const dur = computeServiceDuration(calc.service_start_date, calc.service_end_date);
  const fy = dur.fractional_years || Number(calc.total_service_years) || 0;
  const fmt = (n: number) => formatCurrency(n, cur);

  // Re-derive expected values from stored inputs to flag discrepancies.
  const expected = {
    daily_rate: Number(calc.monthly_salary) / 30,
    hourly_rate: Number(calc.monthly_salary) / 30 / 8,
    eos_benefit: Number(calc.monthly_salary) * fy,
    day_overtime_amount: Number(calc.day_overtime_hours) * (Number(calc.monthly_salary) / 30 / 8) * 1.5,
    night_overtime_amount: Number(calc.night_overtime_hours) * (Number(calc.monthly_salary) / 30 / 8) * 1.75,
    leave_compensation: Number(calc.unused_leave_days) * (Number(calc.monthly_salary) / 30),
  };

  const approxMatch = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(a) * 0.01);
  const integrity = [
    { key: "الأجر اليومي", stored: calc.daily_rate, expected: expected.daily_rate },
    { key: "الأجر بالساعة", stored: calc.hourly_rate, expected: expected.hourly_rate },
    { key: "مكافأة نهاية الخدمة", stored: calc.eos_benefit, expected: expected.eos_benefit },
    { key: "الإضافي النهاري", stored: calc.day_overtime_amount, expected: expected.day_overtime_amount },
    { key: "الإضافي الليلي", stored: calc.night_overtime_amount, expected: expected.night_overtime_amount },
  ];
  const allOk = integrity.every((i) => approxMatch(Number(i.stored), i.expected));

  return (
    <>
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold">{calc.employee_name || "—"}</h2>
            <p className="text-sm text-muted-foreground">صاحب العمل: {calc.employer_name || "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={allOk ? "default" : "destructive"} className="gap-1">
              {allOk ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {allOk ? "حالة الاعتماد: متطابق" : "تباين في الأرقام"}
            </Badge>
            <Badge variant="outline">{calc.serial_number || `#${calc.id.slice(0, 8)}`}</Badge>
          </div>
        </div>
      </Card>

      {/* Variables used */}
      <Card className="p-5">
        <h3 className="font-bold mb-3 text-sm">المتغيرات المستخدمة في الاحتساب</h3>
        <div className="grid sm:grid-cols-2 gap-x-6">
          <Row label="مصدر الراتب" value="آخر راتب فعلي قبل انتهاء الخدمة" />
          <Row label="آخر راتب شهري" value={fmt(Number(calc.monthly_salary))} mono />
          <Row label="عملة الراتب" value={cur} />
          <Row label="تاريخ بداية الخدمة" value={formatDateAr(calc.service_start_date)} />
          <Row label="تاريخ نهاية الخدمة" value={formatDateAr(calc.service_end_date)} />
          <Row
            label="مدة الخدمة"
            value={dur.total_days > 0 ? `${formatServiceDuration(dur)} (${dur.total_days} يوم)` : "—"}
          />
          <Row label="المدة الكسرية (سنوات)" value={fy.toFixed(4)} mono />
          <Row label="ساعات إضافية نهارية" value={`${calc.day_overtime_hours} ساعة`} mono />
          <Row label="ساعات إضافية ليلية" value={`${calc.night_overtime_hours} ساعة`} mono />
          <Row label="أيام إجازات غير مستخدمة" value={`${calc.unused_leave_days} يوم`} mono />
        </div>
      </Card>

      {/* Formulas + integrity */}
      <Card className="p-5">
        <h3 className="font-bold mb-3 text-sm">المعادلات وخطوات الاحتساب</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-right p-2 font-semibold">البند</th>
                <th className="text-right p-2 font-semibold">المعادلة</th>
                <th className="text-left p-2 font-semibold">المخزّن</th>
                <th className="text-left p-2 font-semibold">المتوقّع</th>
                <th className="text-center p-2 font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { k: "الأجر اليومي", f: "الراتب ÷ 30", s: calc.daily_rate, e: expected.daily_rate },
                { k: "الأجر بالساعة", f: "الأجر اليومي ÷ 8", s: calc.hourly_rate, e: expected.hourly_rate },
                { k: "مكافأة نهاية الخدمة", f: `الراتب × ${fy.toFixed(4)}`, s: calc.eos_benefit, e: expected.eos_benefit },
                { k: "الإضافي النهاري", f: "الساعات × الأجر/ساعة × 1.5", s: calc.day_overtime_amount, e: expected.day_overtime_amount },
                { k: "الإضافي الليلي", f: "الساعات × الأجر/ساعة × 1.75", s: calc.night_overtime_amount, e: expected.night_overtime_amount },
                { k: "بدل الإجازات (تقديري)", f: "الأيام × الأجر اليومي", s: calc.leave_compensation, e: expected.leave_compensation },
              ].map((r) => {
                const ok = approxMatch(Number(r.s), r.e);
                return (
                  <tr key={r.k}>
                    <td className="p-2 font-medium">{r.k}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.f}</td>
                    <td className="p-2 text-left tabular-nums">{fmt(Number(r.s))}</td>
                    <td className="p-2 text-left tabular-nums text-muted-foreground">{fmt(r.e)}</td>
                    <td className="p-2 text-center">
                      {ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive inline" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
          إجمالي الحقوق المضمونة = نهاية الخدمة + الإضافي النهاري + الإضافي الليلي = <strong className="tabular-nums">{fmt(Number(calc.total_due))}</strong>.
          بدل الإجازات وتعويض الفصل التعسفي تقديرات قضائية لا تدخل ضمن الإجمالي.
        </div>
      </Card>

      {/* Metadata */}
      <Card className="p-5">
        <h3 className="font-bold mb-3 text-sm">بيانات السجل</h3>
        <div className="grid sm:grid-cols-2 gap-x-6">
          <Row label="رقم التسلسل" value={calc.serial_number || "—"} />
          <Row label="معرّف الحساب" value={<code className="text-xs">{calc.id}</code>} />
          <Row label="معرّف المستخدم" value={<code className="text-xs">{calc.user_id || "—"}</code>} />
          <Row label="تاريخ آخر تعديل / الإصدار" value={new Date(calc.created_at).toLocaleString("ar-EG")} />
        </div>
      </Card>

      {/* Legal references */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-bold text-sm">المراجع القانونية المعتمدة</h3>
        </div>
        <LegalRefs />
        <p className="mt-3 text-[11px] text-muted-foreground">
          المراجع المعتمدة فقط (حالة الاعتماد = approved) تُستخدم وتُعرض. المواد غير المعتمدة تظهر للمستخدمين كمراجع قيد المراجعة.
        </p>
      </Card>

      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/legal-references">إدارة المراجع القانونية</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/audit">سجل التدقيق العام</Link>
        </Button>
      </div>
    </>
  );
}

function LegalRefs() {
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
    <ul className="space-y-1.5 text-sm list-disc pr-5">
      {data.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-2">
          <span>{formatLegalReference(r)}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {r.approval_status === "approved" ? "معتمد" : r.approval_status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
