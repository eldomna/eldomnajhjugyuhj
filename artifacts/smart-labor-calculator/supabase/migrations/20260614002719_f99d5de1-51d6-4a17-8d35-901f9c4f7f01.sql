
-- Storage RLS policies for the lawyer-docs private bucket.
-- Admins manage all files; lawyer owners manage files under their lawyer id folder (path: <lawyer_id>/...).

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
