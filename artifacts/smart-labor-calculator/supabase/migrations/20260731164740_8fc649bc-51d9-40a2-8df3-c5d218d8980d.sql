CREATE TABLE public.case_calculations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  country text NOT NULL DEFAULT 'SA',
  rule_version text,
  calculation_version integer NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'SAR',
  total_salary numeric NOT NULL DEFAULT 0,
  total_leave numeric NOT NULL DEFAULT 0,
  total_sick_leave numeric NOT NULL DEFAULT 0,
  total_maternity numeric NOT NULL DEFAULT 0,
  total_insurance numeric NOT NULL DEFAULT 0,
  total_gratuity numeric NOT NULL DEFAULT 0,
  total_compensation numeric NOT NULL DEFAULT 0,
  total_other numeric NOT NULL DEFAULT 0,
  total_rights numeric NOT NULL DEFAULT 0,
  total_paid_rights numeric NOT NULL DEFAULT 0,
  total_excluded_rights numeric NOT NULL DEFAULT 0,
  final_claim_amount numeric NOT NULL DEFAULT 0,
  confidence_score integer NOT NULL DEFAULT 0,
  calculation_status text NOT NULL DEFAULT 'pending',
  blocked_reason text,
  engines jsonb,
  results jsonb,
  eligibility jsonb,
  exceptions jsonb,
  conflicts jsonb,
  formulas jsonb,
  snapshot jsonb,
  calculation_started_at timestamptz,
  calculation_completed_at timestamptz,
  calculated_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_calculations TO authenticated;
GRANT ALL ON public.case_calculations TO service_role;
ALTER TABLE public.case_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calculations" ON public.case_calculations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_case_calculations_case ON public.case_calculations (case_id, calculation_version DESC);
CREATE TRIGGER trg_case_calculations_touch BEFORE UPDATE ON public.case_calculations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.calculation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id uuid NOT NULL REFERENCES public.case_calculations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  module_name text NOT NULL,
  step_number integer NOT NULL DEFAULT 0,
  rule_applied text,
  formula_used text,
  input_data jsonb,
  output_data jsonb,
  execution_time_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculation_logs TO authenticated;
GRANT ALL ON public.calculation_logs TO service_role;
ALTER TABLE public.calculation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calculation logs" ON public.calculation_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_calculation_logs_calc ON public.calculation_logs (calculation_id, step_number);

CREATE TABLE public.calculation_validations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id uuid NOT NULL REFERENCES public.case_calculations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  validation_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  related_module text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculation_validations TO authenticated;
GRANT ALL ON public.calculation_validations TO service_role;
ALTER TABLE public.calculation_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calculation validations" ON public.calculation_validations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_calculation_validations_calc ON public.calculation_validations (calculation_id, severity);

