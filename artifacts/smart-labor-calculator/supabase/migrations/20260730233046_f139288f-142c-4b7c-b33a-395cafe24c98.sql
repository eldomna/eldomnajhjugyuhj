CREATE TABLE public.lawyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  photo_url text,
  governorate text NOT NULL,
  city text,
  office_name text,
  phone text,
  whatsapp text,
  email text,
  bio text,
  years_experience integer DEFAULT 0,
  specializations text[] DEFAULT '{}',
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected','revoked')),
  is_active boolean NOT NULL DEFAULT true,
  avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  reviews_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lawyers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyers TO authenticated;
GRANT ALL ON public.lawyers TO service_role;
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read approved lawyers" ON public.lawyers FOR SELECT
  USING (is_active AND verification_status = 'approved');
CREATE POLICY "Owner read own lawyer" ON public.lawyers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Owner update own lawyer" ON public.lawyers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner insert own lawyer" ON public.lawyers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin manage lawyers" ON public.lawyers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER lawyers_touch BEFORE UPDATE ON public.lawyers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.lawyer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('license','professional','other')),
  file_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_documents TO authenticated;
GRANT ALL ON public.lawyer_documents TO service_role;
ALTER TABLE public.lawyer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manage own docs" ON public.lawyer_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lawyers l WHERE l.id = lawyer_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lawyers l WHERE l.id = lawyer_id AND l.user_id = auth.uid()));
CREATE POLICY "Admin manage docs" ON public.lawyer_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.lawyer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lawyer_id, user_id)
);
GRANT SELECT ON public.lawyer_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_reviews TO authenticated;
GRANT ALL ON public.lawyer_reviews TO service_role;
ALTER TABLE public.lawyer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read visible reviews" ON public.lawyer_reviews FOR SELECT
  USING (NOT is_hidden);
CREATE POLICY "User write own review" ON public.lawyer_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User update own review" ON public.lawyer_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User delete own review" ON public.lawyer_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admin manage reviews" ON public.lawyer_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.recalc_lawyer_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lawyer uuid;
BEGIN
  v_lawyer := COALESCE(NEW.lawyer_id, OLD.lawyer_id);
  UPDATE public.lawyers l SET
    avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric,2) FROM public.lawyer_reviews WHERE lawyer_id = v_lawyer AND NOT is_hidden), 0),
    reviews_count = (SELECT COUNT(*) FROM public.lawyer_reviews WHERE lawyer_id = v_lawyer AND NOT is_hidden)
  WHERE l.id = v_lawyer;
  RETURN NULL;
END $$;

CREATE TRIGGER lawyer_reviews_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.lawyer_reviews
FOR EACH ROW EXECUTE FUNCTION public.recalc_lawyer_rating();

CREATE TABLE public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  redirect_url text,
  governorate text,
  position text NOT NULL DEFAULT 'hero' CHECK (position IN ('hero','rotator')),
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advertisements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active ads" ON public.advertisements FOR SELECT
  USING (is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now()));
CREATE POLICY "Admin manage ads" ON public.advertisements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER ads_touch BEFORE UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('impression','click')),
  session_id text,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.ad_events TO anon, authenticated;
GRANT SELECT ON public.ad_events TO authenticated;
GRANT ALL ON public.ad_events TO service_role;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone insert ad events" ON public.ad_events FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Admin read ad events" ON public.ad_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX ad_events_ad_kind_idx ON public.ad_events (ad_id, kind, created_at DESC);

CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  account_number text,
  account_holder text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_methods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active payment methods" ON public.payment_methods FOR SELECT
  USING (is_active);
CREATE POLICY "Admin manage payment methods" ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER payment_methods_touch BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.knowledge_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_categories TO authenticated;
GRANT ALL ON public.knowledge_categories TO service_role;
ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.knowledge_categories FOR SELECT USING (true);
CREATE POLICY "Admin manage categories" ON public.knowledge_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.knowledge_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  body text NOT NULL DEFAULT '',
  tags text[] DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  seo_title text,
  seo_description text,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_articles TO authenticated;
GRANT ALL ON public.knowledge_articles TO service_role;
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published articles" ON public.knowledge_articles FOR SELECT
  USING (is_published);
CREATE POLICY "Admin manage articles" ON public.knowledge_articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER knowledge_articles_touch BEFORE UPDATE ON public.knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS calculator_access_mode text NOT NULL DEFAULT 'free'
  CHECK (calculator_access_mode IN ('free','premium','hybrid'));

INSERT INTO public.knowledge_categories (name, slug, sort_order) VALUES
  ('حقوق العمل','labor-rights',1),
  ('تأخر الرواتب','salary-delays',2),
  ('الإجازة السنوية','annual-leave',3),
  ('مكافأة نهاية الخدمة','end-of-service',4),
  ('الفصل التعسفي','wrongful-termination',5)
ON CONFLICT (slug) DO NOTHING;