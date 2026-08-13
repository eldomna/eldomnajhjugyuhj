import { Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * شريط التواصل — لم يعد يعرض أي أرقام هاتف.
 * أرقام الدعم والبريد الإلكتروني تُعرض فقط في صفحة الدعم الفني (/support)،
 * وهذا الشريط يوجّه المستخدم إليها للحفاظ على التنسيق في كل الصفحات.
 */
export function ContactBar({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      <Link
        to="/support"
        className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
      >
        <LifeBuoy className="h-4 w-4" />
        <span>{t("nav.support")}</span>
      </Link>
    </div>
  );
}
