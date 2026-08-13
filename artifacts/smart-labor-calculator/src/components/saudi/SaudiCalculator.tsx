import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Lock, Calculator, Plus, Trash2, Sparkles, AlertTriangle } from "lucide-react";
import { computeSaudiCaseFn } from "@/lib/saudi/calc.functions";
import type { SaCaseInput, SaComputeResponse, SaFullResult } from "@/lib/saudi/types";
import { SECTORS } from "@/lib/saudi/types";
import { SaReportExportButton } from "@/components/saudi/SaReportExportButton";
import { useEntitlements } from "@/lib/useEntitlements";

const money = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

const emptyInput: SaCaseInput = {
  nationality: "saudi",
  jobTitle: "",
  sector: SECTORS[0],
  startDate: "",
  endDate: "",
  employeeName: "",
  employerName: "",
  includeNamesInReport: true,
  contractType: "indefinite",
  contractTermEnd: null,
  renewals: 0,
  paidMonthly: true,
  hasProbation: false,
  probationDays: 0,
  probationWritten: false,
  endedDuringProbation: false,
  wage: { basic: 0, housing: 0, transport: 0, otherFixed: 0 },
  dailyHours: 8,
  workDaysPerWeek: 6,
  ramadanApplies: false,
  ramadanDailyHours: 6,
  overtimeHours: 0,
  holidayWork: [],
  unpaidWages: [],
  annualLeaveEntitledDays: null,
  annualLeaveUsedDays: 0,
  sickLeaveDays: 0,
  gender: "male",
  female: {
    birthDate: null,
    maternityStart: null,
    maternityEnd: null,
    maternityPaid: false,
    nursingClaimed: false,
    nursingMonths: 0,
    terminatedDuringMaternity: false,
  },
  gosiSubscribed: false,
  gosiMonths: 0,
  gosiSubjectWageOverride: null,
  terminationReason: "employer_termination",
  terminationNoticeDate: null,
  noticeGiven: false,
  noticeDaysGiven: 0,
  resignation: {
    submittedDate: null,
    effectiveDate: null,
    written: false,
    acceptance: "none",
    qiwaSubmitted: false,
  },
  settlements: [],
  dispute: { exists: false, amount: 0, coveredKeys: [], note: "" },
};


function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{n}</span>
        <h3 className="font-bold">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function NumField({ label, value, onChange, min = 0 }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        dir="ltr"
        min={min}
        value={value === null || value === 0 ? (value === 0 ? "0" : "") : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </div>
  );
}

const COVERABLE: { key: string; label: string }[] = [
  { key: "eosb", label: "مكافأة نهاية الخدمة" },
  { key: "notice", label: "بدل مهلة الإشعار" },
  { key: "annual_leave", label: "رصيد الإجازات" },
  { key: "overtime", label: "الساعات الإضافية" },
  { key: "unpaid_wages", label: "الأجور المتأخرة" },
  { key: "holiday_work", label: "العمل في الإجازات" },
  { key: "sick_leave", label: "الإجازة المرضية" },
  { key: "maternity_leave", label: "إجازة الأمومة" },
  { key: "nursing_hour", label: "ساعة الرضاعة" },
];

