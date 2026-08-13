-- 1) Settings: commission 5% + withdrawal minimums
ALTER TABLE public.referral_settings
  ADD COLUMN IF NOT EXISTS min_withdraw_sar numeric NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS min_withdraw_yer numeric NOT NULL DEFAULT 1000;
UPDATE public.referral_settings SET commission_percent = 5 WHERE id = 1 AND commission_percent = 10;

-- 2) Wallet usage on subscription requests
ALTER TABLE public.subscription_requests
  ADD COLUMN IF NOT EXISTS wallet_used numeric NOT NULL DEFAULT 0;

-- 3) Withdrawal requests
CREATE TABLE IF NOT EXISTS public.referral_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'YER',
  method text,
  account_details text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referral_withdrawals TO authenticated;
GRANT ALL ON public.referral_withdrawals TO service_role;
ALTER TABLE public.referral_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own withdrawals read" ON public.referral_withdrawals;
CREATE POLICY "own withdrawals read" ON public.referral_withdrawals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_referral_withdrawals_touch ON public.referral_withdrawals;
CREATE TRIGGER trg_referral_withdrawals_touch BEFORE UPDATE ON public.referral_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Notification helper
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _type text, _title text, _message text, _severity text DEFAULT 'info', _link text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_notifications (user_id, type, title, message, severity, link)
  VALUES (_user_id, _type, _title, _message, _severity, _link);
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- 5) Notify on commission approval / wallet credit
CREATE OR REPLACE FUNCTION public.notify_reward_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.kind = 'wallet_credit' THEN
    PERFORM public.notify_user(NEW.referrer_id, 'referral.credit', 'تمت إضافة رصيد إحالة',
      'أُضيف ' || NEW.amount::text || ' ' || COALESCE(NEW.currency,'YER') || ' إلى محفظتك.', 'success', '/referrals');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved','paid','granted') THEN
      PERFORM public.notify_user(NEW.referrer_id, 'referral.reward.' || NEW.status, 'تحديث مكافأة الإحالة',
        CASE WHEN NEW.kind = 'free_subscription' THEN 'تم اعتماد اشتراك مجاني (' || COALESCE(NEW.free_days,0)::text || ' يوم).'
             ELSE 'تم اعتماد مكافأة بقيمة ' || COALESCE(NEW.amount,0)::text || ' ' || COALESCE(NEW.currency,'YER') || '.' END,
        'success', '/referrals');
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM public.notify_user(NEW.referrer_id, 'referral.reward.cancelled', 'تم إلغاء مكافأة إحالة',
        COALESCE(NEW.notes, 'أُلغيت المكافأة بسبب إلغاء الاشتراك أو استرداد المبلغ.'), 'warning', '/referrals');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_reward_change ON public.referral_rewards;
CREATE TRIGGER trg_notify_reward_change AFTER INSERT OR UPDATE ON public.referral_rewards
  FOR EACH ROW EXECUTE FUNCTION public.notify_reward_change();

