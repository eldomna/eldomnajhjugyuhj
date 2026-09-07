import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * بوابة اشتراك موحّدة لكل خطوات حاسبة السعودية (/sa/*).
 * قبل كده كانت حاسبة السعودية بدون أي فحص اشتراك — أي يوزر مسجّل دخول
 * يقدر يستخدمها مجانًا للأبد، على عكس حاسبة اليمن (/calculator) اللي
 * فيها بوابة مطابقة عبر useAccess + AccessGate.
 *
 * نفس منطق الأهلية المستخدم في /calculator: مشترك، أو عنده تجربة مجانية
 * لسه ما استهلكها (تُستهلك فعليًا عند إتمام الحساب، مش عند مجرد الدخول).
 */
export const Route = createFileRoute("/_authenticated/sa")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("get_access_status");
    const row = Array.isArray(data) ? data[0] : null;
    const isSubscribed = !!row?.is_subscribed;
    const trialUsed = row?.trial_used ?? 0;
    const trialLimit = row?.trial_limit ?? 1;
    const canUse = !error && (isSubscribed || trialUsed < trialLimit);
    if (!canUse) throw redirect({ to: "/subscribe" });
  },
  component: () => <Outlet />,
});
