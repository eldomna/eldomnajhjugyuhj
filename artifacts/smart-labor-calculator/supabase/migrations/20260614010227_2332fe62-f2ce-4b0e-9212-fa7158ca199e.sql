
-- Prevent non-admin owners from modifying verification_status or is_active on lawyers.
CREATE OR REPLACE FUNCTION public.protect_lawyer_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    NEW.verification_status := OLD.verification_status;
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lawyer_verification ON public.lawyers;
CREATE TRIGGER trg_protect_lawyer_verification
BEFORE UPDATE ON public.lawyers
FOR EACH ROW EXECUTE FUNCTION public.protect_lawyer_verification();
