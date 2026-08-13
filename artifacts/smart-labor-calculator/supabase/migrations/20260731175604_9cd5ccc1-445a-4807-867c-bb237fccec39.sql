-- Functions default to EXECUTE for PUBLIC; strip that and re-grant per audience.

-- (a) Internal-only: triggers + helpers invoked from other definer functions/server code.
REVOKE ALL ON FUNCTION public.admin_users_sync_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_new_document() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_settings_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_user_subscription_request() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_lawyer_verification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalc_lawyer_rating() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.referral_on_request_approved() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.referral_on_transaction_success() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_referral_reward(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_admin_role_for_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_due_subscriptions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gen_referral_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- (b) Admin-gated RPCs: signed-in only (each re-checks has_role internally).
REVOKE ALL ON FUNCTION public.admin_mark_reward_paid(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_referral_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_reward_type(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_toggle_referral_code(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_subscription_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.new_rule_version(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_legal_rule(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpublish_legal_rule(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_legal_rule(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_reward_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_reward_type(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_referral_code(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_subscription_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.new_rule_version(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_legal_rule(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_legal_rule(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_legal_rule(uuid, text) TO authenticated;

-- (c) Signed-in user RPCs: authenticated only.
REVOKE ALL ON FUNCTION public.attach_referral_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_referral_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_calc_credit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_free_trial() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_access_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_referral_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_referral_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_platform_entitlements() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_reward_type(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_case_draft(text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_document(text, text, numeric, integer, integer, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_document(text, text, numeric, integer, integer, numeric, text, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_calc_credit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_free_trial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_access_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_entitlements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_reward_type(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_case_draft(text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_document(text, text, numeric, integer, integer, numeric, text, text, date, date) TO authenticated;

-- (d) Deliberately public, read-only lookups used by anonymous pages/API.
REVOKE ALL ON FUNCTION public.verify_document(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_legal_rule(text, text, date, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_document(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_legal_rule(text, text, date, text, text, text) TO anon, authenticated;

-- Server-side jobs keep access to the internal helpers.
GRANT EXECUTE ON FUNCTION public.grant_referral_reward(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_admin_role_for_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;