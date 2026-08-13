CREATE POLICY "lawyer-docs admin all"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'lawyer-docs' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'lawyer-docs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "lawyer-docs owner read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lawyer-docs'
  AND EXISTS (
    SELECT 1 FROM public.lawyers l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND l.user_id = auth.uid()
  )
);

CREATE POLICY "lawyer-docs owner write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lawyer-docs'
  AND EXISTS (
    SELECT 1 FROM public.lawyers l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND l.user_id = auth.uid()
  )
);

CREATE POLICY "lawyer-docs owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lawyer-docs'
  AND EXISTS (
    SELECT 1 FROM public.lawyers l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND l.user_id = auth.uid()
  )
);

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lawyer';

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

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS description text;

CREATE POLICY "Public read ad banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-banners');

CREATE POLICY "Admins manage ad banners"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'ad-banners' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'ad-banners' AND public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_recalc_lawyer_rating ON public.lawyer_reviews;
CREATE TRIGGER trg_recalc_lawyer_rating
AFTER INSERT OR UPDATE OR DELETE ON public.lawyer_reviews
FOR EACH ROW EXECUTE FUNCTION public.recalc_lawyer_rating();

DROP TRIGGER IF EXISTS trg_touch_lawyers_updated_at ON public.lawyers;
CREATE TRIGGER trg_touch_lawyers_updated_at
BEFORE UPDATE ON public.lawyers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();