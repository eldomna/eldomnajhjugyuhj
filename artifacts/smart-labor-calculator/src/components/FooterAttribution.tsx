import { Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import logoAsset from "@/assets/logo-v2";

export function FooterAttribution() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <img src={logoAsset.url} alt="OSKAR" className="h-12 w-auto object-contain opacity-90" />
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

