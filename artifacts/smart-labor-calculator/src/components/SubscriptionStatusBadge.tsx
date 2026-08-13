import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, AlertTriangle, CreditCard } from "lucide-react";
import { SUB_STATUS_LABEL, type SubStatus } from "@/lib/useSubscriptionStatus";

const MAP: Record<SubStatus, { variant: "default" | "secondary" | "destructive" | "outline"; Icon: typeof Clock }> = {
  active: { variant: "default", Icon: CheckCircle2 },
  pending: { variant: "secondary", Icon: Clock },
  rejected: { variant: "destructive", Icon: XCircle },
  expired: { variant: "destructive", Icon: AlertTriangle },
  none: { variant: "outline", Icon: CreditCard },
};

/** شارة حالة الاشتراك (نشط / قيد المعالجة / منتهي). */
export function SubscriptionStatusBadge({ status, className }: { status: SubStatus; className?: string }) {
  const { variant, Icon } = MAP[status];
  return (
    <Badge variant={variant} className={`gap-1 ${className ?? ""}`}>
      <Icon className="h-3.5 w-3.5" />
      {SUB_STATUS_LABEL[status]}
    </Badge>
  );
}
