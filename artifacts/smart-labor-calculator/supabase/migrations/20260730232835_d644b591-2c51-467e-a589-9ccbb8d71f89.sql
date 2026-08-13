-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  mobile_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Calculations
CREATE TABLE public.calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employer_name TEXT NOT NULL,
  monthly_salary NUMERIC NOT NULL,
  service_years INTEGER NOT NULL DEFAULT 0,
  service_months INTEGER NOT NULL DEFAULT 0,
  day_overtime_hours NUMERIC NOT NULL DEFAULT 0,
  night_overtime_hours NUMERIC NOT NULL DEFAULT 0,
  unused_leave_days NUMERIC NOT NULL DEFAULT 0,
  daily_rate NUMERIC NOT NULL,
  hourly_rate NUMERIC NOT NULL,
  total_service_years NUMERIC NOT NULL,
  eos_benefit NUMERIC NOT NULL,
  day_overtime_amount NUMERIC NOT NULL,
  night_overtime_amount NUMERIC NOT NULL,
  leave_compensation NUMERIC NOT NULL,
  total_due NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculations TO authenticated;
GRANT ALL ON public.calculations TO service_role;
ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calculations" ON public.calculations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_calculations_user ON public.calculations(user_id, created_at DESC);

-- New user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Visitor analytics (page views)
CREATE TABLE public.page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path text NOT NULL,
  referrer text,
  user_agent text,
  user_id uuid,
  session_id text,
  country text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.page_views TO authenticated;
GRANT INSERT ON public.page_views TO anon;
GRANT ALL ON public.page_views TO service_role;

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert page views"
  ON public.page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admins can read page views"
  ON public.page_views FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX page_views_created_at_idx ON public.page_views (created_at DESC);
CREATE INDEX page_views_path_idx ON public.page_views (path);

CREATE POLICY "admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can view all calculations"
  ON public.calculations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Audit log for admin actions
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins write audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND actor_id = auth.uid());

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- Sequence for serial numbers
CREATE SEQUENCE IF NOT EXISTS public.document_serial_seq;

-- Documents registry
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number text NOT NULL UNIQUE,
  year integer NOT NULL,
  seq integer NOT NULL,
  employee_name text,
  employer_name text,
  monthly_salary numeric,
  service_years integer,
  service_months integer,
  total_amount numeric NOT NULL,
  created_by uuid,
  custom_clauses text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner or admin reads document"
  ON public.documents FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX documents_serial_idx ON public.documents (serial_number);
CREATE INDEX documents_created_at_idx ON public.documents (created_at DESC);

CREATE OR REPLACE FUNCTION public.register_document(
  p_employee_name text,
  p_employer_name text,
  p_monthly_salary numeric,
  p_service_years integer,
  p_service_months integer,
  p_total_amount numeric,
  p_custom_clauses text DEFAULT NULL
)
RETURNS TABLE (serial_number text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM now())::int;
  v_seq integer := nextval('public.document_serial_seq');
  v_serial text := 'YML-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
  v_created timestamp with time zone := now();
BEGIN
  INSERT INTO public.documents (
    serial_number, year, seq, employee_name, employer_name,
    monthly_salary, service_years, service_months, total_amount,
    custom_clauses, created_by, created_at
  ) VALUES (
    v_serial, v_year, v_seq, p_employee_name, p_employer_name,
    p_monthly_salary, p_service_years, p_service_months, p_total_amount,
    p_custom_clauses, auth.uid(), v_created
  );
  RETURN QUERY SELECT v_serial, v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.register_document(text, text, numeric, integer, integer, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.register_document(text, text, numeric, integer, integer, numeric, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_document(p_serial text)
RETURNS TABLE (
  serial_number text,
  employee_name text,
  total_amount numeric,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.serial_number, d.employee_name, d.total_amount, d.created_at
  FROM public.documents d
  WHERE d.serial_number = upper(trim(p_serial))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.verify_document(text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_document(text) TO anon, authenticated;

-- Platform settings (singleton: id = 1)
CREATE TABLE public.platform_settings (
  id integer NOT NULL PRIMARY KEY DEFAULT 1,
  platform_name text NOT NULL DEFAULT 'منصة حاسبة الحقوق العمالية اليمنية',
  logo_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id = 1)
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads platform settings"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admins update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert platform settings"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS default_clauses text,
  ADD COLUMN IF NOT EXISTS report_footer text;