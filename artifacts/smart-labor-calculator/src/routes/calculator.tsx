import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { CalculatorWizard } from "@/components/CalculatorWizard";
import { CalculatorResults } from "@/components/CalculatorResults";
import { ContactBar } from "@/components/ContactBar";
import { FooterAttribution } from "@/components/FooterAttribution";
import { AccessGate } from "@/components/AccessGate";
import { Button } from "@/components/ui/button";
import { RotateCcw, Sparkles } from "lucide-react";
import { useCalculatorStore } from "@/store/calculator";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAccess, consumeFreeTrial } from "@/lib/useAccess";




export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "الحاسبة • حاسبة العمال الذكية" },
      { name: "description", content: "احسب نهاية الخدمة والعمل الإضافي وبدل الإجازات والإنذار وفقاً لقانون العمل اليمني." },
    ],
  }),
  component: CalcPage,
});

function CalcPage() {
  const [tab, setTab] = useState<"form" | "results">("form");
  const resetCounter = useCalculatorStore((s) => s.resetCounter);
  const access = useAccess();
  const navigate = useNavigate();
  const consuming = useRef(false);
  const [trialGranted, setTrialGranted] = useState(false);

  const trialAvailable = access.signedIn && !access.isSubscribed && access.trialUsed < access.trialLimit;

  const canUse = access.isSubscribed || trialAvailable || trialGranted;

  // التجربة المجانية لا تُخصم عند فتح الحاسبة أو التحديث أو الخروج،
  // بل فقط بعد إكمال جميع الخطوات بنجاح وظهور الإجمالي النهائي.
  const handleComputed = async () => {
    setTab("results");
    if (access.isSubscribed || trialGranted || !trialAvailable) return;
    if (consuming.current) return;
    consuming.current = true;
    const ok = await consumeFreeTrial();
    consuming.current = false;
    if (ok) {
      setTrialGranted(true);
      access.refresh();
    }
  };

  // بوابة صارمة: انتهاء الاشتراك أو استنفاد التجربة يحوّل المستخدم لصفحة الاشتراك.
  useEffect(() => {
    if (access.loading || !access.signedIn || canUse) return;
    toast.warning("انتهت صلاحية اشتراكك. جدّد الاشتراك لمتابعة استخدام الحاسبة والتقارير.");
    navigate({ to: "/subscribe", replace: true });
  }, [access.loading, access.signedIn, canUse, navigate]);



  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">حاسبة الحقوق العمالية</h1>
            <p className="text-sm text-muted-foreground mt-1">
              اتبع الخطوات وسنحسب حقوقك وفق قانون العمل اليمني.
            </p>
          </div>
          {canUse && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                useCalculatorStore.getState().newCalculation();
                setTab("form");
                toast.success("تم بدء حسبة جديدة");
              }}
            >
              <RotateCcw className="h-4 w-4" /> حسبة جديدة
            </Button>
          )}
        </div>

        {access.loading ? (
          <p className="text-sm text-muted-foreground text-center py-16">جارٍ التحقق من صلاحية الوصول...</p>
        ) : !access.signedIn ? (
          <AccessGate mode="signin" />
        ) : !canUse ? (
          <AccessGate mode="subscribe" />
        ) : (
          <>
            {!access.isSubscribed && (
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2 flex-wrap">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>أنت تستخدم الحساب التجريبي المجاني (مرة واحدة لكل رقم جوال).</span>
                <Button asChild size="sm" variant="link" className="px-0">
                  <a href="/subscribe">اشترك للوصول غير المحدود</a>
                </Button>
              </div>
            )}

            <div className="lg:hidden flex rounded-lg bg-card border p-1 mb-4">
              <button onClick={() => setTab("form")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${tab === "form" ? "bg-primary text-primary-foreground" : ""}`}>
                البيانات
              </button>
              <button onClick={() => setTab("results")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${tab === "results" ? "bg-primary text-primary-foreground" : ""}`}>
                النتائج
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <div className={`lg:col-span-2 ${tab === "form" ? "" : "hidden lg:block"}`}>
                <CalculatorWizard key={resetCounter} onComputed={handleComputed} />
              </div>
              <div className={`lg:col-span-3 ${tab === "results" ? "" : "hidden lg:block"}`}>
                <CalculatorResults />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t bg-card/50 mt-auto">
        <div className="container mx-auto px-4 py-4 text-center">
          <FooterAttribution />
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            <ContactBar className="mb-3" />
            <p>© {new Date().getFullYear()} حاسبة العمال الذكية</p>
          </div>
        </div>
      </footer>

    </div>
  );
}

