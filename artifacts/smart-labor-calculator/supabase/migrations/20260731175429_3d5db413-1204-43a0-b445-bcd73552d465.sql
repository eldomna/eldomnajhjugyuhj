-- 1) Lock down SECURITY DEFINER functions: no anon execute, internal/trigger helpers not callable from the API at all.

-- Trigger + internal-only helpers: callable by nobody through the API.
REVOKE ALL ON FUNCTION public.admin_users_sync_trigger() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_document() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_settings_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_user_subscription_request() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_lawyer_verification() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_lawyer_rating() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_on_request_approved() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_on_transaction_success() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_referral_reward(uuid, numeric, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_admin_role_for_email(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_due_subscriptions() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.gen_referral_code() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_referral_reward(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_admin_role_for_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO service_role;

-- Admin-gated RPCs: keep signed-in access (they check has_role internally), block anon.
REVOKE ALL ON FUNCTION public.admin_mark_reward_paid(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_referral_overview() FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_reward_type(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_toggle_referral_code(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.approve_subscription_request(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.new_rule_version(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.publish_legal_rule(uuid, text, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.unpublish_legal_rule(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.rollback_legal_rule(uuid, text) FROM anon;

-- Signed-in user RPCs: block anon (they are meaningless without auth.uid()).
REVOKE ALL ON FUNCTION public.attach_referral_code(text) FROM anon;
REVOKE ALL ON FUNCTION public.check_referral_code(text) FROM anon;
REVOKE ALL ON FUNCTION public.consume_calc_credit() FROM anon;
REVOKE ALL ON FUNCTION public.consume_free_trial() FROM anon;
REVOKE ALL ON FUNCTION public.get_access_status() FROM anon;
REVOKE ALL ON FUNCTION public.get_my_referral_code() FROM anon;
REVOKE ALL ON FUNCTION public.get_my_referral_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_platform_entitlements() FROM anon;
REVOKE ALL ON FUNCTION public.set_my_reward_type(text) FROM anon;
REVOKE ALL ON FUNCTION public.register_document(text, text, numeric, integer, integer, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.register_document(text, text, numeric, integer, integer, numeric, text, text, date, date) FROM anon;

-- 2) page_views: remove the always-true INSERT policy; a client may only log its own identity.
DROP POLICY IF EXISTS "anyone can insert page views" ON public.page_views;
CREATE POLICY "clients log own page views"
  ON public.page_views FOR INSERT TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND path IS NOT NULL AND length(path) <= 512
    AND (referrer IS NULL OR length(referrer) <= 1024)
    AND (user_agent IS NULL OR length(user_agent) <= 500)
    AND (session_id IS NULL OR length(session_id) <= 64)
  );

-- 3) free_trial_usage holds phone/email PII: no client access at all.
--    Reads/writes happen only inside SECURITY DEFINER functions and server code.
DROP POLICY IF EXISTS "Admins manage trial usage" ON public.free_trial_usage;
DROP POLICY IF EXISTS "Users read own trial usage" ON public.free_trial_usage;
REVOKE ALL ON TABLE public.free_trial_usage FROM anon, authenticated;
GRANT ALL ON TABLE public.free_trial_usage TO service_role;

-- 4) admin_role_assignments (MFA + privileged status): admin-only, no self-read of the audit table.
DROP POLICY IF EXISTS "users read own role assignments" ON public.admin_role_assignments;
REVOKE ALL ON TABLE public.admin_role_assignments FROM anon;
GRANT ALL ON TABLE public.admin_role_assignments TO service_role;

-- 5) Lawyer PII: contact channels are no longer bulk-readable from the base table.
--    Public directory reads go through a definer view exposing only safe columns.
DROP POLICY IF EXISTS "Authenticated read approved lawyers" ON public.lawyers;

ALTER VIEW public.lawyers_public SET (security_invoker = off);
GRANT SELECT ON public.lawyers_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_lawyer_contact(_lawyer_id uuid)
RETURNS TABLE(phone text, whatsapp text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT l.phone, l.whatsapp, l.email
    FROM public.lawyers l
   WHERE l.id = _lawyer_id
     AND (
       (l.is_active AND l.verification_status = 'approved')
       OR l.user_id = auth.uid()
       OR public.has_role(auth.uid(), 'admin')
     )
   LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_lawyer_contact(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_lawyer_contact(uuid) TO authenticated;