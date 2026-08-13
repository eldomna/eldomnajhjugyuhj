CREATE TABLE public.legal_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_number text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_review_date timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.legal_references TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_references TO authenticated;
GRANT ALL ON public.legal_references TO service_role;
ALTER TABLE public.legal_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read approved legal references"
  ON public.legal_references FOR SELECT
  USING (approval_status = 'approved' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage legal references"
  ON public.legal_references FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_touch_legal_references_updated_at
  BEFORE UPDATE ON public.legal_references
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.legal_references (article_number, title, summary, approval_status, sort_order) VALUES
  ('—',  'قانون العمل اليمني رقم (5) لسنة 1995 وتعديلاته', 'المرجع التشريعي العام للحقوق العمالية في الجمهورية اليمنية.', 'pending', 0),
  ('66', 'مكافأة نهاية الخدمة', 'مكافأة نهاية الخدمة تعادل أجر شهر عن كل سنة خدمة.', 'pending', 1),
  ('75', 'العمل الإضافي النهاري', 'أجر العمل الإضافي النهاري لا يقل عن 150% من الأجر العادي.', 'pending', 2),
  ('75', 'العمل الإضافي الليلي', 'أجر العمل الإضافي الليلي لا يقل عن 200% من الأجر العادي.', 'pending', 3),
  ('84', 'بدل الإجازات السنوية', 'استبدال الإجازة السنوية غير المستخدمة بأجرها نقداً.', 'pending', 4);

ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'YER',
  ADD COLUMN IF NOT EXISTS service_start_date date,
  ADD COLUMN IF NOT EXISTS service_end_date date;
ALTER TABLE public.calculations DROP CONSTRAINT IF EXISTS calculations_currency_chk;
ALTER TABLE public.calculations ADD CONSTRAINT calculations_currency_chk CHECK (currency IN ('YER','SAR','USD'));

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'YER',
  ADD COLUMN IF NOT EXISTS service_start_date date,
  ADD COLUMN IF NOT EXISTS service_end_date date;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_currency_chk;
ALTER TABLE public.documents ADD CONSTRAINT documents_currency_chk CHECK (currency IN ('YER','SAR','USD'));

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS enable_info_currency_conversion boolean NOT NULL DEFAULT false;

ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS display_seconds integer NOT NULL DEFAULT 10
    CHECK (display_seconds BETWEEN 2 AND 120);

CREATE OR REPLACE FUNCTION public.register_document(
  p_employee_name text, p_employer_name text, p_monthly_salary numeric,
  p_service_years integer, p_service_months integer, p_total_amount numeric,
  p_custom_clauses text DEFAULT NULL::text, p_currency text DEFAULT 'YER'::text,
  p_service_start_date date DEFAULT NULL::date, p_service_end_date date DEFAULT NULL::date
) RETURNS TABLE(serial_number text, created_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer := EXTRACT(YEAR FROM now())::int;
  v_seq integer;
  v_serial text;
  v_created timestamp with time zone := now();
  v_currency text := COALESCE(NULLIF(upper(trim(p_currency)), ''), 'YER');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register a document';
  END IF;
  IF v_currency NOT IN ('YER','SAR','USD') THEN v_currency := 'YER'; END IF;
  v_seq := nextval('public.document_serial_seq');
  v_serial := 'YML-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
  INSERT INTO public.documents (
    serial_number, year, seq, employee_name, employer_name,
    monthly_salary, service_years, service_months, total_amount,
    custom_clauses, currency, service_start_date, service_end_date,
    created_by, created_at
  ) VALUES (
    v_serial, v_year, v_seq, p_employee_name, p_employer_name,
    p_monthly_salary, p_service_years, p_service_months, p_total_amount,
    p_custom_clauses, v_currency, p_service_start_date, p_service_end_date,
    auth.uid(), v_created
  );
  RETURN QUERY SELECT v_serial, v_created;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.register_document(text,text,numeric,integer,integer,numeric,text,text,date,date) FROM anon;

DROP FUNCTION IF EXISTS public.verify_document(text);
CREATE FUNCTION public.verify_document(p_serial text)
RETURNS TABLE(
  serial_number text, total_amount numeric, currency text,
  service_start_date date, service_end_date date, created_at timestamp with time zone
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT d.serial_number, d.total_amount, d.currency,
         d.service_start_date, d.service_end_date, d.created_at
  FROM public.documents d
  WHERE d.serial_number = upper(trim(p_serial))
  LIMIT 1
$function$;
GRANT EXECUTE ON FUNCTION public.verify_document(text) TO anon, authenticated;

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

CREATE POLICY "admins read admin_users" ON public.admin_users
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert admin_users" ON public.admin_users
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update admin_users" ON public.admin_users
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete admin_users" ON public.admin_users
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER admin_users_touch_updated
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.admin_users (email, status)
VALUES ('othmanahmed27@gmail.com', 'active')
ON CONFLICT (email) DO UPDATE SET status = 'active';

CREATE OR REPLACE FUNCTION public.sync_admin_role_for_email(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'admin';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_users_sync_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_is_admin boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, mobile_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'mobile_number'
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
$$;

SELECT public.sync_admin_role_for_email('othmanahmed27@gmail.com');

DROP VIEW IF EXISTS public.lawyers_public;
CREATE VIEW public.lawyers_public WITH (security_invoker = on) AS
SELECT id, full_name, slug, photo_url, governorate, city, office_name,
       bio, years_experience, specializations, verification_status,
       is_active, avg_rating, reviews_count, created_at
FROM public.lawyers
WHERE is_active = true AND verification_status = 'approved';
GRANT SELECT ON public.lawyers_public TO anon, authenticated;

DROP POLICY IF EXISTS "Public read approved lawyers" ON public.lawyers;
CREATE POLICY "Authenticated read approved lawyers"
ON public.lawyers FOR SELECT TO authenticated
USING (is_active AND verification_status = 'approved');

DROP VIEW IF EXISTS public.payment_methods_public;
CREATE VIEW public.payment_methods_public WITH (security_invoker = on) AS
SELECT id, name, logo_url, instructions, is_active, sort_order, created_at
FROM public.payment_methods WHERE is_active = true;
GRANT SELECT ON public.payment_methods_public TO anon, authenticated;

DROP POLICY IF EXISTS "Public read active payment methods" ON public.payment_methods;
CREATE POLICY "Authenticated read active payment methods"
ON public.payment_methods FOR SELECT TO authenticated USING (is_active);

DROP POLICY IF EXISTS "Anyone insert ad events" ON public.ad_events;
CREATE POLICY "Anyone insert valid ad events"
ON public.ad_events FOR INSERT TO anon, authenticated
WITH CHECK (
  kind IN ('impression','click')
  AND EXISTS (SELECT 1 FROM public.advertisements a WHERE a.id = ad_events.ad_id)
);