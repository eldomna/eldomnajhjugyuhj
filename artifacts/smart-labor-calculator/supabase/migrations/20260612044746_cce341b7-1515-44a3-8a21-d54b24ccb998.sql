
-- =========================
-- legal_content
-- =========================
CREATE TABLE public.legal_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  version integer NOT NULL DEFAULT 1,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX legal_content_key_idx ON public.legal_content(key);
CREATE INDEX legal_content_category_idx ON public.legal_content(category);

GRANT SELECT ON public.legal_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_content TO authenticated;
GRANT ALL ON public.legal_content TO service_role;

ALTER TABLE public.legal_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active legal content"
  ON public.legal_content FOR SELECT
  USING (archived = false);

CREATE POLICY "Admins can read all legal content"
  ON public.legal_content FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert legal content"
  ON public.legal_content FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update legal content"
  ON public.legal_content FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete legal content"
  ON public.legal_content FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER legal_content_set_updated_at
  BEFORE UPDATE ON public.legal_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- pdf_templates
-- =========================
CREATE TABLE public.pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Default',
  watermark text,
  footer text,
  signature_block text,
  disclaimer text,
  verification_statement text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pdf_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pdf_templates TO authenticated;
GRANT ALL ON public.pdf_templates TO service_role;

ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pdf templates"
  ON public.pdf_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert pdf templates"
  ON public.pdf_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pdf templates"
  ON public.pdf_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pdf templates"
  ON public.pdf_templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pdf_templates_set_updated_at
  BEFORE UPDATE ON public.pdf_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Default template
INSERT INTO public.pdf_templates (name, watermark, footer, signature_block, disclaimer, verification_statement, is_active)
VALUES (
  'القالب الافتراضي',
  'حاسبة الحقوق العمالية اليمنية',
  'جميع الحقوق محفوظة © المنصة',
  E'توقيع المختص: ________________\nالتاريخ: ________________',
  'هذا التقرير لأغراض معلوماتية ولا يُعد بديلاً عن الاستشارة القانونية الرسمية.',
  'يمكن التحقق من صحة هذا الملف بمسح رمز الاستجابة السريعة أو إدخال الرقم التسلسلي في صفحة التحقق.',
  true
);

-- Seed a few legal references
INSERT INTO public.legal_content (key, title, body, category) VALUES
  ('law-5-1995', 'قانون العمل اليمني رقم 5 لسنة 1995', 'القانون المنظِّم لعلاقة العمل بين العامل وصاحب العمل في الجمهورية اليمنية.', 'law'),
  ('end-of-service', 'مكافأة نهاية الخدمة', 'تُحتسب مكافأة نهاية الخدمة وفقاً للمادة المنظِّمة لها في قانون العمل اليمني.', 'clause'),
  ('overtime', 'أجر العمل الإضافي', 'يُحتسب العمل الإضافي النهاري بنسبة 150% والليلي بنسبة 175% من الأجر الأساسي.', 'clause');
