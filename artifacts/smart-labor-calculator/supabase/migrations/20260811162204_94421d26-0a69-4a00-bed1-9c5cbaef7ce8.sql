-- 1) Country-scoped pricing
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS country text;

UPDATE public.subscription_plans SET country = 'YE' WHERE country IS NULL AND currency = 'YER';
UPDATE public.subscription_plans SET country = 'SA' WHERE country IS NULL AND currency = 'SAR';

-- Saudi plans (idempotent by code)
INSERT INTO public.subscription_plans (code, name, description, price, currency, period, duration_days, is_active, sort_order, country)
VALUES
  ('sa_single', 'الحسبة المنفردة', 'حسبة واحدة كاملة مع التقرير القانوني', 5, 'SAR', 'one_time', 1, true, 1, 'SA'),
  ('sa_monthly', 'الاشتراك الشهري', 'وصول كامل لجميع الحاسبات والتقارير لمدة شهر', 15, 'SAR', 'monthly', 30, true, 2, 'SA'),
  ('sa_yearly', 'الاشتراك السنوي', 'وصول كامل لجميع الحاسبات والتقارير لمدة سنة', 100, 'SAR', 'yearly', 365, true, 3, 'SA')
ON CONFLICT (code) DO UPDATE SET country = EXCLUDED.country, currency = EXCLUDED.currency, price = EXCLUDED.price;

ALTER TABLE public.subscription_plans ALTER COLUMN country SET NOT NULL;
CREATE INDEX IF NOT EXISTS subscription_plans_country_idx ON public.subscription_plans (country);

-- 2) No public (anonymous) price exposure
DROP POLICY IF EXISTS "Anyone reads active plans" ON public.subscription_plans;
REVOKE ALL ON public.subscription_plans FROM anon;

CREATE POLICY "Users read active plans of their own country"
ON public.subscription_plans FOR SELECT TO authenticated
USING (
  is_active
  AND country = (SELECT p.country FROM public.profiles p WHERE p.id = auth.uid())
);

-- 3) Country of record, server-side
CREATE OR REPLACE FUNCTION public.get_my_country()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT country FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.get_my_country() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_country() TO authenticated;

-- Users may set their country only while they have no active subscription/plan commitment
CREATE OR REPLACE FUNCTION public.set_my_country(_country text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
  v_locked boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _country IS NULL OR _country NOT IN ('SA','YE') THEN RAISE EXCEPTION 'invalid country'; END IF;

  SELECT country INTO v_current FROM public.profiles WHERE id = auth.uid();
  IF v_current IS NOT NULL AND v_current <> _country THEN
    SELECT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid() AND s.status = 'active' AND s.expires_at > now()
    ) OR EXISTS (
      SELECT 1 FROM public.subscription_requests r
      WHERE r.user_id = auth.uid() AND r.status = 'pending'
    ) INTO v_locked;
    IF v_locked THEN RAISE EXCEPTION 'country locked by an active or pending subscription'; END IF;
  END IF;

  UPDATE public.profiles SET country = _country, updated_at = now() WHERE id = auth.uid();
  RETURN _country;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_country(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_country(text) TO authenticated;

-- 4) Plans for the authenticated user's saved country only
CREATE OR REPLACE FUNCTION public.get_my_plans()
RETURNS TABLE (
  id uuid, code text, name text, description text,
  price numeric, currency text, period text, duration_days integer, sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.id, sp.code, sp.name, sp.description, sp.price, sp.currency, sp.period, sp.duration_days, sp.sort_order
  FROM public.subscription_plans sp
  WHERE sp.is_active
    AND sp.country = (SELECT p.country FROM public.profiles p WHERE p.id = auth.uid())
  ORDER BY sp.sort_order
$$;

REVOKE ALL ON FUNCTION public.get_my_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_plans() TO authenticated;

-- 5) Server-side authoritative subscription request creation
CREATE OR REPLACE FUNCTION public.create_subscription_request(
  _plan_id uuid,
  _payment_method_id uuid DEFAULT NULL,
  _full_name text DEFAULT NULL,
  _mobile_number text DEFAULT NULL,
  _transfer_reference text DEFAULT NULL,
  _receipt_url text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _use_wallet boolean DEFAULT true
)
RETURNS TABLE (request_id uuid, amount numeric, currency text, discount_amount numeric, wallet_used numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_country text;
  v_plan public.subscription_plans;
  v_percent numeric := 0;
  v_code text;
  v_discount numeric := 0;
  v_after numeric;
  v_wallet numeric := 0;
  v_spent numeric := 0;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT country INTO v_country FROM public.profiles WHERE id = v_uid;
  IF v_country IS NULL THEN RAISE EXCEPTION 'country_required'; END IF;

  SELECT * INTO v_plan FROM public.subscription_plans
  WHERE id = _plan_id AND is_active AND country = v_country;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'plan_not_available_for_country'; END IF;

  -- referral discount, resolved server-side
  SELECT COALESCE(rs.discount_percent, 0), rc.code
  INTO v_percent, v_code
  FROM public.referrals r
  JOIN public.referral_codes rc ON rc.id = r.referral_code_id
  CROSS JOIN public.referral_settings rs
  WHERE r.referred_user_id = v_uid AND r.status = 'pending' AND rs.id = 1 AND rs.is_active
  ORDER BY r.created_at DESC
  LIMIT 1;

  v_percent := COALESCE(v_percent, 0);
  v_discount := ROUND(v_plan.price * v_percent) / 100.0;
  v_after := GREATEST(0, v_plan.price - v_discount);

  IF _use_wallet THEN
    SELECT COALESCE(balance, 0) INTO v_wallet
    FROM public.wallet_balances WHERE user_id = v_uid AND currency = v_plan.currency;
    v_wallet := LEAST(COALESCE(v_wallet, 0), v_after);
    IF v_wallet > 0 THEN
      v_spent := COALESCE(public.spend_wallet_credit(v_wallet, v_plan.currency, 'خصم قيمة الاشتراك من رصيد الإحالات'), 0);
    END IF;
  END IF;

  INSERT INTO public.subscription_requests (
    user_id, plan_id, payment_method_id, full_name, mobile_number,
    transfer_reference, receipt_url, amount, currency, referral_code,
    discount_amount, wallet_used, admin_notes, status
  ) VALUES (
    v_uid, v_plan.id, _payment_method_id, NULLIF(btrim(_full_name), ''), NULLIF(btrim(_mobile_number), ''),
    NULLIF(btrim(_transfer_reference), ''), _receipt_url,
    GREATEST(0, v_after - v_spent), v_plan.currency, v_code,
    NULLIF(v_discount, 0), COALESCE(v_spent, 0), NULLIF(btrim(_notes), ''), 'pending'
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, GREATEST(0, v_after - v_spent), v_plan.currency, v_discount, COALESCE(v_spent, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.create_subscription_request(uuid, uuid, text, text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_subscription_request(uuid, uuid, text, text, text, text, text, boolean) TO authenticated;