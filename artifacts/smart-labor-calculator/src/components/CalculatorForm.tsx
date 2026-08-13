import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  calculate,
  type CalculatorInput,
  type Currency,
  CURRENCIES,
  currencySuffix,
  computeServiceDuration,
  formatServiceDuration,
  parseDateOnly,
  toDateOnlyString,
  formatDateAr,
} from "@/lib/calculator";
import { useCalculatorStore } from "@/store/calculator";
import { Calculator, CalendarIcon, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULTS: CalculatorInput = {
  employee_name: "",
  employer_name: "",
  monthly_salary: 0,
  currency: "YER",
  service_start_date: "",
  service_end_date: "",
  day_overtime_hours: 0,
  night_overtime_hours: 0,
  unused_leave_days: 0,
  unfair_dismissal: false,
};

interface Props {
  onComputed?: () => void;
}

export function CalculatorForm({ onComputed }: Props) {
  const setLast = useCalculatorStore((s) => s.setLast);
  const [form, setForm] = useState<CalculatorInput>(DEFAULTS);

  const upd = <K extends keyof CalculatorInput>(k: K, v: CalculatorInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const duration = useMemo(
    () => computeServiceDuration(form.service_start_date, form.service_end_date),
    [form.service_start_date, form.service_end_date],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_name.trim() || !form.employer_name.trim()) {
      toast.error("الرجاء إدخال اسم الموظف وصاحب العمل");
      return;
    }
    if (form.monthly_salary <= 0) {
      toast.error("الرجاء إدخال راتب شهري صحيح");
      return;
    }
    if (!form.service_start_date || !form.service_end_date) {
      toast.error("الرجاء تحديد تاريخ بداية ونهاية الخدمة");
      return;
    }
    if (duration.total_days <= 0) {
      toast.error("تاريخ نهاية الخدمة يجب أن يكون بعد تاريخ البداية");
      return;
    }
    const r = calculate(form);
    setLast(form, r);
    toast.success("تم احتساب الحقوق");
    onComputed?.();
  };

  const num = (k: keyof CalculatorInput, label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input
        id={k}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={(form[k] as number) || ""}
        onChange={(e) => upd(k, (e.target.value === "" ? 0 : Number(e.target.value)) as never)}
        placeholder="0"
        dir="ltr"
        className="text-left"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  const dateField = (
    id: "service_start_date" | "service_end_date",
    label: string,
  ) => {
    const selected = parseDateOnly(form[id]) ?? undefined;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-right font-normal",
                !selected && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="ms-0 me-2 h-4 w-4" />
              {selected ? formatDateAr(selected) : <span>اختر التاريخ</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => upd(id, toDateOnlyString(d ?? null))}
              captionLayout="dropdown"
              fromYear={1970}
              toYear={new Date().getFullYear() + 1}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <Card className="p-5 sm:p-7 card-elev">
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Calculator className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">بيانات الحساب</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="employee_name">اسم الموظف</Label>
            <Input id="employee_name" value={form.employee_name}
              onChange={(e) => upd("employee_name", e.target.value)} placeholder="مثلاً: علي محمد" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employer_name">اسم صاحب العمل</Label>
            <Input id="employer_name" value={form.employer_name}
              onChange={(e) => upd("employer_name", e.target.value)} placeholder="اسم الشركة أو المنشأة" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="currency">عملة الراتب</Label>
            <Select value={form.currency} onValueChange={(v) => upd("currency", v as Currency)}>
              <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              لا يتم تحويل العملات تلقائياً. تُحتسب جميع المستحقات بنفس عملة آخر راتب.
            </p>
          </div>
          {num("monthly_salary", `آخر راتب شهري فعلي قبل انتهاء الخدمة (${currencySuffix(form.currency)})`, "يُستخدم وحده لاحتساب مكافأة نهاية الخدمة")}
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" /> مدة الخدمة
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {dateField("service_start_date", "تاريخ بداية العمل")}
            {dateField("service_end_date", "تاريخ نهاية الخدمة")}
          </div>
          <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
            <p className="font-semibold mb-0.5">مدة الخدمة المحسوبة تلقائياً</p>
            <p className="tabular-nums">
              {duration.total_days > 0
                ? `${formatServiceDuration(duration)} (${duration.years} سنة • ${duration.months} شهر • ${duration.days} يوم — إجمالي ${duration.total_days} يوم)`
                : "حدد تاريخي البداية والنهاية لاحتساب المدة"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {num("unused_leave_days", "أيام الإجازات غير المستخدمة", "تقدير معلوماتي — لا يدخل ضمن الإجمالي")}
          {num("day_overtime_hours", "ساعات إضافية نهارية", "150% من الأجر")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {num("night_overtime_hours", "ساعات إضافية ليلية", "175% من الأجر")}
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-start gap-3">
            <input
              id="unfair_dismissal"
              type="checkbox"
              checked={form.unfair_dismissal}
              onChange={(e) => upd("unfair_dismissal", e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <div className="space-y-1">
              <Label htmlFor="unfair_dismissal" className="cursor-pointer font-semibold">
                فصل تعسفي
              </Label>
              <p className="text-xs text-muted-foreground">
                عند التحديد، يُعرض الحد الأقصى للتعويض المحتمل (آخر راتب × 6) كتقدير قضائي فقط — لا يُضاف إلى إجمالي المستحقات.
              </p>
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg">
          احتساب الحقوق
        </Button>
      </form>
    </Card>
  );
}
