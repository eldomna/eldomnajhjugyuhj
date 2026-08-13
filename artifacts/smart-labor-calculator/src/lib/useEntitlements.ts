import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEntitlements, type Entitlements } from "@/lib/billing/billing.functions";

const FALLBACK: Entitlements = {
  planCode: "free",
  status: "free",
  expiresAt: null,
  creditsRemaining: null,
  autoRenew: false,
  showDetails: false,
  showLegalRefs: false,
  allowPdf: false,
  engines: ["sa"],
};

/** صلاحيات الاشتراك كما يحسبها الخادم. الواجهة تعرض فقط، والخادم هو من يفرض. */
export function useEntitlements() {
  const fetchEnt = useServerFn(getEntitlements);
  const q = useQuery({
    queryKey: ["entitlements"],
    queryFn: () => fetchEnt(),
    staleTime: 30_000,
    retry: false,
  });
  return {
    ent: q.data ?? FALLBACK,
    loading: q.isLoading,
    refetch: q.refetch,
  };
}
