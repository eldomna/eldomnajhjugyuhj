import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type SubStatus = "active" | "pending" | "rejected" | "expired" | "none";

export type SubscriptionStatus = {
  status: SubStatus;
  planName: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  daysLeft: number;
  requestId: string | null;
  requestedAt: string | null;
  /** الطلب معلّق لأكثر من 24 ساعة (تأخر التفعيل). */
  delayed: boolean;
};

const EMPTY: SubscriptionStatus = {
  status: "none",
  planName: null,
  startsAt: null,
  expiresAt: null,
  daysLeft: 0,
  requestId: null,
  requestedAt: null,
  delayed: false,
};

async function fetchStatus(): Promise<SubscriptionStatus> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return EMPTY;

  const [{ data: subs }, { data: reqs }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, status, starts_at, expires_at, subscription_plans(name)")
      .order("expires_at", { ascending: false })
      .limit(5),
    supabase
      .from("subscription_requests")
      .select("id, status, created_at, subscription_plans(name)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const now = Date.now();
  const active = (subs ?? []).find(
    (s: any) => s.status === "active" && new Date(s.expires_at).getTime() > now,
  ) as any;

  const latestReq = (reqs ?? [])[0] as any;
  const pending = (reqs ?? []).find((r: any) => r.status === "pending") as any;

  if (active) {
    return {
      status: "active",
      planName: active.subscription_plans?.name ?? null,
      startsAt: active.starts_at ?? null,
      expiresAt: active.expires_at ?? null,
      daysLeft: Math.max(0, Math.ceil((new Date(active.expires_at).getTime() - now) / 86_400_000)),
      requestId: latestReq?.id ?? null,
      requestedAt: latestReq?.created_at ?? null,
      delayed: false,
    };
  }

  if (pending) {
    const requestedAt = pending.created_at as string;
    return {
      ...EMPTY,
      status: "pending",
      planName: pending.subscription_plans?.name ?? null,
      requestId: pending.id,
      requestedAt,
      delayed: now - new Date(requestedAt).getTime() > 24 * 3_600_000,
    };
  }

  if (latestReq?.status === "rejected") {
    return {
      ...EMPTY,
      status: "rejected",
      planName: latestReq.subscription_plans?.name ?? null,
      requestId: latestReq.id,
      requestedAt: latestReq.created_at,
    };
  }

  const expired = (subs ?? [])[0] as any;
  if (expired) {
    return {
      ...EMPTY,
      status: "expired",
      planName: expired.subscription_plans?.name ?? null,
      startsAt: expired.starts_at ?? null,
      expiresAt: expired.expires_at ?? null,
    };
  }

  return EMPTY;
}

export const SUB_STATUS_LABEL: Record<SubStatus, string> = {
  active: "نشط",
  pending: "قيد المعالجة",
  rejected: "لم يُقبل",
  expired: "منتهي",
  none: "بلا اشتراك",
};

/**
 * حالة الاشتراك الحيّة مع تنبيهات فورية (Toast) عند تغيّر الحالة
 * أو تأخر التفعيل — دون إعادة تحميل الصفحة.
 */
export function useSubscriptionStatus(notify = true) {
  const query = useQuery({
    queryKey: ["subscription-status"],
    queryFn: fetchStatus,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const prev = useRef<SubStatus | null>(null);
  const delayNotified = useRef(false);

  useEffect(() => {
    const s = query.data;
    if (!s || !notify) return;

    const before = prev.current;
    prev.current = s.status;

    if (before && before !== s.status) {
      if (s.status === "active") {
        toast.success("تم تأكيد الدفع وتفعيل اشتراكك", {
          description: s.planName ? `الخطة: ${s.planName}` : undefined,
        });
      } else if (s.status === "rejected") {
        toast.error("تعذّر تأكيد الاشتراك", {
          description: "لم يتم قبول إيصال التحويل. راجع البيانات وأعد الإرسال.",
        });
      } else if (s.status === "pending") {
        toast("طلب الاشتراك قيد المعالجة", {
          description: "سيتم التفعيل فور مراجعة الإيصال.",
        });
      } else if (s.status === "expired") {
        toast.warning("انتهت صلاحية اشتراكك", { description: "جدّد الخطة لمواصلة الاستخدام." });
      }
    }

    if (s.delayed && !delayNotified.current) {
      delayNotified.current = true;
      toast.warning("تأخر تفعيل الاشتراك", {
        description: "طلبك قيد المراجعة منذ أكثر من 24 ساعة. يمكنك التواصل مع الدعم.",
      });
    }
    if (!s.delayed) delayNotified.current = false;
  }, [query.data, notify]);

  return { sub: query.data ?? EMPTY, loading: query.isLoading, refetch: query.refetch };
}
