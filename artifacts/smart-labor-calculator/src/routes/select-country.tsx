import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, Scale, AlertTriangle, RefreshCw, Check, Loader2 } from "lucide-react";
import { useCountries, useSelectedCountry, type Country } from "@/lib/countries";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { setMyCountry } from "@/lib/billing/pricing.functions";

export const Route = createFileRoute("/select-country")({
  // اختيار الدولة خطوة بعد تسجيل الدخول فقط — لا تُعرض للزائر غير المسجل.
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "اختر الدولة • حاسبة العمال الذكية" },
      { name: "description", content: "اختر نظام الحقوق العمالية المطلوب: المملكة العربية السعودية أو الجمهورية اليمنية." },
      { property: "og:title", content: "اختر الدولة • حاسبة العمال الذكية" },
      { property: "og:description", content: "محركان مستقلان لاحتساب الحقوق العمالية وفق نظام كل دولة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SelectCountry,
});


function SelectCountry() {
  const { data, isLoading, isError, error, refetch } = useCountries();
  const { code: current, select } = useSelectedCountry();
  const { t, pick, dir } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const saveCountry = useServerFn(setMyCountry);
  const [saving, setSaving] = useState<string | null>(null);
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  // الدولة تُحفظ في قاعدة البيانات (المصدر الأساسي للأسعار) ثم محلياً للواجهة.
  const choose = async (c: Country) => {
    setSaving(c.code);
    try {
      await saveCountry({ data: { country: c.code } });
      select(c.code);
      qc.invalidateQueries({ queryKey: ["my-pricing"] });
      navigate({ to: c.calculator_path as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر حفظ الدولة");
    } finally {
      setSaving(null);
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1">
        <section className="brand-gradient text-primary-foreground">
          <div className="container mx-auto px-4 py-14 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-black/20 px-3 py-1 text-xs font-semibold text-accent">
              <Scale className="h-3.5 w-3.5" /> {t("country.badge")}
            </div>
            <h1 className="font-display mt-4 text-3xl sm:text-4xl font-extrabold">{t("country.title")}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm opacity-85">{t("country.desc")}</p>
          </div>
        </section>

        <div className="container mx-auto -mt-8 max-w-3xl px-4 pb-16">
          {isLoading && (
            <div className="grid gap-5 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <Card key={i} className="p-7 space-y-4">
                  <Skeleton className="h-16 w-16 rounded-2xl" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-10 w-full" />
                </Card>
              ))}
            </div>
          )}

          {isError && (
            <Card className="p-8 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
              <h2 className="font-bold mb-1">{t("country.loadError")}</h2>
              <p className="text-sm text-muted-foreground mb-4">{(error as Error)?.message}</p>
              <Button variant="outline" className="gap-2" onClick={() => void refetch()}>
                <RefreshCw className="h-4 w-4" /> {t("common.retry")}
              </Button>
            </Card>
          )}

          {!isLoading && !isError && (data?.length ?? 0) === 0 && (
            <Card className="p-8 text-center">
              <Scale className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="font-bold mb-1">{t("country.empty")}</h2>
              <p className="text-sm text-muted-foreground">{t("country.emptyDesc")}</p>
            </Card>
          )}

          {!isLoading && !isError && (data?.length ?? 0) > 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              {data!.map((c) => (
                <Card
                  key={c.code}
                  className="group relative flex flex-col overflow-hidden border-border/70 p-7 card-elev hover-lift hover:border-accent/50"
                >
                  <div className="absolute inset-x-0 top-0 h-1 gold-rule opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="mb-4 flex items-center justify-between">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary-soft text-4xl ring-1 ring-accent/25">
                      {c.flag}
                    </div>
                    {current === c.code && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-[11px] font-semibold text-primary">
                        <Check className="h-3 w-3" /> {t("common.current")}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-extrabold mb-2">{pick(c.name_ar, c.name_en)}</h2>
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                    {pick(c.description_ar, c.description_en)}
                  </p>
                  <Button className="mt-6 w-full gap-2" disabled={saving !== null} onClick={() => void choose(c)}>
                    {saving === c.code && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t("country.open")}{" "}
                    <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-1" />

                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
