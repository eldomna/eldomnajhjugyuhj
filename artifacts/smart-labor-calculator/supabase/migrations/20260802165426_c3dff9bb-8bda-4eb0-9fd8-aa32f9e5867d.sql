REVOKE EXECUTE ON FUNCTION public.spend_wallet_credit(numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(text, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_withdrawal(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_reward(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_withdrawals() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_wallet_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_reward_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.referral_on_transaction_reversed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.referral_on_request_reversed() FROM PUBLIC, anon, authenticated;