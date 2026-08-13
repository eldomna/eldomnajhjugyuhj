
ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS service_start_date date,
  ADD COLUMN IF NOT EXISTS service_end_date date;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS service_start_date date,
  ADD COLUMN IF NOT EXISTS service_end_date date;

CREATE OR REPLACE FUNCTION public.register_document(
  p_employee_name text,
  p_employer_name text,
  p_monthly_salary numeric,
  p_service_years integer,
  p_service_months integer,
  p_total_amount numeric,
  p_custom_clauses text DEFAULT NULL,
  p_currency text DEFAULT 'YER',
  p_service_start_date date DEFAULT NULL,
  p_service_end_date date DEFAULT NULL
)
RETURNS TABLE(serial_number text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_year integer := EXTRACT(YEAR FROM now())::int;
  v_seq integer := nextval('public.document_serial_seq');
  v_serial text := 'YML-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
  v_created timestamp with time zone := now();
  v_currency text := COALESCE(NULLIF(upper(trim(p_currency)), ''), 'YER');
BEGIN
  IF v_currency NOT IN ('YER','SAR','USD') THEN
    v_currency := 'YER';
  END IF;
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

DROP FUNCTION IF EXISTS public.verify_document(text);
CREATE OR REPLACE FUNCTION public.verify_document(p_serial text)
RETURNS TABLE(
  serial_number text,
  employee_name text,
  total_amount numeric,
  currency text,
  service_start_date date,
  service_end_date date,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT d.serial_number, d.employee_name, d.total_amount, d.currency,
         d.service_start_date, d.service_end_date, d.created_at
  FROM public.documents d
  WHERE d.serial_number = upper(trim(p_serial))
  LIMIT 1
$function$;
