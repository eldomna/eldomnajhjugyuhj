
-- 1. admin_users table — source of truth for admin access (email-based)
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'admin',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX admin_users_email_lower_idx ON public.admin_users (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage admin_users
CREATE POLICY "admins read admin_users" ON public.admin_users
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert admin_users" ON public.admin_users
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update admin_users" ON public.admin_users
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete admin_users" ON public.admin_users
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER admin_users_touch_updated
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Seed primary admin
INSERT INTO public.admin_users (email, status)
VALUES ('othmanahmed27@gmail.com', 'active')
ON CONFLICT (email) DO UPDATE SET status = 'active';

-- 3. Function: grant/revoke admin role in user_roles based on admin_users
CREATE OR REPLACE FUNCTION public.sync_admin_role_for_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_active boolean;
BEGIN
  IF _email IS NULL OR _email = '' THEN RETURN; END IF;

  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE lower(email) = lower(_email) AND status = 'active'
  ) INTO v_active;

  IF v_active THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'admin';
  END IF;
END;
$$;

-- 4. Trigger on admin_users: sync user_roles whenever an admin is added/changed/removed
CREATE OR REPLACE FUNCTION public.admin_users_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_admin_role_for_email(OLD.email);
    RETURN OLD;
  END IF;

  PERFORM public.sync_admin_role_for_email(NEW.email);
  IF TG_OP = 'UPDATE' AND lower(OLD.email) <> lower(NEW.email) THEN
    PERFORM public.sync_admin_role_for_email(OLD.email);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER admin_users_sync_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.admin_users_sync_trigger();

-- 5. Update handle_new_user: grant admin role on signup if email is whitelisted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, mobile_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'mobile_number'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE lower(email) = lower(COALESCE(NEW.email, '')) AND status = 'active'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Backfill: if the primary admin already has an auth.users row, grant role now
SELECT public.sync_admin_role_for_email('othmanahmed27@gmail.com');
