-- ============ إعدادات برنامج الإحالات ============
CREATE TABLE public.referral_settings (
  id integer PRIMARY KEY DEFAULT 1,
  discount_percent numeric NOT NULL DEFAULT 10,
  credit_per_referral_sar numeric NOT NULL DEFAULT 2,
  credit_per_referral_yer numeric NOT NULL DEFAULT 200,
  commission_percent numeric NOT NULL DEFAULT 10,
  free_tier_1_count integer NOT NULL DEFAULT 10,
  free_tier_1_days integer NOT NULL DEFAULT 30,
  free_tier_2_count integer NOT NULL DEFAULT 25,
  free_tier_2_days integer NOT NULL DEFAULT 90,
  free_tier_3_count integer NOT NULL DEFAULT 50,
  free_tier_3_days integer NOT NULL DEFAULT 365,
  allow_user_change_reward boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.referral_settings TO anon, authenticated;
GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_settings_read" ON public.referral_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "referral_settings_admin_write" ON public.referral_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.referral_settings (id) VALUES (1);
CREATE TRIGGER trg_referral_settings_touch BEFORE UPDATE ON public.referral_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ رموز الإحالة ============
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  reward_type text NOT NULL DEFAULT 'wallet_credit'
    CHECK (reward_type IN ('wallet_credit','free_subscription','commission')),
  is_active boolean NOT NULL DEFAULT true,
  reward_chosen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_codes_own_read" ON public.referral_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "referral_codes_own_insert" ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "referral_codes_admin_update" ON public.referral_codes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_referral_codes_touch BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ الإحالات ============
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','converted')),
  order_amount numeric,
  discount_amount numeric,
  currency text,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);
CREATE INDEX idx_referrals_referrer ON public.referrals (referrer_id);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_own_read" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ المحفظة ============
CREATE TABLE public.wallet_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  currency text NOT NULL CHECK (currency IN ('SAR','YER')),
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency)
);
GRANT SELECT ON public.wallet_balances TO authenticated;
GRANT ALL ON public.wallet_balances TO service_role;
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_balances_own_read" ON public.wallet_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_wallet_balances_touch BEFORE UPDATE ON public.wallet_balances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL CHECK (currency IN ('SAR','YER')),
  kind text NOT NULL CHECK (kind IN ('referral_credit','referral_commission','admin_adjust','spend','payout')),
  reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_tx_user ON public.wallet_transactions (user_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_tx_own_read" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ مكافآت الإحالة ============
CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('wallet_credit','commission','free_subscription')),
  amount numeric,
  currency text,
  free_days integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','granted')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_rewards_referrer ON public.referral_rewards (referrer_id, created_at DESC);
GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_rewards_own_read" ON public.referral_rewards FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "referral_rewards_admin_update" ON public.referral_rewards FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_referral_rewards_touch BEFORE UPDATE ON public.referral_rewards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ربط الإحالة بعمليات الدفع القائمة (إضافة حقول فقط) ============
ALTER TABLE public.subscription_requests
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric;
ALTER TABLE public.billing_transactions
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric;

-- ============ الدوال ============
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_code text; v_exists boolean;
BEGIN
  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END; $$;

