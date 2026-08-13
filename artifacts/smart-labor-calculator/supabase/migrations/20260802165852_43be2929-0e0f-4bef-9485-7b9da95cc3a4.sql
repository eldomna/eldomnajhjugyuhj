CREATE OR REPLACE FUNCTION public.consume_free_trial()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Atomic: lock this user's profile row so concurrent calls serialize here.
  SELECT mobile_number, email, country, free_trial_used
    INTO v_phone, v_email, v_country, v_flag
    FROM public.profiles WHERE id = v_uid
    FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

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

REVOKE EXECUTE ON FUNCTION public.consume_free_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_free_trial() TO authenticated;