INSERT INTO public.sa_regulatory_settings (key, category, label, description, value)
VALUES ('calculation_engine', 'engine', 'محرك الحساب القانوني النهائي', 'قواعد التحقق وخط تنفيذ الحساب والاستثناءات والتعارضات ودرجة اكتمال البيانات', jsonb_build_object(
  'version', 'SA-CALC-2026.1',
  'effective_from', '2015-01-01',
  'legal_basis', 'نظام العمل السعودي ولوائحه التنفيذية',
  'system_version', '1.0.0',
  'block_on_error', true,
  'block_on_conflict', false,
  'engines', jsonb_build_array(
    jsonb_build_object('code','validation','label','التحقق من البيانات','order',1),
    jsonb_build_object('code','rules','label','تحميل القواعد القانونية','order',2),
    jsonb_build_object('code','eligibility','label','تحديد الأهلية','order',3),
    jsonb_build_object('code','formula','label','تنفيذ المعادلات','order',4),
    jsonb_build_object('code','exceptions','label','الحالات الاستثنائية','order',5),
    jsonb_build_object('code','conflicts','label','حل التعارضات','order',6),
    jsonb_build_object('code','core','label','الحساب النهائي','order',7),
    jsonb_build_object('code','report','label','بناء بيانات التقرير','order',8)
  ),
  'pipeline', jsonb_build_array(
    jsonb_build_object('code','salaries','label','الرواتب والمبالغ غير المسددة','order',1,'source','case_unpaid_salaries','formula','sum(unpaid_amounts) - paid','legal_ref','م 90، 91'),
    jsonb_build_object('code','overtime','label','العمل الإضافي والعمل في الإجازات','order',2,'source','case_overtime','formula','hours × hourly_rate × overtime_rate','legal_ref','م 107'),
    jsonb_build_object('code','annual_leave','label','تعويض رصيد الإجازات','order',3,'source','case_leave_settlement','formula','balance_days × daily_wage','legal_ref','م 109، 111'),
    jsonb_build_object('code','sick_leave','label','الإجازة المرضية','order',4,'source','case_sick_leave_summary','formula','tiered_pay(days)','legal_ref','م 117'),
    jsonb_build_object('code','maternity','label','الأمومة وساعة الرضاعة','order',5,'source','case_maternity_summary','formula','maternity_pay(service_years)','legal_ref','م 151-153'),
    jsonb_build_object('code','social_insurance','label','فروق التأمينات الاجتماعية','order',6,'source','case_social_insurance','formula','subject_wage × rate × months','legal_ref','نظام التأمينات'),
    jsonb_build_object('code','eosb','label','مكافأة نهاية الخدمة','order',7,'source','case_eosb','formula','half_wage×first5 + full_wage×rest × scale','legal_ref','م 84-87'),
    jsonb_build_object('code','compensation','label','التعويضات وبدل الإشعار','order',8,'source','case_compensation','formula','article_77 / notice_allowance','legal_ref','م 74-77'),
    jsonb_build_object('code','paid_rights','label','الحقوق المسددة','order',9,'source','case_settlement_payments','formula','sum(payments)','legal_ref','م 88'),
    jsonb_build_object('code','excluded_rights','label','الحقوق المستبعدة','order',10,'source','case_final_settlement','formula','proved_paid_rights','legal_ref','قواعد المخالصة'),
    jsonb_build_object('code','final_balance','label','الرصيد النهائي','order',11,'source','engine','formula','total_rights - paid - excluded','legal_ref','—')
  ),
  'severities', jsonb_build_array(
    jsonb_build_object('code','error','label','خطأ يمنع الحساب','blocking',true),
    jsonb_build_object('code','warning','label','تحذير','blocking',false),
    jsonb_build_object('code','info','label','معلومة','blocking',false)
  ),
  'validation_rules', jsonb_build_array(
    jsonb_build_object('code','required_case','label','بيانات القضية الإلزامية','severity','error','module','case_info'),
    jsonb_build_object('code','contracts_exist','label','وجود عقد عمل واحد على الأقل','severity','error','module','contracts'),
    jsonb_build_object('code','dates_valid','label','صحة التواريخ','severity','error','module','contracts'),
    jsonb_build_object('code','no_overlap','label','عدم وجود تداخل زمني بين العقود','severity','warning','module','contracts'),
    jsonb_build_object('code','service_start_match','label','توافق بداية الخدمة مع العقود','severity','warning','module','contracts'),
    jsonb_build_object('code','service_end_match','label','توافق نهاية الخدمة مع سبب الإنهاء','severity','warning','module','termination'),
    jsonb_build_object('code','wage_required','label','وجود بيانات الأجر','severity','error','module','salary'),
    jsonb_build_object('code','wage_match_contract','label','توافق الأجر مع العقد','severity','warning','module','salary'),
    jsonb_build_object('code','no_negative','label','عدم وجود قيم سالبة','severity','error','module','all'),
    jsonb_build_object('code','no_duplicates','label','عدم وجود بيانات مكررة','severity','warning','module','all'),
    jsonb_build_object('code','currency_consistency','label','سلامة العملات','severity','warning','module','all'),
    jsonb_build_object('code','termination_required','label','تحديد سبب انتهاء العلاقة','severity','error','module','termination'),
    jsonb_build_object('code','documents_required','label','وجود المستندات المطلوبة','severity','warning','module','documents')
  ),
  'exception_rules', jsonb_build_array(
    jsonb_build_object('code','multiple_contracts','label','تعدد العقود','severity','info','effect','دمج مدد الخدمة المتصلة واحتساب الأجر الأخير'),
    jsonb_build_object('code','service_gaps','label','انقطاعات في الخدمة','severity','warning','effect','فصل المدد وإعادة احتساب الاستحقاق'),
    jsonb_build_object('code','establishment_transfer','label','انتقال المنشأة','severity','warning','effect','استمرار مدة الخدمة لدى الخلف'),
    jsonb_build_object('code','employee_death','label','وفاة العامل','severity','info','effect','استحقاق كامل المكافأة للورثة'),
    jsonb_build_object('code','force_majeure','label','القوة القاهرة','severity','warning','effect','مراجعة أثر الإنهاء على التعويض'),
    jsonb_build_object('code','court_ruling','label','وجود حكم قضائي','severity','warning','effect','أولوية الحكم على نتائج الاحتساب'),
    jsonb_build_object('code','wage_change','label','تغيير الأجر','severity','info','effect','اعتماد الأجر الأخير في المكافأة'),
    jsonb_build_object('code','multi_settlement','label','أكثر من مخالصة','severity','warning','effect','احتساب الدفعات تراكمياً'),
    jsonb_build_object('code','multi_termination','label','أكثر من سبب إنهاء','severity','warning','effect','ترجيح السبب الفعلي الموثق'),
    jsonb_build_object('code','multi_currency','label','أكثر من عملة','severity','warning','effect','عرض المبالغ بعملة كل وحدة دون تحويل تلقائي')
  ),
  'conflict_rules', jsonb_build_array(
    jsonb_build_object('code','termination_vs_documents','label','سبب الإنهاء لا يتوافق مع المستندات','severity','warning','action','review'),
    jsonb_build_object('code','contract_vs_salary','label','تاريخ العقد يتعارض مع بيانات الراتب','severity','warning','action','review'),
    jsonb_build_object('code','settlement_vs_data','label','المخالصة تخالف البيانات المحتسبة','severity','warning','action','review'),
    jsonb_build_object('code','paid_exceeds_due','label','المسدد يتجاوز المستحق المحتسب','severity','warning','action','review'),
    jsonb_build_object('code','notice_vs_reason','label','بدل الإشعار لا يتوافق مع سبب الإنهاء','severity','warning','action','review')
  ),
  'confidence', jsonb_build_object(
    'base', 100,
    'penalty_error', 25,
    'penalty_warning', 5,
    'penalty_conflict', 10,
    'penalty_missing_document', 5,
    'penalty_missing_module', 4,
    'min', 20,
    'bands', jsonb_build_array(
      jsonb_build_object('min',95,'label','بيانات مكتملة','tone','success'),
      jsonb_build_object('min',85,'label','بعض المستندات مفقودة','tone','info'),
      jsonb_build_object('min',70,'label','توجد تعارضات','tone','warning'),
      jsonb_build_object('min',0,'label','بيانات ناقصة','tone','danger')
    )
  ),
  'notes', 'درجة اكتمال البيانات مؤشر داخلي لجودة المدخلات ولا تُعد حكماً قانونياً.'
))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;