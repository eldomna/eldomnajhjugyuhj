
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS description text;

-- Public read of ad banner files (so the homepage can render them).
CREATE POLICY "Public read ad banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-banners');

-- Admin full management of ad banner files.
CREATE POLICY "Admins manage ad banners"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'ad-banners' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'ad-banners' AND public.has_role(auth.uid(), 'admin'));
