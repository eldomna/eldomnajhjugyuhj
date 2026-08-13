UPDATE public.platform_settings SET logo_url = '/__l5e/assets-v1/d1646861-c4fd-4c60-b863-b203063482e8/logo.png', updated_at = now() WHERE id = 1 AND (logo_url IS NULL OR logo_url = '');
-- Extend audit_logs with IP & user agent
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON public.audit_logs(actor_id);

DROP POLICY IF EXISTS "admins write audit logs" ON public.audit_logs;
CREATE POLICY "users write own audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action text;
  v_target_id text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF v_actor IS NULL THEN
    v_actor := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := TG_TABLE_NAME || '.insert';
    v_new := to_jsonb(NEW);
    v_target_id := COALESCE(v_new->>'id', '');
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := TG_TABLE_NAME || '.update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_target_id := COALESCE(v_new->>'id', '');
  ELSIF TG_OP = 'DELETE' THEN
    v_action := TG_TABLE_NAME || '.delete';
    v_old := to_jsonb(OLD);
    v_target_id := COALESCE(v_old->>'id', '');
  END IF;

  IF v_actor <> '00000000-0000-0000-0000-000000000000'::uuid THEN
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
    VALUES (
      v_actor,
      v_action,
      TG_TABLE_NAME,
      v_target_id,
      jsonb_build_object('old', v_old, 'new', v_new)
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_calculations ON public.calculations;
CREATE TRIGGER audit_calculations
  AFTER INSERT OR UPDATE OR DELETE ON public.calculations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_documents ON public.documents;
CREATE TRIGGER audit_documents
  AFTER INSERT OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_profiles_update ON public.profiles;
CREATE TRIGGER audit_profiles_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_platform_settings ON public.platform_settings;
CREATE TRIGGER audit_platform_settings
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

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

INSERT INTO public.legal_content (key, title, body, category) VALUES
  ('law-5-1995', 'قانون العمل اليمني رقم 5 لسنة 1995', 'القانون المنظِّم لعلاقة العمل بين العامل وصاحب العمل في الجمهورية اليمنية.', 'law'),
  ('end-of-service', 'مكافأة نهاية الخدمة', 'تُحتسب مكافأة نهاية الخدمة وفقاً للمادة المنظِّمة لها في قانون العمل اليمني.', 'clause'),
  ('overtime', 'أجر العمل الإضافي', 'يُحتسب العمل الإضافي النهاري بنسبة 150% والليلي بنسبة 175% من الأجر الأساسي.', 'clause');