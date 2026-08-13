
CREATE TABLE public.legal_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_number text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_review_date timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.legal_references TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_references TO authenticated;
GRANT ALL ON public.legal_references TO service_role;

ALTER TABLE public.legal_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read approved legal references"
  ON public.legal_references FOR SELECT
  USING (approval_status = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage legal references"
  ON public.legal_references FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_touch_legal_references_updated_at
  BEFORE UPDATE ON public.legal_references
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed previously hardcoded references as pending (admin must approve to display)
INSERT INTO public.legal_references (article_number, title, summary, approval_status, sort_order) VALUES
  ('—',     'قانون العمل اليمني رقم (5) لسنة 1995 وتعديلاته', 'المرجع التشريعي العام للحقوق العمالية في الجمهورية اليمنية.', 'pending', 0),
  ('66', 'مكافأة نهاية الخدمة', 'مكافأة نهاية الخدمة تعادل أجر شهر عن كل سنة خدمة.', 'pending', 1),
  ('75', 'العمل الإضافي النهاري', 'أجر العمل الإضافي النهاري لا يقل عن 150% من الأجر العادي.', 'pending', 2),
  ('75', 'العمل الإضافي الليلي', 'أجر العمل الإضافي الليلي لا يقل عن 175% من الأجر العادي.', 'pending', 3),
  ('84', 'بدل الإجازات السنوية', 'استبدال الإجازة السنوية غير المستخدمة بأجرها نقداً.', 'pending', 4);
