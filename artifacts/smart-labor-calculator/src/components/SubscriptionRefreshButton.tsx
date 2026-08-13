import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const RELATED_KEYS = [
  "subscription-status",
  "subscription-history",
  "subscription-history-requests",
  "my-subscriptions",
  "my-subscription-requests-full",
  "entitlements",
];

type Props = {
  /** نص الزر. */
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
};

/**
 * زر إعادة محاولة تحديث حالة الاشتراك من الخادم دون إعادة تحميل الصفحة.
 * يُعيد جلب كل استعلامات الاشتراك المرتبطة ويعرض نتيجة المحاولة.
 */
export function SubscriptionRefreshButton({
  label = "إعادة المحاولة",
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("لا يوجد اتصال بالإنترنت", { description: "أعد المحاولة بعد استعادة الاتصال." });
      return;
    }
    setBusy(true);
    try {
      await Promise.all(
        RELATED_KEYS.map((k) => qc.refetchQueries({ queryKey: [k], type: "active" })),
      );
      toast.success("تم تحديث حالة الاشتراك من الخادم");
    } catch {
      toast.error("تعذّر تحديث الحالة", { description: "حاول مرة أخرى بعد لحظات." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={onClick} disabled={busy}>
      <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      {busy ? "جارٍ التحديث..." : label}
    </Button>
  );
}