export function SaudiCalculator() {
  const { ent } = useEntitlements();
  const [inp, setInp] = useState<SaCaseInput>(emptyInput);
  const [res, setRes] = useState<SaComputeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const compute = useServerFn(computeSaudiCaseFn);

  const set = <K extends keyof SaCaseInput>(k: K, v: SaCaseInput[K]) => setInp((s) => ({ ...s, [k]: v }));
  const setF = <K extends keyof SaCaseInput["female"]>(k: K, v: SaCaseInput["female"][K]) =>
    setInp((s) => ({ ...s, female: { ...s.female, [k]: v } }));
  const setR = <K extends keyof SaCaseInput["resignation"]>(k: K, v: SaCaseInput["resignation"][K]) =>
    setInp((s) => ({ ...s, resignation: { ...s.resignation, [k]: v } }));


  const submit = async () => {
    if (!inp.jobTitle.trim() || !inp.startDate || !inp.endDate) {
      toast.error("أكمل البيانات الإلزامية: المسمى الوظيفي وتاريخ المباشرة وتاريخ الانتهاء.");
      return;
    }
    setBusy(true);
    try {
      const clean: SaCaseInput = {
        ...inp,
        renewals: Number(inp.renewals) || 0,
        probationDays: Number(inp.probationDays) || 0,
        overtimeHours: Number(inp.overtimeHours) || 0,
        annualLeaveUsedDays: Number(inp.annualLeaveUsedDays) || 0,
        sickLeaveDays: Number(inp.sickLeaveDays) || 0,
        noticeDaysGiven: Number(inp.noticeDaysGiven) || 0,
        dailyHours: inp.dailyHours ?? 8,
        workDaysPerWeek: inp.workDaysPerWeek ?? 6,
        ramadanDailyHours: inp.ramadanDailyHours ?? 6,
        wage: {
          basic: Number(inp.wage.basic) || 0,
          housing: Number(inp.wage.housing) || 0,
          transport: Number(inp.wage.transport) || 0,
          otherFixed: Number(inp.wage.otherFixed) || 0,
        },
      };
      const out = (await compute({ data: { input: clean, save: true } })) as SaComputeResponse;
      setRes(out);
      toast.success("تم تنفيذ الحساب");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر تنفيذ الحساب");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <Step n={1} title="البيانات الأساسية للقضية">
          <div className="space-y-1.5">
            <Label className="text-xs">الجنسية</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={inp.nationality} onChange={(e) => set("nationality", e.target.value as any)}>
              <option value="saudi">سعودي</option>
              <option value="non_saudi">غير سعودي</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">المسمى الوظيفي</Label>
            <Input value={inp.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">القطاع</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={inp.sector} onChange={(e) => set("sector", e.target.value)}>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div />
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ مباشرة العمل</Label>
            <Input type="date" dir="ltr" value={inp.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ انتهاء العلاقة</Label>
            <Input type="date" dir="ltr" value={inp.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">اسم العامل (اختياري — للتقرير فقط)</Label>
            <Input value={inp.employeeName} onChange={(e) => set("employeeName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">اسم المنشأة (اختياري — للتقرير فقط)</Label>
            <Input value={inp.employerName} onChange={(e) => set("employerName", e.target.value)} />
          </div>
        </Step>

        <Step n={2} title="تحليل العقد">
          <div className="space-y-1.5">
            <Label className="text-xs">نوع العقد</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={inp.contractType} onChange={(e) => set("contractType", e.target.value as any)}>
              <option value="indefinite">غير محدد المدة</option>
              <option value="fixed">محدد المدة</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ نهاية مدة العقد (للعقد محدد المدة)</Label>
            <Input type="date" dir="ltr" value={inp.contractTermEnd ?? ""} onChange={(e) => set("contractTermEnd", e.target.value || null)} />
          </div>
          <NumField label="عدد مرات التجديد" value={inp.renewals} onChange={(v) => set("renewals", (v ?? 0) as any)} />
          <label className="flex items-center gap-2 text-sm mt-6">
            <Checkbox checked={inp.paidMonthly} onCheckedChange={(v) => set("paidMonthly", !!v)} /> الأجر يُصرف شهرياً
          </label>
        </Step>

        <Step n={3} title="فترة التجربة">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={inp.hasProbation} onCheckedChange={(v) => set("hasProbation", !!v)} /> يوجد شرط فترة تجربة
          </label>
          <NumField label="مدة فترة التجربة (يوم)" value={inp.probationDays} onChange={(v) => set("probationDays", (v ?? 0) as any)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={inp.probationWritten} onCheckedChange={(v) => set("probationWritten", !!v)} /> يوجد اتفاق كتابي على التمديد
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={inp.endedDuringProbation} onCheckedChange={(v) => set("endedDuringProbation", !!v)} /> انتهت العلاقة أثناء فترة التجربة
          </label>
        </Step>

        <Step n={4} title="تحليل الأجور والرواتب">
          <NumField label="الراتب الأساسي" value={inp.wage.basic} onChange={(v) => set("wage", { ...inp.wage, basic: v ?? 0 })} />
          <NumField label="بدل السكن" value={inp.wage.housing} onChange={(v) => set("wage", { ...inp.wage, housing: v ?? 0 })} />
          <NumField label="بدل النقل" value={inp.wage.transport} onChange={(v) => set("wage", { ...inp.wage, transport: v ?? 0 })} />
          <NumField label="بدلات ثابتة أخرى" value={inp.wage.otherFixed} onChange={(v) => set("wage", { ...inp.wage, otherFixed: v ?? 0 })} />
        </Step>

        <Step n={5} title="ساعات العمل وسياق رمضان">
          <NumField label="ساعات العمل اليومية" value={inp.dailyHours} onChange={(v) => set("dailyHours", v)} />
          <NumField label="أيام العمل في الأسبوع" value={inp.workDaysPerWeek} onChange={(v) => set("workDaysPerWeek", v)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={inp.ramadanApplies} onCheckedChange={(v) => set("ramadanApplies", !!v)} /> تنطبق ساعات رمضان النظامية
          </label>
          <NumField label="ساعات العمل في رمضان" value={inp.ramadanDailyHours} onChange={(v) => set("ramadanDailyHours", v)} />
        </Step>

        <Step n={6} title="الساعات الإضافية">
          <NumField label="إجمالي الساعات الإضافية" value={inp.overtimeHours} onChange={(v) => set("overtimeHours", (v ?? 0) as any)} />
          <p className="text-xs text-muted-foreground self-end">تُحتسب بالنسبة المعتمدة في لوحة التحكم.</p>
        </Step>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">7</span>
            <h3 className="font-bold">العمل خلال الإجازات الرسمية</h3>
          </div>
          <div className="space-y-2">
            {inp.holidayWork.map((h, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input type="date" dir="ltr" value={h.date}
                  onChange={(e) => set("holidayWork", inp.holidayWork.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                <Input type="number" dir="ltr" placeholder="عدد الساعات" value={h.hours || ""}
                  onChange={(e) => set("holidayWork", inp.holidayWork.map((x, j) => j === i ? { ...x, hours: Number(e.target.value) || 0 } : x))} />
                <Button variant="ghost" size="icon" onClick={() => set("holidayWork", inp.holidayWork.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => set("holidayWork", [...inp.holidayWork, { date: "", hours: 0 }])}>
              <Plus className="h-3.5 w-3.5" /> إضافة يوم إجازة
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">8</span>
            <h3 className="font-bold">الرواتب والأجور المتأخرة</h3>
          </div>
          <div className="space-y-2">
            {inp.unpaidWages.map((u, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input placeholder="البيان" value={u.label}
                  onChange={(e) => set("unpaidWages", inp.unpaidWages.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <Input type="number" dir="ltr" placeholder="المبلغ" value={u.amount || ""}
                  onChange={(e) => set("unpaidWages", inp.unpaidWages.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} />
                <Input type="date" dir="ltr" value={u.dueDate}
                  onChange={(e) => set("unpaidWages", inp.unpaidWages.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x))} />
                <Button variant="ghost" size="icon" onClick={() => set("unpaidWages", inp.unpaidWages.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => set("unpaidWages", [...inp.unpaidWages, { label: "", amount: 0, dueDate: "", paid: false }])}>
              <Plus className="h-3.5 w-3.5" /> إضافة مستحق غير مسدد
            </Button>
          </div>
        </Card>

        <Step n={9} title="رصيد الإجازات السنوية">
          <NumField label="أيام الإجازة المستحقة (اتركه فارغاً للاحتساب التلقائي)" value={inp.annualLeaveEntitledDays} onChange={(v) => set("annualLeaveEntitledDays", v)} />
          <NumField label="أيام الإجازة المستخدمة" value={inp.annualLeaveUsedDays} onChange={(v) => set("annualLeaveUsedDays", (v ?? 0) as any)} />
        </Step>

        <Step n={10} title="الإجازة المرضية">
          <NumField label="أيام الإجازة المرضية المعتمدة طبياً" value={inp.sickLeaveDays} onChange={(v) => set("sickLeaveDays", (v ?? 0) as any)} />
          <p className="text-xs text-muted-foreground self-end">تُطبَّق شرائح الأجر المعتمدة في لوحة التحكم.</p>
        </Step>

        <Step n={12} title="جنس العامل وحقوق العاملات">
          <div className="space-y-1.5">
            <Label className="text-xs">الجنس</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={inp.gender} onChange={(e) => set("gender", e.target.value as any)}>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>
          <div />
          {inp.gender === "female" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">تاريخ الولادة</Label>
                <Input type="date" dir="ltr" value={inp.female.birthDate ?? ""} onChange={(e) => setF("birthDate", e.target.value || null)} />
              </div>
              <div />
              <div className="space-y-1.5">
                <Label className="text-xs">بداية إجازة الأمومة</Label>
                <Input type="date" dir="ltr" value={inp.female.maternityStart ?? ""} onChange={(e) => setF("maternityStart", e.target.value || null)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نهاية إجازة الأمومة</Label>
                <Input type="date" dir="ltr" value={inp.female.maternityEnd ?? ""} onChange={(e) => setF("maternityEnd", e.target.value || null)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={inp.female.maternityPaid} onCheckedChange={(v) => setF("maternityPaid", !!v)} /> تم صرف أجر إجازة الأمومة
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={inp.female.terminatedDuringMaternity} onCheckedChange={(v) => setF("terminatedDuringMaternity", !!v)} /> تم الإنهاء خلال فترة الحماية
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={inp.female.nursingClaimed} onCheckedChange={(v) => setF("nursingClaimed", !!v)} /> المطالبة بمقابل ساعة الرضاعة
              </label>
              <NumField label="عدد أشهر الرضاعة المطالب بها" value={inp.female.nursingMonths} onChange={(v) => setF("nursingMonths", v ?? 0)} />
            </>
          )}
        </Step>

        <Step n={13} title="التأمينات الاجتماعية">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={inp.gosiSubscribed} onCheckedChange={(v) => set("gosiSubscribed", !!v)} /> العامل مشترك في التأمينات
          </label>
          <NumField label="عدد أشهر الاشتراك محل المطالبة" value={inp.gosiMonths} onChange={(v) => set("gosiMonths", (v ?? 0) as any)} />
          <NumField label="الأجر الخاضع للاشتراك (اتركه فارغاً للاحتساب التلقائي)" value={inp.gosiSubjectWageOverride} onChange={(v) => set("gosiSubjectWageOverride", v)} />
          <p className="text-xs text-muted-foreground self-end">تُطبَّق النسب النظامية المعتمدة حسب الجنسية.</p>
        </Step>

        <Step n={14} title="سبب انتهاء العلاقة العمالية">
          <div className="space-y-1.5">
            <Label className="text-xs">سبب انتهاء العلاقة</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={inp.terminationReason} onChange={(e) => set("terminationReason", e.target.value as any)}>
              <option value="employer_termination">إنهاء من صاحب العمل</option>
              <option value="unlawful_termination">فصل غير مشروع</option>
              <option value="resignation">استقالة</option>
              <option value="mutual">اتفاق الطرفين</option>
              <option value="contract_expiry">انتهاء مدة العقد</option>
              <option value="during_probation">إنهاء أثناء فترة التجربة</option>
            </select>
          </div>
          <div />
          {inp.terminationReason === "resignation" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">تاريخ تقديم الاستقالة</Label>
                <Input type="date" dir="ltr" value={inp.resignation.submittedDate ?? ""} onChange={(e) => setR("submittedDate", e.target.value || null)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">تاريخ سريان الاستقالة</Label>
                <Input type="date" dir="ltr" value={inp.resignation.effectiveDate ?? ""} onChange={(e) => setR("effectiveDate", e.target.value || null)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">موقف صاحب العمل</Label>
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={inp.resignation.acceptance} onChange={(e) => setR("acceptance", e.target.value as any)}>
                  <option value="none">لا يوجد رد موثق</option>
                  <option value="accepted">قبول صريح</option>
                  <option value="rejected">رفض صريح</option>
                </select>
              </div>
              <div className="space-y-2 pt-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={inp.resignation.written} onCheckedChange={(v) => setR("written", !!v)} /> الاستقالة مقدمة كتابةً
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={inp.resignation.qiwaSubmitted} onCheckedChange={(v) => setR("qiwaSubmitted", !!v)} /> موثقة عبر المنصة الحكومية
                </label>
              </div>
            </>
          )}
        </Step>

        <Step n={17} title="مهلة الإشعار">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={inp.noticeGiven} onCheckedChange={(v) => set("noticeGiven", !!v)} /> تم منح مهلة إشعار
          </label>
          <NumField label="عدد أيام الإشعار الممنوحة" value={inp.noticeDaysGiven} onChange={(v) => set("noticeDaysGiven", (v ?? 0) as any)} />
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ الإشعار (اختياري)</Label>
            <Input type="date" dir="ltr" value={inp.terminationNoticeDate ?? ""} onChange={(e) => set("terminationNoticeDate", e.target.value || null)} />
          </div>
        </Step>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">18</span>
            <h3 className="font-bold">المخالصات المالية</h3>
          </div>
          <div className="space-y-2">
            {inp.settlements.map((st, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-center">
                <Input type="date" dir="ltr" value={st.date}
                  onChange={(e) => set("settlements", inp.settlements.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                <Input type="number" dir="ltr" placeholder="المبلغ" value={st.amount || ""}
                  onChange={(e) => set("settlements", inp.settlements.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} />
                <select className="h-10 rounded-md border bg-background px-2 text-sm" value={st.method}
                  onChange={(e) => set("settlements", inp.settlements.map((x, j) => j === i ? { ...x, method: e.target.value as any } : x))}>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="signed_release">مخالصة موقّعة</option>
                  <option value="e_document">مستند إلكتروني</option>
                  <option value="receipt">إيصال</option>
                  <option value="cash">نقداً</option>
                  <option value="other">أخرى</option>
                </select>
                <Button variant="ghost" size="icon" onClick={() => set("settlements", inp.settlements.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <label className="flex items-center gap-2 text-xs sm:col-span-4">
                  <Checkbox checked={st.hasDocuments}
                    onCheckedChange={(v) => set("settlements", inp.settlements.map((x, j) => j === i ? { ...x, hasDocuments: !!v } : x))} /> يوجد مستند مؤيد
                </label>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => set("settlements", [...inp.settlements, { date: "", amount: 0, kind: "مخالصة", method: "bank_transfer", hasDocuments: false }])}>
              <Plus className="h-3.5 w-3.5" /> إضافة مخالصة
            </Button>
          </div>
        </Card>

        <Step n={19} title="التسوية الودية">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={inp.dispute.exists} onCheckedChange={(v) => set("dispute", { ...inp.dispute, exists: !!v })} /> توجد تسوية ودية
          </label>
          <NumField label="قيمة التسوية" value={inp.dispute.amount} onChange={(v) => set("dispute", { ...inp.dispute, amount: v ?? 0 })} />
          {inp.dispute.exists && (
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">البنود المشمولة بالتسوية</Label>
              <div className="flex flex-wrap gap-3">
                {COVERABLE.map((c) => (
                  <label key={c.key} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={inp.dispute.coveredKeys.includes(c.key)}
                      onCheckedChange={(v) =>
                        set("dispute", {
                          ...inp.dispute,
                          coveredKeys: v
                            ? [...inp.dispute.coveredKeys, c.key]
                            : inp.dispute.coveredKeys.filter((k) => k !== c.key),
                        })
                      }
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </Step>


        <Button size="lg" className="w-full gap-2" disabled={busy} onClick={submit}>
          <Calculator className="h-4 w-4" /> {busy ? "جارٍ الحساب..." : "احسب المستحقات"}
        </Button>
      </div>

      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-20 space-y-4">
          <Card className="p-5">
            <h3 className="font-bold mb-3">النتيجة</h3>
            {!res ? (
              <p className="text-sm text-muted-foreground">أكمل البيانات ثم اضغط «احسب المستحقات».</p>
            ) : res.invalid ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" /> بيانات غير صالحة — لا يمكن اعتماد النتيجة
                </div>
                <ul className="space-y-1.5">
                  {res.issues.map((i, k) => (
                    <li key={k} className={`rounded-md border p-2 text-xs ${i.severity === "error" ? "border-destructive/40 bg-destructive/5" : "bg-muted/40"}`}>
                      <span className="font-medium">{i.label}:</span> {i.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : res.restricted ? (
              <>
                <div className="text-3xl font-extrabold" dir="ltr">{money(res.result.total)} <span className="text-base font-medium text-muted-foreground">SAR</span></div>
                <p className="text-xs text-muted-foreground mt-1">إجمالي المطالبة التقديري</p>
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-primary" /> التجربة المجانية</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    التفاصيل والمواد النظامية وتصدير PDF غير متاحة في التجربة المجانية، ولا تُرسَل بياناتها من الخادم.
                  </p>
                  <Button asChild size="sm" className="w-full gap-1"><Link to="/subscribe"><Sparkles className="h-3.5 w-3.5" /> ترقية الباقة</Link></Button>
                </div>
              </>
            ) : (
              <FullResultView input={inp} r={res.result} allowPdf={ent.allowPdf} showRefs={ent.showLegalRefs} caseId={res.caseId} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function FullResultView({ input, r, allowPdf, showRefs, caseId }: { input: SaCaseInput; r: SaFullResult; allowPdf: boolean; showRefs: boolean; caseId: string | null }) {
  void input;
  return (
    <div className="space-y-3">
      <div className="text-3xl font-extrabold" dir="ltr">{money(r.total)} <span className="text-base font-medium text-muted-foreground">SAR</span></div>
      <p className="text-xs text-muted-foreground">
        تكييف العقد: {r.contractClassification} • تكييف الإنهاء: {r.terminationClassification} • مدة الخدمة {r.serviceYears} سنة • الأجر الفعلي {money(r.actualWage)}
      </p>
      {r.validation.issues.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> ملاحظات المراجعة المرحلية</div>
          {r.validation.issues.map((i, k) => (<p key={k}>• {i.label}: {i.message}</p>))}
        </div>
      )}
      <Separator />
      <div className="space-y-2 text-sm">
        {r.lines.map((l) => (
          <div key={l.key} className="rounded-md border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{l.label}</span>
              <span className="font-mono" dir="ltr">{money(l.amount)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{l.explanation}</p>
            {showRefs && <p className="text-[11px] text-primary mt-1">{l.legalRef}</p>}
          </div>
        ))}
      </div>
      {r.adjustments.length > 0 && (
        <div className="rounded-md border p-2.5 text-xs space-y-1 bg-muted/40">
          <div className="font-semibold">تعديل المستحقات وفق سبب الإنهاء</div>
          {r.adjustments.map((a, k) => (
            <p key={k}>• {a.label}: <span dir="ltr">{money(a.before)} ← {money(a.after)}</span> — {a.reason}</p>
          ))}
        </div>
      )}
      <div className="rounded-md border p-2.5 text-xs space-y-1 bg-muted/40">
        <div className="font-semibold">التأمينات الاجتماعية</div>
        {r.gosi.subscribed ? (
          <>
            <p>الأجر الخاضع للاشتراك: <span dir="ltr">{money(r.gosi.subjectWage)}</span> — الأساس: {r.gosi.basis}</p>
            <p>اشتراك العامل: <span dir="ltr">{money(r.gosi.employeeAmount)}</span> • مساهمة صاحب العمل: <span dir="ltr">{money(r.gosi.employerAmount)}</span></p>
            <p className="text-muted-foreground">سريان النسب من {r.gosi.effectiveFrom} — الإصدار {r.gosi.legalVersion}</p>
          </>
        ) : (
          <p>العامل غير مشترك في التأمينات وفق البيانات المدخلة.</p>
        )}
      </div>
      {r.settlements.length > 0 && (
        <div className="rounded-md border p-2.5 text-xs space-y-1 bg-muted/40">
          <div className="font-semibold">المخالصات المالية (خُصم <span dir="ltr">{money(r.settledAmount)}</span>)</div>
          {r.settlements.map((s, k) => (
            <p key={k}>• <span dir="ltr">{s.date}</span> — <span dir="ltr">{money(s.amount)}</span> — {s.reliabilityLabel} — {s.note}</p>
          ))}
        </div>
      )}
      <div className="rounded-md border p-2.5 text-xs bg-muted/40">
        الإجمالي قبل المخالصات والتسويات: <span dir="ltr" className="font-mono">{money(r.grossTotal)}</span>
      </div>
      <div className={`rounded-md border p-2.5 text-xs ${r.limitationExpired ? "border-destructive/40 bg-destructive/5" : "bg-muted/40"}`}>
        تقادم الدعوى: <span dir="ltr">{r.limitationDate}</span> {r.limitationExpired ? "— المدة منتهية" : ""}
      </div>
      {allowPdf && <SaReportExportButton caseId={caseId} />}
    </div>
  );
}