-- 6) Reverse referral rewards on refund / cancellation
CREATE OR REPLACE FUNCTION public.reverse_referral_reward(_referred_user uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref public.referrals%ROWTYPE; r record;
BEGIN
  SELECT * INTO v_ref FROM public.referrals WHERE referred_user_id = _referred_user;
  IF v_ref.id IS NULL THEN RETURN; END IF;

  FOR r IN SELECT * FROM public.referral_rewards
            WHERE referral_id = v_ref.id AND status IN ('pending','approved') LOOP
    IF r.kind = 'wallet_credit' THEN
      UPDATE public.wallet_balances SET balance = GREATEST(balance - COALESCE(r.amount,0), 0)
        WHERE user_id = r.referrer_id AND currency = COALESCE(r.currency,'YER');
      INSERT INTO public.wallet_transactions (user_id, amount, currency, kind, reference_id, notes)
      VALUES (r.referrer_id, -COALESCE(r.amount,0), COALESCE(r.currency,'YER'), 'reversal', r.id,
              COALESCE(_reason, 'إلغاء رصيد إحالة'));
    END IF;
    UPDATE public.referral_rewards
       SET status = 'cancelled', notes = COALESCE(_reason, 'إلغاء/استرداد الاشتراك')
     WHERE id = r.id;
  END LOOP;

  UPDATE public.referrals SET status = 'reversed' WHERE id = v_ref.id AND status = 'converted';
END; $$;
REVOKE EXECUTE ON FUNCTION public.reverse_referral_reward(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.referral_on_transaction_reversed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('refunded','cancelled','failed','chargeback')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.reverse_referral_reward(NEW.user_id, 'استرداد أو إلغاء عملية الدفع');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_referral_txn_reversed ON public.billing_transactions;
CREATE TRIGGER trg_referral_txn_reversed AFTER INSERT OR UPDATE ON public.billing_transactions
  FOR EACH ROW EXECUTE FUNCTION public.referral_on_transaction_reversed();

CREATE OR REPLACE FUNCTION public.referral_on_request_reversed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('rejected','refunded','cancelled') AND OLD.status = 'approved' THEN
    PERFORM public.reverse_referral_reward(NEW.user_id, 'إلغاء أو استرداد الاشتراك');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_referral_request_reversed ON public.subscription_requests;
CREATE TRIGGER trg_referral_request_reversed AFTER UPDATE ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.referral_on_request_reversed();

-- Ensure conversion triggers exist (commission/credit granting)
DROP TRIGGER IF EXISTS trg_referral_request_approved ON public.subscription_requests;
CREATE TRIGGER trg_referral_request_approved AFTER UPDATE ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.referral_on_request_approved();
DROP TRIGGER IF EXISTS trg_referral_txn_success ON public.billing_transactions;
CREATE TRIGGER trg_referral_txn_success AFTER INSERT OR UPDATE ON public.billing_transactions
  FOR EACH ROW EXECUTE FUNCTION public.referral_on_transaction_success();

-- 7) Spend wallet credit on a subscription
CREATE OR REPLACE FUNCTION public.spend_wallet_credit(_amount numeric, _currency text, _notes text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_cur text; v_bal numeric; v_use numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  v_cur := CASE WHEN upper(COALESCE(_currency,'YER')) = 'SAR' THEN 'SAR' ELSE 'YER' END;
  SELECT balance INTO v_bal FROM public.wallet_balances WHERE user_id = v_uid AND currency = v_cur;
  v_use := LEAST(GREATEST(COALESCE(_amount,0),0), COALESCE(v_bal,0));
  IF v_use <= 0 THEN RETURN 0; END IF;
  UPDATE public.wallet_balances SET balance = balance - v_use WHERE user_id = v_uid AND currency = v_cur;
  INSERT INTO public.wallet_transactions (user_id, amount, currency, kind, notes)
  VALUES (v_uid, -v_use, v_cur, 'spend', COALESCE(_notes, 'استخدام رصيد الإحالات في الاشتراك'));
  PERFORM public.notify_user(v_uid, 'referral.credit.spent', 'تم استخدام رصيد الإحالات',
    'استُخدم ' || v_use::text || ' ' || v_cur || ' من رصيدك لخصم قيمة الاشتراك.', 'info', '/referrals');
  RETURN v_use;
END; $$;
GRANT EXECUTE ON FUNCTION public.spend_wallet_credit(numeric, text, text) TO authenticated;

-- 8) Request a withdrawal
CREATE OR REPLACE FUNCTION public.request_withdrawal(_currency text, _amount numeric, _method text DEFAULT NULL, _account_details text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_cur text; v_bal numeric; v_min numeric; v_pending numeric; v_id uuid; v_s public.referral_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  v_cur := CASE WHEN upper(COALESCE(_currency,'YER')) = 'SAR' THEN 'SAR' ELSE 'YER' END;
  SELECT * INTO v_s FROM public.referral_settings WHERE id = 1;
  v_min := CASE WHEN v_cur = 'SAR' THEN COALESCE(v_s.min_withdraw_sar,200) ELSE COALESCE(v_s.min_withdraw_yer,1000) END;
  IF COALESCE(_amount,0) < v_min THEN
    RAISE EXCEPTION 'الحد الأدنى للسحب هو % %', v_min, v_cur;
  END IF;
  SELECT COALESCE(balance,0) INTO v_bal FROM public.wallet_balances WHERE user_id = v_uid AND currency = v_cur;
  SELECT COALESCE(SUM(amount),0) INTO v_pending FROM public.referral_withdrawals
    WHERE user_id = v_uid AND currency = v_cur AND status IN ('pending','approved');
  IF COALESCE(v_bal,0) - v_pending < _amount THEN
    RAISE EXCEPTION 'الرصيد المتاح غير كافٍ';
  END IF;
  INSERT INTO public.referral_withdrawals (user_id, amount, currency, method, account_details)
  VALUES (v_uid, _amount, v_cur, _method, _account_details)
  RETURNING id INTO v_id;
  PERFORM public.notify_user(v_uid, 'referral.withdrawal.requested', 'تم استلام طلب السحب',
    'طلب سحب ' || _amount::text || ' ' || v_cur || ' قيد المراجعة من الإدارة.', 'info', '/referrals');
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(text, numeric, text, text) TO authenticated;

-- 9) Admin: review withdrawal
CREATE OR REPLACE FUNCTION public.admin_review_withdrawal(_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.referral_withdrawals%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF _status NOT IN ('approved','rejected','paid') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO v FROM public.referral_withdrawals WHERE id = _id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v.status = 'paid' THEN RAISE EXCEPTION 'Already paid'; END IF;

  IF _status = 'paid' THEN
    UPDATE public.wallet_balances SET balance = GREATEST(balance - v.amount, 0)
      WHERE user_id = v.user_id AND currency = v.currency;
    INSERT INTO public.wallet_transactions (user_id, amount, currency, kind, reference_id, notes)
    VALUES (v.user_id, -v.amount, v.currency, 'withdrawal', v.id, COALESCE(_notes,'صرف طلب سحب'));
  END IF;

  UPDATE public.referral_withdrawals
     SET status = _status, admin_notes = COALESCE(_notes, admin_notes),
         reviewed_by = auth.uid(), reviewed_at = now(),
         paid_at = CASE WHEN _status = 'paid' THEN now() ELSE paid_at END
   WHERE id = _id;

  PERFORM public.notify_user(v.user_id, 'referral.withdrawal.' || _status,
    CASE _status WHEN 'approved' THEN 'تم اعتماد طلب السحب'
                 WHEN 'rejected' THEN 'تم رفض طلب السحب'
                 ELSE 'تم صرف طلب السحب' END,
    COALESCE(_notes, 'طلب سحب ' || v.amount::text || ' ' || v.currency),
    CASE WHEN _status = 'rejected' THEN 'warning' ELSE 'success' END, '/referrals');
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_review_withdrawal(uuid, text, text) TO authenticated;

-- 10) Admin: adjust or cancel a commission/reward
CREATE OR REPLACE FUNCTION public.admin_adjust_reward(_reward_id uuid, _amount numeric DEFAULT NULL, _status text DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.referral_rewards%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  SELECT * INTO v FROM public.referral_rewards WHERE id = _reward_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Reward not found'; END IF;
  IF _status IS NOT NULL AND _status NOT IN ('pending','approved','cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  IF _status = 'cancelled' AND v.kind = 'wallet_credit' AND v.status <> 'cancelled' THEN
    UPDATE public.wallet_balances SET balance = GREATEST(balance - COALESCE(v.amount,0), 0)
      WHERE user_id = v.referrer_id AND currency = COALESCE(v.currency,'YER');
    INSERT INTO public.wallet_transactions (user_id, amount, currency, kind, reference_id, notes)
    VALUES (v.referrer_id, -COALESCE(v.amount,0), COALESCE(v.currency,'YER'), 'reversal', v.id, COALESCE(_notes,'إلغاء مكافأة'));
  END IF;

  UPDATE public.referral_rewards
     SET amount = COALESCE(_amount, amount),
         status = COALESCE(_status, status),
         notes = COALESCE(_notes, notes)
   WHERE id = _reward_id;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_adjust_reward(uuid, numeric, text, text) TO authenticated;

-- 11) Admin: withdrawals list with user info
CREATE OR REPLACE FUNCTION public.admin_withdrawals()
RETURNS TABLE(id uuid, user_id uuid, full_name text, email text, amount numeric, currency text,
              method text, account_details text, status text, admin_notes text, created_at timestamptz, paid_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  RETURN QUERY
  SELECT w.id, w.user_id, p.full_name, p.email, w.amount, w.currency, w.method, w.account_details,
         w.status, w.admin_notes, w.created_at, w.paid_at
    FROM public.referral_withdrawals w
    LEFT JOIN public.profiles p ON p.id = w.user_id
   ORDER BY w.created_at DESC;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_withdrawals() TO authenticated;

-- 12) User stats incl. withdrawals & spend
CREATE OR REPLACE FUNCTION public.get_my_wallet_summary()
RETURNS TABLE(currency text, balance numeric, spent numeric, withdrawn numeric, pending_withdraw numeric, min_withdraw numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_s public.referral_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT * INTO v_s FROM public.referral_settings WHERE id = 1;
  RETURN QUERY
  SELECT c.cur,
    COALESCE((SELECT w.balance FROM public.wallet_balances w WHERE w.user_id = v_uid AND w.currency = c.cur),0),
    COALESCE((SELECT -SUM(t.amount) FROM public.wallet_transactions t WHERE t.user_id = v_uid AND t.currency = c.cur AND t.kind = 'spend'),0),
    COALESCE((SELECT SUM(rw.amount) FROM public.referral_withdrawals rw WHERE rw.user_id = v_uid AND rw.currency = c.cur AND rw.status = 'paid'),0),
    COALESCE((SELECT SUM(rw.amount) FROM public.referral_withdrawals rw WHERE rw.user_id = v_uid AND rw.currency = c.cur AND rw.status IN ('pending','approved')),0),
    CASE WHEN c.cur = 'SAR' THEN COALESCE(v_s.min_withdraw_sar,200) ELSE COALESCE(v_s.min_withdraw_yer,1000) END
  FROM (VALUES ('SAR'),('YER')) AS c(cur);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_wallet_summary() TO authenticated;