import { Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import oskarLogo from "@/assets/oskar-logo-v2.png.asset.json";
import { footerSealUrl } from "@/assets/footer-seal";
import { useI18n } from "@/lib/i18n";

export function FooterAttribution() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <img
        src={footerSealUrl}
        alt="الشعار الرسمي"
        className="h-16 w-16 object-contain mb-1"
        loading="lazy"
      />
      <p className="text-sm text-muted-foreground">{t("footer.builtBy")}</p>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <img
          src={oskarLogo.url}
          alt={t("footer.companyLogoAlt")}
          className="h-8 w-auto object-contain"
          loading="lazy"
        />
        <span className="text-sm font-semibold text-foreground">{t("footer.company")}</span>
      </div>
      {/* أرقام التواصل تُعرض فقط في صفحة الدعم الفني. */}
      <Link
        to="/support"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <LifeBuoy className="h-4 w-4" />
        <span>{t("nav.support")}</span>
      </Link>
    </div>
  );
}

