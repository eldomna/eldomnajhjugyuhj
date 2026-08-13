
-- 1. LAWYERS: safe public view (no phone/whatsapp/email)
DROP VIEW IF EXISTS public.lawyers_public;
CREATE VIEW public.lawyers_public
WITH (security_invoker = on) AS
SELECT id, full_name, slug, photo_url, governorate, city, office_name,
       bio, years_experience, specializations, verification_status,
       is_active, avg_rating, reviews_count, created_at
FROM public.lawyers
WHERE is_active = true AND verification_status = 'approved';
GRANT SELECT ON public.lawyers_public TO anon, authenticated;

-- Drop the anonymous-readable policy on the base table; require sign-in
-- for full row reads (which include phone/whatsapp/email).
DROP POLICY IF EXISTS "Public read approved lawyers" ON public.lawyers;
DROP POLICY IF EXISTS "Authenticated read approved lawyers" ON public.lawyers;
CREATE POLICY "Authenticated read approved lawyers"
ON public.lawyers FOR SELECT
TO authenticated
USING (is_active AND verification_status = 'approved');

-- 2. PAYMENT METHODS: safe public view (no account_number/account_holder)
DROP VIEW IF EXISTS public.payment_methods_public;
CREATE VIEW public.payment_methods_public
WITH (security_invoker = on) AS
SELECT id, name, logo_url, instructions, is_active, sort_order, created_at
FROM public.payment_methods
WHERE is_active = true;
GRANT SELECT ON public.payment_methods_public TO anon, authenticated;

DROP POLICY IF EXISTS "Public read active payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Authenticated read active payment methods" ON public.payment_methods;
CREATE POLICY "Authenticated read active payment methods"
ON public.payment_methods FOR SELECT
TO authenticated
USING (is_active);

-- 3. AD EVENTS: validate ad exists and kind is in known set
DROP POLICY IF EXISTS "Anyone insert ad events" ON public.ad_events;
CREATE POLICY "Anyone insert valid ad events"
ON public.ad_events FOR INSERT
TO anon, authenticated
WITH CHECK (
  kind IN ('impression','click')
  AND EXISTS (SELECT 1 FROM public.advertisements a WHERE a.id = ad_events.ad_id)
);

-- 4. REGISTER_DOCUMENT: require authenticated caller; drop EXECUTE from anon.
REVOKE EXECUTE ON FUNCTION public.register_document(text,text,numeric,integer,integer,numeric,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_document(text,text,numeric,integer,integer,numeric,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_document(text,text,numeric,integer,integer,numeric,text,text,date,date) FROM anon;

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

-- 5. VERIFY_DOCUMENT: remove employee_name from public output.
DROP FUNCTION IF EXISTS public.verify_document(text);
CREATE FUNCTION public.verify_document(p_serial text)
RETURNS TABLE(
  serial_number text,
  total_amount numeric,
  currency text,
  service_start_date date,
  service_end_date date,
  created_at timestamp with time zone
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
