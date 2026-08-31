import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Scale, FileText, ShieldCheck, Calculator, Download, Smartphone, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import logoAsset from "@/assets/logo-v2";
import { AdHero, AdRotator } from "@/components/ads/AdSlots";
import { useAccess } from "@/lib/useAccess";
import { FooterAttribution } from "@/components/FooterAttribution";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "حاسبة العمال الذكية — نظام العمل السعودي وقانون العمل اليمني" },
      {
        name: "description",
        content:
          "حاسبة العمال الذكية (SMART LABOR CALCULATOR): حساب الحقوق العمالية وإصدار التقارير القانونية وفق نظام العمل السعودي وقانون العمل اليمني، لخدمة الموظفين وأصحاب العمل.",
      },
      { property: "og:title", content: "حاسبة العمال الذكية — نظام العمل السعودي وقانون العمل اليمني" },
      {
        property: "og:description",
        content: "حاسبة العمال الذكية (SMART LABOR CALCULATOR): حساب الحقوق العمالية وإصدار التقارير القانونية وفق نظام العمل السعودي وقانون العمل اليمني، لخدمة الموظفين وأصحاب العمل.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden brand-gradient">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,.6) 0 1px, transparent 1px 14px)",
            }}
          />
          <div className="relative container mx-auto px-4 py-20 sm:py-28 text-primary-foreground">
            <div className="grid md:grid-cols-[1fr_auto] gap-12 items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-black/25 px-3 py-1 text-xs font-semibold text-accent">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t("home.hero.badge")}
                </div>
                <h1 className="font-display mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.15]">
                  {t("brand.name")}
                  <span className="block gold-text">{t("home.hero.titleSub")}</span>
                </h1>
                <div className="mt-6 h-px w-40 gold-rule" />
                <p className="mt-6 text-base sm:text-lg leading-relaxed opacity-90">
                  {t("home.hero.desc")}
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                    <a href="#calculator"><Calculator className="h-4 w-4" /> {t("home.hero.cta")}</a>
                  </Button>
                  <PWAInstallButton
                    variant="outline"
                    className="gap-2 border-white/35 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
                  />
                </div>
                <p className="mt-5 text-xs opacity-75">{t("home.hero.pricingNote")}</p>
              </div>
              <div className="hidden md:flex justify-center">
                <div className="relative rounded-[2rem] border border-accent/30 bg-black/25 p-7 backdrop-blur">
                  <div className="absolute inset-x-8 -top-px h-px gold-rule" />
                  <img
                    src={logoAsset.url}
                    alt={t("brand.logoAlt")}
                    className="h-56 w-56 object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-b bg-card">
          <div className="container mx-auto grid grid-cols-2 gap-4 px-4 py-6 text-center md:grid-cols-4">
            {[
              { k: t("home.trust.systems"), v: t("home.trust.systemsV") },
              { k: t("home.trust.refs"), v: t("home.trust.refsV") },
              { k: t("home.trust.report"), v: t("home.trust.reportV") },
              { k: t("home.trust.offline"), v: t("home.trust.offlineV") },
            ].map((s) => (
              <div key={s.k}>
                <div className="font-display text-sm font-extrabold text-primary">{s.k}</div>
                <div className="text-xs text-muted-foreground">{s.v}</div>
              </div>
            ))}
          </div>
        </section>

        <AdHero />

        {/* In-page calculator — no auth required */}
        <CalculatorHomeSection />

        {/* Features */}
        <section className="container mx-auto px-4 py-16 sm:py-20">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold">{t("home.features.title")}</h2>
            <div className="mx-auto mt-3 h-px w-24 gold-rule" />
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { icon: Calculator, title: t("home.features.calc.title"), desc: t("home.features.calc.desc") },
              { icon: FileText, title: t("home.features.report.title"), desc: t("home.features.report.desc") },
              { icon: Smartphone, title: t("home.features.pwa.title"), desc: t("home.features.pwa.desc") },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="group border-border/70 p-7 card-elev hover-lift hover:border-accent/50">
                <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-accent/20">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-extrabold mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Public verification */}
        <VerifySection />

        <AdRotator />

        {/* CTA */}
        <section className="container mx-auto px-4 pb-20">
          <Card className="relative overflow-hidden border-accent/30 p-8 sm:p-14 text-center brand-gradient text-primary-foreground">
            <div className="absolute inset-x-16 top-0 h-px gold-rule" />
            <Scale className="mx-auto mb-4 h-10 w-10 text-accent" />
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold mb-3">{t("home.cta.title")}</h2>
            <p className="mx-auto mb-7 max-w-xl text-sm opacity-85">{t("home.cta.desc")}</p>
            <Button asChild size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/select-country"><Download className="h-4 w-4" /> {t("home.cta.button")}</Link>
            </Button>
          </Card>
        </section>
      </main>
      <footer className="border-t bg-card">
        <div className="h-0.5 w-full gold-rule opacity-60" />
        <div className="container mx-auto px-4 py-8 text-center">
          <img src={logoAsset.url} alt={t("home.footer.logoAlt")} className="mx-auto mb-4 h-14 w-14 object-contain" />
          <FooterAttribution />
          <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            <p>{t("home.footer.rights", { year: new Date().getFullYear() })}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-4">
              <Link to="/support" className="hover:text-primary">{t("nav.support")}</Link>
              <Link to="/privacy" className="hover:text-primary">{t("nav.privacy")}</Link>
              <Link to="/terms" className="hover:text-primary">{t("nav.terms")}</Link>
              <Link to="/disclaimer" className="hover:text-primary">{t("nav.disclaimer")}</Link>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}

