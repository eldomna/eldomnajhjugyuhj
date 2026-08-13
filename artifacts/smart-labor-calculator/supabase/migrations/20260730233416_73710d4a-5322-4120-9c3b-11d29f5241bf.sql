CREATE POLICY "receipts owner read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "receipts owner write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "receipts owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "receipts admin all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'receipts' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'receipts' AND public.has_role(auth.uid(),'admin'));