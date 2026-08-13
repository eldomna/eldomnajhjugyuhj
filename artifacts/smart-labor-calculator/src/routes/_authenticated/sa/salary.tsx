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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, ChevronRight, Info, Lock, Save, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseDraft } from "@/lib/caseDraft";
import {
  SALARY_GROUPS,
  computeSalary,
  emptySalary,
  money,
  toNumbers,
  validateSalary,
  type SalaryField,
} from "@/lib/saudi/salary";

export const Route = createFileRoute("/_authenticated/sa/salary")({
  head: () => ({
    meta: [
      { title: "بيانات الراتب — الخطوة 4 • حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "الخطوة الرابعة: إدخال الراتب الأساسي والبدلات والعمولات والمزايا النقدية واحتساب الأجر الفعلي واليومي وأجر الساعة تلقائياً.",
      },
      { property: "og:title", content: "بيانات الراتب — الخطوة 4" },
      { property: "og:description", content: "تصنيف بنود الأجر واحتساب الأجر الفعلي واليومي والساعي تلقائياً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalaryStep,
});

const emptyRaw = Object.fromEntries(
  (Object.keys(emptySalary) as SalaryField[]).map((k) => [k, ""]),
) as Record<SalaryField, string>;

function SalaryStep() {
  const draft = useCaseDraft("SA", 4);
  const navigate = useNavigate();
  const caseId = draft.draftId;

  const [raw, setRaw] = useState<Record<SalaryField, string>>(emptyRaw);
  const [touched, setTouched] = useState(false);

  const saved = useQuery({
    queryKey: ["case-salary", caseId],
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

  useEffect(() => {
    const row = saved.data as Record<string, number> | null | undefined;
    if (!row) return;
    setRaw((prev) => {
      const next = { ...prev };
      (Object.keys(emptySalary) as SalaryField[]).forEach((k) => {
        if (row[k] !== undefined && row[k] !== null) next[k] = String(row[k]);
      });
      return next;
    });
  }, [saved.data]);

  const errors = useMemo(() => validateSalary(raw), [raw]);
  const values = useMemo(() => toNumbers(raw), [raw]);
  const result = useMemo(() => computeSalary(values), [values]);
  const valid = Object.keys(errors).length === 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error("لا توجد قضية محفوظة");
      const payload = {
        case_id: caseId,
        ...values,
        actual_salary: result.actual,
        daily_salary: result.daily,
        hourly_salary: result.hourly,
        currency: "SAR",
      };
      const { error } = await supabase.from("case_salaries").upsert(payload, { onConflict: "case_id" });
      if (error) throw error;
      await draft.saveNowWith({
        salary: {
          ...values,
          basic: result.basic,
          allowances_total: result.allowances,
          commissions_total: result.commissions,
          benefits_total: result.benefits,
          actual_salary: result.actual,
          daily_salary: result.daily,
          hourly_salary: result.hourly,
          currency: "SAR",
        },
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر حفظ بيانات الراتب"),
  });

  const submit = async (thenNext: boolean) => {
    setTouched(true);
    if (!valid) {
      toast.error("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    await save.mutateAsync();
    toast.success("تم حفظ بيانات الراتب وإعادة احتساب الأجر الفعلي واليومي والساعي");
    if (thenNext) navigate({ to: "/sa/working-hours" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Wallet className="h-3.5 w-3.5" /> الخطوة 4 من المعالج القانوني الذكي
          </div>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">🇸🇦 بيانات الراتب</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تُحتسب نتائج الأجر تلقائياً وتُستخدم في الساعات الإضافية والإجازات والتعويضات ومكافأة نهاية الخدمة وبدل
            الإشعار.
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
              {SALARY_GROUPS.map((g) => (
                <Card key={g.title} className="p-5">
                  <h2 className="mb-4 font-bold">{g.title}</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {g.fields.map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label className="text-xs">
                          {f.label}
                          {f.key === "basic_salary" && <span className="text-destructive"> *</span>}
                        </Label>
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={raw[f.key]}
                          onChange={(e) => setRaw((s) => ({ ...s, [f.key]: e.target.value }))}
                        />
                        {touched && errors[f.key] && (
                          <p className="text-[11px] font-medium text-destructive">{errors[f.key]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-4 lg:col-span-2">
              <Card className="p-5">
                <h2 className="mb-3 flex items-center gap-2 font-bold">
                  <Info className="h-4 w-4 text-primary" /> نتائج الأجر (تلقائية)
                </h2>
                <dl className="space-y-2 text-sm">
                  <Fact label="الأجر الأساسي" value={money(result.basic)} />
                  <Fact label="إجمالي البدلات" value={money(result.allowances)} />
                  <Fact label="العمولات والمكافآت الثابتة" value={money(result.commissions)} />
                  <Fact label="المزايا النقدية" value={money(result.benefits)} />
                  <Fact label="الأجر الفعلي (شهري)" value={money(result.actual)} />
                  <Fact label="الأجر اليومي (الفعلي ÷ 30)" value={money(result.daily)} />
                  <Fact label="أجر الساعة (اليومي ÷ 8)" value={money(result.hourly)} />
                </dl>
                <Alert className="mt-4">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>قيم محسوبة تلقائياً</AlertTitle>
                  <AlertDescription className="text-xs">
                    لا يمكن تعديل الأجر الفعلي أو الأجر اليومي أو أجر الساعة يدوياً — تُحتسب من البنود المدخلة فقط.
                  </AlertDescription>
                </Alert>
              </Card>

              <Card className="space-y-3 p-5">
                <h3 className="font-bold">التحقق قبل الحفظ</h3>
                <ul className="list-disc space-y-1 pe-4 text-xs text-muted-foreground">
                  <li>الراتب الأساسي مطلوب وأكبر من صفر</li>
                  <li>لا تُقبل القيم السالبة أو النصوص في الحقول الرقمية</li>
                  <li>تُعاد النتائج تلقائياً بعد كل حفظ</li>
                </ul>
                <Button className="w-full gap-2" disabled={save.isPending} onClick={() => void submit(false)}>
                  <Save className="h-4 w-4" /> حفظ بيانات الراتب
                </Button>
              </Card>
            </div>
          </div>
        )}

        {caseId && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" className="gap-1">
              <Link to="/sa/trial-periods">
                <ChevronRight className="h-4 w-4" /> السابق: فترة التجربة
              </Link>
            </Button>
            <Button className="gap-2" disabled={!valid || save.isPending} onClick={() => void submit(true)}>
              التالي: ساعات العمل <ArrowLeft className="h-4 w-4" />
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed pb-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
