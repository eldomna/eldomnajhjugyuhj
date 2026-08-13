// صفحة الدعم الفني — المكان الوحيد الذي تُعرض فيه وسائل التواصل.
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/lib/i18n";
import { SUPPORT_CHANNELS, SUPPORT_EMAIL } from "@/lib/support";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "الدعم الفني | حاسبة العمال الذكية" },
      {
        name: "description",
        content:
          "تواصل مع فريق حاسبة العمال الذكية: أرقام الدعم في السعودية واليمن والبريد الإلكتروني للاستفسارات والمساعدة الفنية.",
      },
      { property: "og:title", content: "الدعم الفني | حاسبة العمال الذكية" },
      {
        property: "og:description",
        content: "أرقام الدعم في السعودية واليمن والبريد الإلكتروني لفريق حاسبة العمال الذكية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-10 md:py-14">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-2xl font-extrabold md:text-3xl">
            {ar ? "الدعم الفني" : "Technical support"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            {ar
              ? "فريقنا جاهز لمساعدتك في أي استفسار حول الحاسبة أو الاشتراكات أو التقارير. اختر وسيلة التواصل الأنسب لك."
              : "Our team is ready to help with the calculator, subscriptions, or reports. Pick the channel that suits you best."}
          </p>
        </header>

        <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
          {SUPPORT_CHANNELS.map((channel) => (
            <Card key={channel.phone} className="border-border/70">
              <CardContent className="p-5">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Phone className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold">{ar ? channel.labelAr : channel.labelEn}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ar ? channel.noteAr : channel.noteEn}
                    </p>
                    <p dir="ltr" className="mt-2 truncate font-mono text-sm font-semibold">
                      {channel.display}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={`tel:${channel.phone}`} aria-label={ar ? "اتصال هاتفي" : "Call"}>
                      <Phone className="h-4 w-4" />
                      {ar ? "اتصال" : "Call"}
                    </a>
                  </Button>
                  <Button asChild size="sm" className="gap-1.5 bg-green-600 text-white hover:bg-green-700">
                    <a
                      href={`https://wa.me/${channel.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {ar ? "واتساب" : "WhatsApp"}
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-border/70 sm:col-span-2">
            <CardContent className="p-5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-foreground">
                  <Mail className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold">{ar ? "البريد الإلكتروني" : "Email"}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ar
                      ? "للاستفسارات التفصيلية وإرفاق المستندات — الرد عادة خلال 24 ساعة."
                      : "For detailed enquiries and document attachments — usually answered within 24 hours."}
                  </p>
                  <a
                    dir="ltr"
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="mt-2 block truncate font-mono text-sm font-semibold text-primary hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </div>
              <div className="mt-4">
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={`mailto:${SUPPORT_EMAIL}`}>
                    <Mail className="h-4 w-4" />
                    {ar ? "إرسال بريد" : "Send email"}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
