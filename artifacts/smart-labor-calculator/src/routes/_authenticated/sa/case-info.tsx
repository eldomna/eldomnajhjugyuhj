import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ContactBar } from "@/components/ContactBar";
import { FooterAttribution } from "@/components/FooterAttribution";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  CloudUpload,
  Loader2,
  RefreshCw,
  Redo2,
  Save,
  Undo2,
  UserRound,
} from "lucide-react";
import { useCaseDraft, validateCaseInfo, type CaseInfo } from "@/lib/caseDraft";

export const Route = createFileRoute("/_authenticated/sa/case-info")({
  head: () => ({
    meta: [
      { title: "بيانات القضية — الخطوة 1 • حاسبة العمال الذكية" },
      { name: "description", content: "الخطوة الأولى من المعالج القانوني الذكي: تسجيل بيانات العامل وجهة العمل والمسمى الوظيفي والمدينة مع حفظ تلقائي." },
      { property: "og:title", content: "بيانات القضية — الخطوة 1" },
      { property: "og:description", content: "إدخال بيانات القضية العمالية مع تحقق فوري وحفظ تلقائي وإمكانية التراجع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CaseInfoStep,
});

const NATIONALITIES = [
  "سعودي",
  "يمني",
  "مصري",
  "سوداني",
  "سوري",
  "أردني",
  "هندي",
  "باكستاني",
  "بنغلاديشي",
  "فلبيني",
  "أخرى",
];

const CITIES = [
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "الظهران",
  "الطائف",
  "أبها",
  "تبوك",
  "بريدة",
  "حائل",
  "جيزان",
  "نجران",
  "الجبيل",
  "ينبع",
  "أخرى",
];

const FIELDS: { key: keyof CaseInfo; label: string; hint?: string; kind: "text" | "id"; options?: string[] }[] = [
  { key: "employeeName", label: "اسم العامل", hint: "الاسم الرباعي كما في الهوية", kind: "text" },
  { key: "nationality", label: "الجنسية", kind: "text", options: NATIONALITIES },
  { key: "idNumber", label: "رقم الهوية / الإقامة", hint: "10 أرقام للهوية السعودية أو الإقامة", kind: "id" },
  { key: "employerName", label: "جهة العمل", hint: "اسم المنشأة كما في العقد", kind: "text" },
  { key: "jobTitle", label: "المسمى الوظيفي", kind: "text" },
  { key: "city", label: "المدينة", kind: "text", options: CITIES },
];

function CaseInfoStep() {
  const draft = useCaseDraft("SA", 1);
  const navigate = useNavigate();
  const [touched, setTouched] = useState<Partial<Record<keyof CaseInfo, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => validateCaseInfo(draft.info, "SA"), [draft.info]);
  const showErr = (k: keyof CaseInfo) => (submitted || touched[k]) && errors[k];
  const filled = FIELDS.filter((f) => draft.info[f.key].trim()).length;

  const next = async () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      toast.error("يرجى تصحيح الحقول المطلوبة قبل الانتقال للخطوة التالية");
      return;
    }
    const ok = await draft.saveNow();
    if (!ok) {
      toast.error("تعذّر حفظ البيانات، تحقق من الاتصال ثم أعد المحاولة");
      return;
    }
    toast.success("تم حفظ بيانات القضية");
    navigate({ to: "/sa/contracts" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              <UserRound className="h-3.5 w-3.5" /> الخطوة 1 من المعالج القانوني الذكي
            </div>
            <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">🇸🇦 بيانات القضية</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              أدخل بيانات العامل وجهة العمل. يتم الحفظ تلقائياً ويمكنك المتابعة لاحقاً من نفس النقطة.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-1">
            <Link to="/select-country">
              <ChevronRight className="h-4 w-4" /> تغيير الدولة
            </Link>
          </Button>
        </div>

        {/* شريط التقدم */}
        <div className="mb-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(filled / FIELDS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{filled}/{FIELDS.length}</span>
        </div>

        {draft.loading && (
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </Card>
        )}

        {!draft.loading && draft.loadError && (
          <Card className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <h2 className="mb-1 font-bold">تعذّر تحميل بيانات القضية</h2>
            <p className="mb-4 text-sm text-muted-foreground">{draft.loadError}</p>
            <Button variant="outline" className="gap-2" onClick={() => void draft.reload()}>
              <RefreshCw className="h-4 w-4" /> إعادة المحاولة
            </Button>
          </Card>
        )}

        {!draft.loading && !draft.loadError && (
          <>
            <Card className="p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {draft.saving ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ الحفظ التلقائي…
                    </span>
                  ) : draft.savedAt ? (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <CloudUpload className="h-3.5 w-3.5" /> تم الحفظ{" "}
                      {draft.savedAt.toLocaleTimeString("ar-SA")}
                    </span>
                  ) : (
                    <span>الحفظ التلقائي مُفعّل</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={!draft.canUndo}
                    onClick={draft.undo}
                  >
                    <Undo2 className="h-4 w-4" /> تراجع
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={!draft.canRedo}
                    onClick={draft.redo}
                  >
                    <Redo2 className="h-4 w-4" /> إعادة
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                    onClick={() => void draft.saveNow()}
                  >
                    <Save className="h-4 w-4" /> حفظ الآن
                  </Button>
                </div>
              </div>

              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void next();
                }}
              >
                {FIELDS.map((f) => {
                  const err = showErr(f.key);
                  return (
                    <div key={f.key} className="space-y-1.5">
                      <Label className="text-xs" htmlFor={f.key}>
                        {f.label} <span className="text-destructive">*</span>
                      </Label>
                      {f.options ? (
                        <select
                          id={f.key}
                          className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${err ? "border-destructive" : ""}`}
                          value={f.options.includes(draft.info[f.key]) ? draft.info[f.key] : draft.info[f.key] ? "أخرى" : ""}
                          onChange={(e) => draft.update({ [f.key]: e.target.value } as Partial<CaseInfo>)}
                          onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
                        >
                          <option value="">— اختر —</option>
                          {f.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          id={f.key}
                          dir={f.kind === "id" ? "ltr" : undefined}
                          inputMode={f.kind === "id" ? "numeric" : "text"}
                          value={draft.info[f.key]}
                          aria-invalid={!!err}
                          className={err ? "border-destructive" : ""}
                          onChange={(e) =>
                            draft.update({
                              [f.key]: f.kind === "id" ? e.target.value.replace(/\D/g, "").slice(0, 20) : e.target.value,
                            } as Partial<CaseInfo>)
                          }
                          onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
                        />
                      )}
                      {err ? (
                        <p className="text-[11px] font-medium text-destructive">{errors[f.key]}</p>
                      ) : f.hint ? (
                        <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                      ) : null}
                    </div>
                  );
                })}
              </form>
            </Card>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Button asChild variant="ghost" className="gap-1">
                <Link to="/select-country">
                  <ChevronRight className="h-4 w-4" /> السابق
                </Link>
              </Button>
              <Button className="gap-2" disabled={draft.saving} onClick={() => void next()}>
                التالي: بيانات العقد <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </>
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
