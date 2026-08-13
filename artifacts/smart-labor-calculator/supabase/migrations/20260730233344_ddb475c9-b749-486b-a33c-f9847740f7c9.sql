CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  period text NOT NULL CHECK (period IN ('monthly','yearly')),
  price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'YER' CHECK (currency IN ('YER','SAR','USD')),
  duration_days integer NOT NULL DEFAULT 30,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active plans" ON public.subscription_plans FOR SELECT
  USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage plans" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER subscription_plans_touch BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.subscription_plans (code, name, period, price, currency, duration_days, description, sort_order) VALUES
  ('monthly', 'الاشتراك الشهري', 'monthly', 5000, 'YER', 30, 'وصول كامل لجميع الحاسبات والتقارير لمدة شهر.', 1),
  ('yearly',  'الاشتراك السنوي', 'yearly', 50000, 'YER', 365, 'وصول كامل لجميع الحاسبات والتقارير لمدة سنة كاملة.', 2);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_active_idx ON public.subscriptions (user_id, status, expires_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  full_name text,
  mobile_number text,
  transfer_reference text,
  receipt_url text,
  amount numeric(12,2),
  currency text NOT NULL DEFAULT 'YER' CHECK (currency IN ('YER','SAR','USD')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_requests_status_idx ON public.subscription_requests (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_requests TO authenticated;
GRANT ALL ON public.subscription_requests TO service_role;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own requests" ON public.subscription_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own requests" ON public.subscription_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins manage requests" ON public.subscription_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER subscription_requests_touch BEFORE UPDATE ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.free_trial_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_count integer NOT NULL DEFAULT 0,
  first_used_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.free_trial_usage TO authenticated;
GRANT ALL ON public.free_trial_usage TO service_role;
ALTER TABLE public.free_trial_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own trial usage" ON public.free_trial_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage trial usage" ON public.free_trial_usage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND status = 'active' AND expires_at > now()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_access_status()
RETURNS TABLE(is_subscribed boolean, expires_at timestamptz, trial_used integer, trial_limit integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
  v_used integer := 0;
  v_exp timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 0, 1;
    RETURN;
  END IF;
  SELECT s.expires_at INTO v_exp FROM public.subscriptions s
    WHERE s.user_id = v_uid AND s.status = 'active' AND s.expires_at > now()
    ORDER BY s.expires_at DESC LIMIT 1;
  SELECT p.mobile_number INTO v_phone FROM public.profiles p WHERE p.id = v_uid;
  IF v_phone IS NOT NULL THEN
    SELECT f.used_count INTO v_used FROM public.free_trial_usage f
      WHERE f.mobile_number = v_phone;
  END IF;
  RETURN QUERY SELECT (v_exp IS NOT NULL), v_exp, COALESCE(v_used,0), 1;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_access_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_access_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_free_trial()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
  v_used integer := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF public.has_active_subscription(v_uid) THEN RETURN true; END IF;
  SELECT mobile_number INTO v_phone FROM public.profiles WHERE id = v_uid;
  IF v_phone IS NULL OR v_phone = '' THEN RETURN false; END IF;
  SELECT used_count INTO v_used FROM public.free_trial_usage WHERE mobile_number = v_phone;
  IF COALESCE(v_used,0) >= 1 THEN RETURN false; END IF;
  INSERT INTO public.free_trial_usage (mobile_number, user_id, used_count)
  VALUES (v_phone, v_uid, 1)
  ON CONFLICT (mobile_number) DO UPDATE
    SET used_count = public.free_trial_usage.used_count + 1,
        last_used_at = now();
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_free_trial() FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_free_trial() TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_subscription_request(_request_id uuid, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.subscription_requests%ROWTYPE;
  v_days integer := 30;
  v_sub_id uuid;
  v_base timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  SELECT * INTO v_req FROM public.subscription_requests WHERE id = _request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already reviewed'; END IF;

  SELECT duration_days INTO v_days FROM public.subscription_plans WHERE id = v_req.plan_id;
  v_days := COALESCE(v_days, 30);

  SELECT MAX(expires_at) INTO v_base FROM public.subscriptions
    WHERE user_id = v_req.user_id AND status = 'active' AND expires_at > now();
  v_base := COALESCE(v_base, now());

  INSERT INTO public.subscriptions (user_id, plan_id, status, starts_at, expires_at, activated_by, notes)
  VALUES (v_req.user_id, v_req.plan_id, 'active', now(), v_base + make_interval(days => v_days), auth.uid(), _notes)
  RETURNING id INTO v_sub_id;

  UPDATE public.subscription_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        admin_notes = COALESCE(_notes, admin_notes)
    WHERE id = _request_id;

  RETURN v_sub_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_subscription_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_subscription_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_due_subscriptions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.subscriptions SET status = 'expired'
    WHERE status = 'active' AND expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.expire_due_subscriptions() FROM anon, authenticated;