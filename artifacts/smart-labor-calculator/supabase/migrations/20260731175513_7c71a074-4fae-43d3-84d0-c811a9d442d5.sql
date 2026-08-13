-- Revert to an RLS-respecting (invoker) view; hide lawyer PII with column privileges instead.
ALTER VIEW public.lawyers_public SET (security_invoker = on);

-- Directory rows are readable, but the PII columns are not selectable by clients.
CREATE POLICY "Public read approved lawyers"
  ON public.lawyers FOR SELECT TO anon, authenticated
  USING (is_active AND verification_status = 'approved');

REVOKE SELECT ON TABLE public.lawyers FROM anon, authenticated;

GRANT SELECT (
  id, user_id, full_name, slug, photo_url, governorate, city, office_name, bio,
  years_experience, specializations, verification_status, is_active,
  avg_rating, reviews_count, created_at, updated_at
) ON TABLE public.lawyers TO anon, authenticated;

-- Admins still need the contact channels for moderation; expose them through a gated RPC.
CREATE OR REPLACE FUNCTION public.admin_lawyer_contacts()
RETURNS TABLE(id uuid, phone text, whatsapp text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  RETURN QUERY SELECT l.id, l.phone, l.whatsapp, l.email FROM public.lawyers l;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_lawyer_contacts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_lawyer_contacts() TO authenticated;

-- Lawyers manage their own contact channels via the owner UPDATE policy (unchanged);
-- owners read them back through get_lawyer_contact().