CREATE TABLE public.case_final_settlement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  has_settlement TEXT NOT NULL DEFAULT 'no',
  settlement_number TEXT,
  settlement_type TEXT,
  settlement_date DATE,
  signing_date DATE,
  signing_place TEXT,
  settlement_language TEXT DEFAULT 'ar',
  signature_status TEXT DEFAULT 'no',
  digital_signature_type TEXT,
  digital_signature_provider TEXT,
  digital_signature_reference TEXT,
  digital_signature_date DATE,
  settlement_file TEXT,
  settlement_file_type TEXT,
  ai_analysis_status TEXT DEFAULT 'not_run',
  ai_analysis JSONB,
  legal_analysis_status TEXT DEFAULT 'not_run',
  legal_analysis JSONB,
  mentioned_rights JSONB,
  waived_rights JSONB,
  covers_all_rights BOOLEAN NOT NULL DEFAULT false,
  under_dispute BOOLEAN NOT NULL DEFAULT false,
  court_ruling_after BOOLEAN NOT NULL DEFAULT false,
  court_ruling_reference TEXT,
  total_settlement_amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'SAR',
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  legal_rule_version TEXT,
  warnings JSONB,
  analysis JSONB,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_final_settlement TO authenticated;
GRANT ALL ON public.case_final_settlement TO service_role;
ALTER TABLE public.case_final_settlement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own final settlement"
  ON public.case_final_settlement FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_case_final_settlement_case ON public.case_final_settlement(case_id);
