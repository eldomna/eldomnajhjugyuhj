ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'YE',
  ADD COLUMN IF NOT EXISTS free_trial_used boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_country_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_country_check CHECK (country IN ('SA','YE'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_mobile_number_key
  ON public.profiles (mobile_number) WHERE mobile_number IS NOT NULL AND mobile_number <> '';

ALTER TABLE public.free_trial_usage ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS free_trial_usage_email_idx ON public.free_trial_usage (lower(email));

ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_period_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_period_check
  CHECK (period IN ('monthly','yearly','one_time'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_is_admin boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, mobile_number, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'mobile_number',
    CASE WHEN upper(COALESCE(NEW.raw_user_meta_data->>'country','')) = 'SA' THEN 'SA' ELSE 'YE' END
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE lower(email) = lower(COALESCE(NEW.email, '')) AND status = 'active'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_free_trial()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
  v_email text;
  v_country text;
  v_used integer := 0;
  v_flag boolean := false;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF public.has_active_subscription(v_uid) THEN RETURN true; END IF;

  SELECT mobile_number, email, country, free_trial_used
    INTO v_phone, v_email, v_country, v_flag
    FROM public.profiles WHERE id = v_uid;

  -- Yemen: no free trial, payment required
  IF COALESCE(v_country,'YE') = 'YE' THEN RETURN false; END IF;
  IF COALESCE(v_flag,false) THEN RETURN false; END IF;
  IF v_phone IS NULL OR v_phone = '' THEN RETURN false; END IF;

  SELECT COALESCE(SUM(used_count),0) INTO v_used
    FROM public.free_trial_usage
    WHERE mobile_number = v_phone
       OR (v_email IS NOT NULL AND v_email <> '' AND lower(email) = lower(v_email));

  IF COALESCE(v_used,0) >= 1 THEN
    UPDATE public.profiles SET free_trial_used = true WHERE id = v_uid;
    RETURN false;
  END IF;

  INSERT INTO public.free_trial_usage (mobile_number, user_id, used_count, email)
  VALUES (v_phone, v_uid, 1, v_email)
  ON CONFLICT (mobile_number) DO UPDATE
    SET used_count = public.free_trial_usage.used_count + 1,
        last_used_at = now(),
        email = COALESCE(public.free_trial_usage.email, EXCLUDED.email);

  UPDATE public.profiles SET free_trial_used = true WHERE id = v_uid;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_access_status()
 RETURNS TABLE(is_subscribed boolean, expires_at timestamp with time zone, trial_used integer, trial_limit integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
  v_email text;
  v_country text;
  v_used integer := 0;
  v_flag boolean := false;
  v_exp timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 0, 1;
    RETURN;
  END IF;
  SELECT s.expires_at INTO v_exp FROM public.subscriptions s
    WHERE s.user_id = v_uid AND s.status = 'active' AND s.expires_at > now()
    ORDER BY s.expires_at DESC LIMIT 1;
  SELECT p.mobile_number, p.email, p.country, p.free_trial_used
    INTO v_phone, v_email, v_country, v_flag
    FROM public.profiles p WHERE p.id = v_uid;

  IF COALESCE(v_country,'YE') = 'YE' THEN
    RETURN QUERY SELECT (v_exp IS NOT NULL), v_exp, 1, 0;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(f.used_count),0) INTO v_used FROM public.free_trial_usage f
    WHERE (v_phone IS NOT NULL AND f.mobile_number = v_phone)
       OR (v_email IS NOT NULL AND v_email <> '' AND lower(f.email) = lower(v_email));

  IF COALESCE(v_flag,false) AND COALESCE(v_used,0) = 0 THEN v_used := 1; END IF;

  RETURN QUERY SELECT (v_exp IS NOT NULL), v_exp, COALESCE(v_used,0), 1;
END;
$function$;