function VerifySection() {
  const { t } = useI18n();
  const [serial, setSerial] = useState("");
  const nav = useNavigate();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim()) return;
    nav({ to: "/verify", search: { serial: serial.trim() } });
  };
  return (
    <section className="container mx-auto px-4 pb-16">
      <Card className="overflow-hidden border-2 border-primary/20 card-elev">
        <div className="grid md:grid-cols-2">
          <div className="p-7 sm:p-10 bg-primary-soft/30">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold mb-3">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("home.verify.badge")}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">{t("home.verify.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("home.verify.desc")}</p>
          </div>
          <div className="p-7 sm:p-10 bg-card">
            <form onSubmit={submit} className="space-y-3">
              <label htmlFor="hv" className="text-sm font-semibold">{t("home.verify.label")}</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:right-3 ltr:right-auto ltr:left-3" />
                <Input
                  id="hv"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="YML-2026-00001"
                  className="px-10 font-mono"
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full gap-2">
                <ShieldCheck className="h-4 w-4" /> {t("home.verify.submit")}
              </Button>
              <Link to="/verify" search={{ serial: undefined }} className="text-xs text-primary hover:underline block text-center">
                {t("home.verify.full")}
              </Link>
            </form>
          </div>
        </div>
      </Card>
    </section>
  );
}

/**
 * قسم الحاسبة في الصفحة العامة — بدون أي أسعار أو مبالغ.
 * الأسعار تُعرض فقط بعد تسجيل الدخول وتحديد الدولة داخل صفحة الاشتراك.
 */
function CalculatorHomeSection() {
  const access = useAccess();
  const { t } = useI18n();

  return (
    <section id="calculator" className="bg-muted/30 border-y">
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold mb-3">
            <Calculator className="h-3.5 w-3.5" /> {t("home.calc.badge")}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2">{t("home.calc.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("home.calc.descGeneric")}</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {[
            { icon: Calculator, title: t("home.features.calc.title"), desc: t("home.features.calc.desc") },
            { icon: FileText, title: t("home.features.report.title"), desc: t("home.features.report.desc") },
            { icon: ShieldCheck, title: t("home.verify.title"), desc: t("home.verify.desc") },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-6 card-elev">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-accent/20">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-extrabold mb-2">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button asChild size="lg" variant="secondary" className="gap-2">
            <Link to={access.signedIn ? "/select-country" : "/auth"}>
              <Calculator className="h-4 w-4" />
              {access.signedIn ? t("home.calc.open") : t("home.calc.createAccount")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
