import { Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function FooterAttribution() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-2 text-center">
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

