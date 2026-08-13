
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

-- Admins can read all; owners can read theirs
CREATE POLICY "owner or admin reads document"
  ON public.documents FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX documents_serial_idx ON public.documents (serial_number);
CREATE INDEX documents_created_at_idx ON public.documents (created_at DESC);

-- Register a new document (callable by anon + authenticated)
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

-- Public verification (no PII beyond what user already had)
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

-- Add serial number to calculations for cross-reference
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS serial_number text;
