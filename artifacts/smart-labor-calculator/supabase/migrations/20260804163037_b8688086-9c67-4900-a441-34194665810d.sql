ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.must_change_password()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.must_change_password FROM public.profiles p WHERE p.id = auth.uid()), false)
$$;

REVOKE ALL ON FUNCTION public.must_change_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.must_change_password() TO authenticated;
GRANT EXECUTE ON FUNCTION public.must_change_password() TO service_role;

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.profiles SET must_change_password = false WHERE id = auth.uid();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_must_change_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO service_role;