CREATE TRIGGER trg_case_final_settlement_touch
  BEFORE UPDATE ON public.case_final_settlement
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_settlement_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  settlement_id UUID REFERENCES public.case_final_settlement(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  right_type TEXT NOT NULL,
  right_label TEXT,
  related_module TEXT,
  amount_due NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  exchange_rate NUMERIC(14,6),
  converted_amount NUMERIC(14,2),
  payment_date DATE,
  payment_method TEXT,
  proof_file TEXT,
  match_status TEXT NOT NULL DEFAULT 'needs_review',
  mentioned_in_settlement BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_settlement_payments TO authenticated;
GRANT ALL ON public.case_settlement_payments TO service_role;
ALTER TABLE public.case_settlement_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settlement payments"
  ON public.case_settlement_payments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_case_settlement_payments_case ON public.case_settlement_payments(case_id);
CREATE TRIGGER trg_case_settlement_payments_touch
  BEFORE UPDATE ON public.case_settlement_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.sa_regulatory_settings (key, label, description, value)
VALUES ('final_settlement', 'المخالصة النهائية والحقوق المسددة', 'قواعد المخالصة النهائية والحقوق المسددة — الخطوة 14', jsonb_build_object(
  'version', 'SA-SETTLE-2026.1',
  'effective_from', '2015-01-01',
  'legal_basis', 'نظام العمل السعودي — أحكام الوفاء بالحقوق العمالية والمخالصات',
  'settlement_types', jsonb_build_array(
    jsonb_build_object('code','final_release','label','مخالصة نهائية'),
    jsonb_build_object('code','amicable_settlement','label','تسوية ودية'),
    jsonb_build_object('code','termination_agreement','label','اتفاق إنهاء'),
    jsonb_build_object('code','receipt_acknowledgement','label','إقرار استلام مستحقات'),
    jsonb_build_object('code','other','label','مستند آخر')
  ),
  'signature_statuses', jsonb_build_array(
    jsonb_build_object('code','signed','label','نعم — موقعة'),
    jsonb_build_object('code','not_signed','label','لا'),
    jsonb_build_object('code','digital','label','توقيع إلكتروني'),
    jsonb_build_object('code','unclear','label','غير واضح')
  ),
  'languages', jsonb_build_array(
    jsonb_build_object('code','ar','label','العربية'),
    jsonb_build_object('code','en','label','الإنجليزية'),
    jsonb_build_object('code','bilingual','label','ثنائية اللغة'),
    jsonb_build_object('code','other','label','لغة أخرى')
  ),
  'payment_methods', jsonb_build_array(
    jsonb_build_object('code','bank_transfer','label','تحويل بنكي'),
    jsonb_build_object('code','cheque','label','شيك'),
    jsonb_build_object('code','cash','label','نقداً'),
    jsonb_build_object('code','receipt_voucher','label','سند قبض'),
    jsonb_build_object('code','remittance','label','حوالة'),
    jsonb_build_object('code','settlement','label','مخالصة'),
    jsonb_build_object('code','wps','label','منصة حماية الأجور'),
    jsonb_build_object('code','other','label','مستند آخر')
  ),
  'right_types', jsonb_build_array(
    jsonb_build_object('code','unpaid_salaries','label','الرواتب والمبالغ غير المسددة','module','case_unpaid_salaries','waivable',false,'legal_ref','نظام العمل — الأجور'),
    jsonb_build_object('code','overtime','label','العمل الإضافي والعمل في الإجازات','module','case_overtime','waivable',false,'legal_ref','نظام العمل — ساعات العمل والأجر الإضافي'),
    jsonb_build_object('code','annual_leave','label','تعويض رصيد الإجازات','module','case_leave_settlement','waivable',false,'legal_ref','نظام العمل — الإجازة السنوية'),
    jsonb_build_object('code','sick_leave','label','أجر الإجازة المرضية','module','case_sick_leave_summary','waivable',true,'legal_ref','نظام العمل — الإجازة المرضية'),
    jsonb_build_object('code','maternity','label','أجر الأمومة وساعة الرضاعة','module','case_maternity_summary','waivable',false,'legal_ref','نظام العمل — أحكام تشغيل النساء'),
    jsonb_build_object('code','eosb','label','مكافأة نهاية الخدمة','module','case_eosb','waivable',false,'legal_ref','نظام العمل — مكافأة نهاية الخدمة'),
    jsonb_build_object('code','compensation','label','التعويضات وبدل الإشعار','module','case_compensation','waivable',true,'legal_ref','نظام العمل — المادة 77 وبدل الإشعار'),
    jsonb_build_object('code','social_insurance','label','فروق التأمينات الاجتماعية','module','case_social_insurance','waivable',false,'legal_ref','نظام التأمينات الاجتماعية'),
    jsonb_build_object('code','other','label','حقوق مالية أخرى','module','manual','waivable',true,'legal_ref','—')
  ),
  'non_waivable_note', 'الحقوق المقررة بنص آمر لا يسقطها مجرد التوقيع على المخالصة ما لم يثبت الوفاء الفعلي بها.',
  'settlement_effect_rules', jsonb_build_array(
    jsonb_build_object('code','signature_not_conclusive','label','توقيع المخالصة وحده لا يُعد دليلاً قاطعاً على سقوط الحقوق','severity','info'),
    jsonb_build_object('code','requires_proof','label','يجب وجود إثبات سداد لكل حق يُستبعد من المطالبة','severity','warning'),
    jsonb_build_object('code','partial_settlement','label','المخالصة الجزئية تستبعد الحقوق المثبت سدادها فقط','severity','info'),
    jsonb_build_object('code','date_mismatch','label','تاريخ المخالصة السابق لتاريخ انتهاء العلاقة يستوجب المراجعة','severity','warning'),
    jsonb_build_object('code','duress_indicator','label','وجود نزاع ظاهر أو مؤشرات إكراه يستوجب المراجعة القانونية','severity','warning'),
    jsonb_build_object('code','non_waivable_waiver','label','التنازل عن حق لا يجوز التنازل عنه قد يكون غير قابل للتطبيق','severity','critical')
  ),
  'match_statuses', jsonb_build_array(
    jsonb_build_object('code','matched','label','مطابق'),
    jsonb_build_object('code','difference','label','يوجد فرق'),
    jsonb_build_object('code','no_proof','label','لا يوجد إثبات'),
    jsonb_build_object('code','needs_review','label','يحتاج مراجعة')
  ),
  'tolerance_amount', 1,
  'notes', 'التحليل استرشادي مبني على القواعد المحمّلة والبيانات المدخلة، ولا يُعد حكماً بصحة أو بطلان المخالصة.'
))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;