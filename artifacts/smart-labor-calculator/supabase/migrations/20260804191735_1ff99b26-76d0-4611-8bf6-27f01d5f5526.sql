CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_mobile text := NULLIF(NEW.raw_user_meta_data->>'mobile_number', '');
  v_country text := CASE WHEN upper(COALESCE(NEW.raw_user_meta_data->>'country','')) = 'SA' THEN 'SA' ELSE 'YE' END;
  v_name text := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
BEGIN
  -- رقم الجوال فريد؛ إن كان مستخدماً مسبقاً لا نُفشل التسجيل بل نُنشئ الملف بدون الرقم.
  IF v_mobile IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE mobile_number = v_mobile
  ) THEN
    v_mobile := NULL;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, full_name, email, mobile_number, country)
    VALUES (NEW.id, v_name, COALESCE(NEW.email, ''), v_mobile, v_country)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.profiles (id, full_name, email, mobile_number, country)
    VALUES (NEW.id, v_name, COALESCE(NEW.email, ''), NULL, v_country)
    ON CONFLICT (id) DO NOTHING;
  END;

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