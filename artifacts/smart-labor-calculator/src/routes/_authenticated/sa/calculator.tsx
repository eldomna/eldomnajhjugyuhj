import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { FooterAttribution } from "@/components/FooterAttribution";
import { ContactBar } from "@/components/ContactBar";
import { SaudiCalculator } from "@/components/saudi/SaudiCalculator";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sa/calculator")({
  head: () => ({
    meta: [
      { title: "حاسبة الحقوق العمالية السعودية" },
      { name: "description", content: "احسب مكافأة نهاية الخدمة والساعات الإضافية وبدل الإجازات والمتأخرات وفق نظام العمل السعودي." },
      { property: "og:title", content: "حاسبة الحقوق العمالية السعودية" },
      { property: "og:description", content: "محرك ديناميكي لاحتساب مستحقات العامل وفق نظام العمل السعودي مع تقرير قانوني مفصّل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SaCalcPage,
});

function SaCalcPage() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">🇸🇦 حاسبة الحقوق العمالية السعودية</h1>
            <p className="text-sm text-muted-foreground mt-1">
              عشر خطوات لتحليل العلاقة العمالية واحتساب المستحقات وفق نظام العمل السعودي.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" className="gap-1">
              <Link to="/sa/case-info">
                <ChevronRight className="h-4 w-4" /> الخطوة 1: بيانات القضية
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-1">
              <Link to="/select-country">
                <ChevronRight className="h-4 w-4" /> تغيير الدولة
              </Link>
            </Button>
          </div>
        </div>

        <SaudiCalculator />
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
