DROP POLICY IF EXISTS "Public read active plans" ON public.subscription_plans;
CREATE POLICY "Anyone reads active plans" ON public.subscription_plans FOR SELECT
  TO anon, authenticated USING (is_active);
CREATE POLICY "Admins read all plans" ON public.subscription_plans FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_preference text
  CHECK (theme_preference IN ('light','dark','system'));