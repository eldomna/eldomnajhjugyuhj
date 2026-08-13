CREATE TABLE public.case_final_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  calculation_id uuid REFERENCES public.case_calculations(id) ON DELETE SET NULL,
  report_number text NOT NULL,
  report_type text NOT NULL DEFAULT 'full',
  report_language text NOT NULL DEFAULT 'ar',
  country text NOT NULL DEFAULT 'SA',
  currency text NOT NULL DEFAULT 'SAR',
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  rule_version text,
  system_version text,
  calculation_version integer,
  confidence_score integer NOT NULL DEFAULT 0,
  total_rights numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  total_excluded numeric NOT NULL DEFAULT 0,
  final_balance numeric NOT NULL DEFAULT 0,
  options jsonb,
  document jsonb,
  file_pdf text,
  file_docx text,
  file_xlsx text,
  file_html text,
  file_json text,
  qr_code_hash text,
  digital_signature_hash text,
  share_token text,
  archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_final_reports TO authenticated;
GRANT ALL ON public.case_final_reports TO service_role;
ALTER TABLE public.case_final_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own final reports" ON public.case_final_reports
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_case_final_reports_case ON public.case_final_reports (case_id, version DESC);
CREATE TRIGGER trg_case_final_reports_updated BEFORE UPDATE ON public.case_final_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_report_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.case_final_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  section_key text NOT NULL,
  section_name text NOT NULL,
  section_order integer NOT NULL DEFAULT 0,
  included boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'all',
  generated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_report_sections TO authenticated;
GRANT ALL ON public.case_report_sections TO service_role;
ALTER TABLE public.case_report_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own report sections" ON public.case_report_sections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_case_report_sections_report ON public.case_report_sections (report_id, section_order);

INSERT INTO public.sa_regulatory_settings (key, label, category, value)
VALUES ('final_report', 'التقرير القانوني النهائي', 'report', jsonb_build_object(
  'version', 'SA-REPORT-2026.1',
  'system_version', 'SLC-1.0',
  'template_version', '1.0',
  'disclaimer', 'تم إعداد هذا التقرير اعتماداً على البيانات والمستندات المدخلة والقواعد القانونية المطبقة في تاريخ الحساب. ويُعد هذا التقرير أداة مساعدة للتحليل والاحتساب، ولا يُمثل حكماً قضائياً أو فتوى قانونية أو بديلاً عن التقدير الذي تقوم به الجهات المختصة.',
  'ai_disclaimer', 'نتائج التحليل الآلي أدناه مساعدة للمراجعة فقط، وليست رأياً قانونياً أو حكماً قضائياً.',
  'report_types', jsonb_build_array(
    jsonb_build_object('code','full','label','تقرير كامل','sections', jsonb_build_array('cover','executive','case','rights','details','formulas','legal','ai','alerts','payments','audit','attachments','disclaimer')),
    jsonb_build_object('code','brief','label','تقرير مختصر','sections', jsonb_build_array('cover','executive','rights','alerts','disclaimer')),
    jsonb_build_object('code','legal','label','تقرير قانوني','sections', jsonb_build_array('cover','executive','case','rights','details','legal','alerts','audit','disclaimer')),
    jsonb_build_object('code','financial','label','تقرير مالي','sections', jsonb_build_array('cover','executive','rights','details','formulas','payments','audit','disclaimer')),
    jsonb_build_object('code','admin','label','تقرير إداري','sections', jsonb_build_array('cover','executive','case','rights','alerts','audit','disclaimer')),
    jsonb_build_object('code','lawyer','label','تقرير للمحامي','sections', jsonb_build_array('cover','executive','case','rights','details','formulas','legal','ai','alerts','payments','audit','attachments','disclaimer')),
    jsonb_build_object('code','hr','label','تقرير للموارد البشرية','sections', jsonb_build_array('cover','executive','case','rights','payments','alerts','disclaimer'))
  ),
  'sections', jsonb_build_array(
    jsonb_build_object('key','cover','name','صفحة الغلاف','order',1,'visibility','all'),
    jsonb_build_object('key','executive','name','ملخص تنفيذي','order',2,'visibility','all'),
    jsonb_build_object('key','case','name','بيانات القضية','order',3,'visibility','all'),
    jsonb_build_object('key','rights','name','ملخص الحقوق','order',4,'visibility','all'),
    jsonb_build_object('key','details','name','تفاصيل كل حق','order',5,'visibility','all'),
    jsonb_build_object('key','formulas','name','المعادلات المستخدمة','order',6,'visibility','privileged'),
    jsonb_build_object('key','legal','name','المواد القانونية المطبقة','order',7,'visibility','all'),
    jsonb_build_object('key','ai','name','تحليل Legal AI','order',8,'visibility','privileged'),
    jsonb_build_object('key','alerts','name','التنبيهات القانونية','order',9,'visibility','all'),
    jsonb_build_object('key','payments','name','سجل المدفوعات','order',10,'visibility','all'),
    jsonb_build_object('key','audit','name','سجل الحساب','order',11,'visibility','all'),
    jsonb_build_object('key','attachments','name','المرفقات','order',12,'visibility','all'),
    jsonb_build_object('key','disclaimer','name','إخلاء المسؤولية','order',13,'visibility','all')
  )
))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();