-- رمز الإحالة الخاص بي (ينشئه عند أول طلب)
CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS TABLE(code text, reward_type text, is_active boolean, reward_chosen_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (v_uid, public.gen_referral_code())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN QUERY SELECT c.code, c.reward_type, c.is_active, c.reward_chosen_at
    FROM public.referral_codes c WHERE c.user_id = v_uid;
END; $$;

-- اختيار/تغيير نوع المكافأة (خيار واحد فقط)
CREATE OR REPLACE FUNCTION public.set_my_reward_type(_type text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_allow boolean; v_chosen timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF _type NOT IN ('wallet_credit','free_subscription','commission') THEN
    RAISE EXCEPTION 'Invalid reward type';
  END IF;
  SELECT allow_user_change_reward INTO v_allow FROM public.referral_settings WHERE id = 1;
  SELECT reward_chosen_at INTO v_chosen FROM public.referral_codes WHERE user_id = v_uid;
  IF v_chosen IS NOT NULL AND NOT COALESCE(v_allow,true) THEN
    RAISE EXCEPTION 'Changing reward type is disabled by admin';
  END IF;
  INSERT INTO public.referral_codes (user_id, code, reward_type, reward_chosen_at)
  VALUES (v_uid, public.gen_referral_code(), _type, now())
  ON CONFLICT (user_id) DO UPDATE SET reward_type = _type, reward_chosen_at = now();
  RETURN true;
END; $$;

-- تسجيل استخدام رمز إحالة عند إنشاء الحساب
CREATE OR REPLACE FUNCTION public.attach_referral_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.referral_codes%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR _code IS NULL OR btrim(_code) = '' THEN RETURN false; END IF;
  SELECT * INTO v_row FROM public.referral_codes
   WHERE code = upper(btrim(_code)) AND is_active;
  IF v_row.id IS NULL OR v_row.user_id = v_uid THEN RETURN false; END IF;
  INSERT INTO public.referrals (code_id, referrer_id, referred_user_id)
  VALUES (v_row.id, v_row.user_id, v_uid)
  ON CONFLICT (referred_user_id) DO NOTHING;
  RETURN true;
END; $$;

-- التحقق من صلاحية رمز وإرجاع نسبة الخصم
CREATE OR REPLACE FUNCTION public.check_referral_code(_code text)
RETURNS TABLE(valid boolean, discount_percent numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_ok boolean; v_pct numeric;
BEGIN
  SELECT rs.discount_percent INTO v_pct FROM public.referral_settings rs WHERE rs.id = 1;
  SELECT EXISTS (
    SELECT 1 FROM public.referral_codes c
     WHERE c.code = upper(btrim(COALESCE(_code,''))) AND c.is_active
       AND (v_uid IS NULL OR c.user_id <> v_uid)
  ) INTO v_ok;
  RETURN QUERY SELECT v_ok, COALESCE(v_pct, 10);
END; $$;

-- منح المكافأة بعد نجاح الدفع
CREATE OR REPLACE FUNCTION public.grant_referral_reward(_referred_user uuid, _amount numeric, _currency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_code public.referral_codes%ROWTYPE;
  v_s public.referral_settings%ROWTYPE;
  v_cur text := CASE WHEN upper(COALESCE(_currency,'YER')) = 'SAR' THEN 'SAR' ELSE 'YER' END;
  v_amount numeric;
  v_count integer;
  v_days integer;
BEGIN
  SELECT * INTO v_s FROM public.referral_settings WHERE id = 1;
  IF NOT COALESCE(v_s.is_active,true) THEN RETURN; END IF;

  SELECT * INTO v_ref FROM public.referrals WHERE referred_user_id = _referred_user;
  IF v_ref.id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_code FROM public.referral_codes WHERE id = v_ref.code_id;
  IF v_code.id IS NULL OR NOT v_code.is_active THEN RETURN; END IF;

  UPDATE public.referrals SET
    status = 'converted',
    converted_at = COALESCE(converted_at, now()),
    order_amount = COALESCE(_amount, order_amount),
    currency = v_cur,
    discount_amount = COALESCE(discount_amount, ROUND(COALESCE(_amount,0) * COALESCE(v_s.discount_percent,10) / 100, 2))
  WHERE id = v_ref.id;

  IF v_code.reward_type = 'wallet_credit' THEN
    v_amount := CASE WHEN v_cur = 'SAR' THEN v_s.credit_per_referral_sar ELSE v_s.credit_per_referral_yer END;
    INSERT INTO public.referral_rewards (referrer_id, referral_id, kind, amount, currency, status)
    VALUES (v_code.user_id, v_ref.id, 'wallet_credit', v_amount, v_cur, 'approved');
    INSERT INTO public.wallet_balances (user_id, currency, balance) VALUES (v_code.user_id, v_cur, v_amount)
    ON CONFLICT (user_id, currency) DO UPDATE SET balance = public.wallet_balances.balance + v_amount;
    INSERT INTO public.wallet_transactions (user_id, amount, currency, kind, reference_id, notes)
    VALUES (v_code.user_id, v_amount, v_cur, 'referral_credit', v_ref.id, 'رصيد إحالة');

  ELSIF v_code.reward_type = 'commission' THEN
    v_amount := ROUND(COALESCE(_amount,0) * COALESCE(v_s.commission_percent,10) / 100, 2);
    INSERT INTO public.referral_rewards (referrer_id, referral_id, kind, amount, currency, status)
    VALUES (v_code.user_id, v_ref.id, 'commission', v_amount, v_cur, 'pending');

  ELSE
    SELECT COUNT(*) INTO v_count FROM public.referrals
      WHERE referrer_id = v_code.user_id AND status = 'converted';
    v_days := NULL;
    IF v_count = v_s.free_tier_3_count THEN v_days := v_s.free_tier_3_days;
    ELSIF v_count = v_s.free_tier_2_count THEN v_days := v_s.free_tier_2_days;
    ELSIF v_count = v_s.free_tier_1_count THEN v_days := v_s.free_tier_1_days;
    END IF;
    IF v_days IS NOT NULL THEN
      INSERT INTO public.referral_rewards (referrer_id, referral_id, kind, free_days, status, notes)
      VALUES (v_code.user_id, v_ref.id, 'free_subscription', v_days, 'pending',
              'استحقاق اشتراك مجاني بعد ' || v_count || ' إحالة ناجحة');
    END IF;
  END IF;
END; $$;

-- محفّز: عند اعتماد طلب اشتراك (منظومة الدفع اليمنية كما هي)
CREATE OR REPLACE FUNCTION public.referral_on_request_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.grant_referral_reward(NEW.user_id, NEW.amount, NEW.currency);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_referral_on_request_approved
  AFTER UPDATE ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.referral_on_request_approved();

-- محفّز: عند نجاح عملية دفع سعودية
CREATE OR REPLACE FUNCTION public.referral_on_transaction_success()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('succeeded','paid','completed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.grant_referral_reward(NEW.user_id, NEW.amount, NEW.currency);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_referral_on_transaction_success
  AFTER INSERT OR UPDATE ON public.billing_transactions
  FOR EACH ROW EXECUTE FUNCTION public.referral_on_transaction_success();

-- إحصائيات المستخدم
CREATE OR REPLACE FUNCTION public.get_my_referral_stats()
RETURNS TABLE(
  code text, reward_type text, is_active boolean, reward_chosen_at timestamptz,
  uses_count integer, converted_count integer,
  total_discounts numeric, total_sales numeric,
  wallet_sar numeric, wallet_yer numeric,
  commission_pending numeric, commission_paid numeric,
  free_rewards_count integer, allow_change boolean, discount_percent numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_c public.referral_codes%ROWTYPE; v_s public.referral_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT * INTO v_s FROM public.referral_settings WHERE id = 1;
  SELECT * INTO v_c FROM public.referral_codes WHERE user_id = v_uid;
  RETURN QUERY
  SELECT
    v_c.code, v_c.reward_type, COALESCE(v_c.is_active,true), v_c.reward_chosen_at,
    (SELECT COUNT(*)::int FROM public.referrals r WHERE r.referrer_id = v_uid),
    (SELECT COUNT(*)::int FROM public.referrals r WHERE r.referrer_id = v_uid AND r.status='converted'),
    (SELECT COALESCE(SUM(r.discount_amount),0) FROM public.referrals r WHERE r.referrer_id = v_uid),
    (SELECT COALESCE(SUM(r.order_amount),0) FROM public.referrals r WHERE r.referrer_id = v_uid AND r.status='converted'),
    (SELECT COALESCE(SUM(w.balance),0) FROM public.wallet_balances w WHERE w.user_id = v_uid AND w.currency='SAR'),
    (SELECT COALESCE(SUM(w.balance),0) FROM public.wallet_balances w WHERE w.user_id = v_uid AND w.currency='YER'),
    (SELECT COALESCE(SUM(rr.amount),0) FROM public.referral_rewards rr WHERE rr.referrer_id = v_uid AND rr.kind='commission' AND rr.status IN ('pending','approved')),
    (SELECT COALESCE(SUM(rr.amount),0) FROM public.referral_rewards rr WHERE rr.referrer_id = v_uid AND rr.kind='commission' AND rr.status='paid'),
    (SELECT COUNT(*)::int FROM public.referral_rewards rr WHERE rr.referrer_id = v_uid AND rr.kind='free_subscription'),
    COALESCE(v_s.allow_user_change_reward,true), COALESCE(v_s.discount_percent,10);
END; $$;

-- إحصائيات الإدارة لكل رمز
CREATE OR REPLACE FUNCTION public.admin_referral_overview()
RETURNS TABLE(
  code_id uuid, user_id uuid, full_name text, email text, code text,
  reward_type text, is_active boolean, uses_count integer, converted_count integer,
  total_sales numeric, total_discounts numeric, wallet_sar numeric, wallet_yer numeric,
  commission_pending numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  RETURN QUERY
  SELECT c.id, c.user_id, p.full_name, p.email, c.code, c.reward_type, c.is_active,
    (SELECT COUNT(*)::int FROM public.referrals r WHERE r.code_id = c.id),
    (SELECT COUNT(*)::int FROM public.referrals r WHERE r.code_id = c.id AND r.status='converted'),
    (SELECT COALESCE(SUM(r.order_amount),0) FROM public.referrals r WHERE r.code_id = c.id AND r.status='converted'),
    (SELECT COALESCE(SUM(r.discount_amount),0) FROM public.referrals r WHERE r.code_id = c.id),
    (SELECT COALESCE(SUM(w.balance),0) FROM public.wallet_balances w WHERE w.user_id = c.user_id AND w.currency='SAR'),
    (SELECT COALESCE(SUM(w.balance),0) FROM public.wallet_balances w WHERE w.user_id = c.user_id AND w.currency='YER'),
    (SELECT COALESCE(SUM(rr.amount),0) FROM public.referral_rewards rr WHERE rr.referrer_id = c.user_id AND rr.kind='commission' AND rr.status IN ('pending','approved'))
  FROM public.referral_codes c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  ORDER BY c.created_at DESC;
END; $$;

-- إجراءات الإدارة
CREATE OR REPLACE FUNCTION public.admin_set_reward_type(_user_id uuid, _type text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF _type NOT IN ('wallet_credit','free_subscription','commission') THEN
    RAISE EXCEPTION 'Invalid reward type';
  END IF;
  UPDATE public.referral_codes SET reward_type = _type WHERE user_id = _user_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_toggle_referral_code(_code_id uuid, _active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  UPDATE public.referral_codes SET is_active = _active WHERE id = _code_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_mark_reward_paid(_reward_id uuid, _notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.referral_rewards%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  SELECT * INTO v FROM public.referral_rewards WHERE id = _reward_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Reward not found'; END IF;
  UPDATE public.referral_rewards
     SET status = CASE WHEN v.kind = 'free_subscription' THEN 'granted' ELSE 'paid' END,
         notes = COALESCE(_notes, notes)
   WHERE id = _reward_id;
  IF v.kind = 'commission' THEN
    INSERT INTO public.wallet_transactions (user_id, amount, currency, kind, reference_id, notes)
    VALUES (v.referrer_id, v.amount, COALESCE(v.currency,'YER'), 'payout', v.id, COALESCE(_notes,'صرف عمولة'));
  END IF;
  RETURN true;
END; $$;