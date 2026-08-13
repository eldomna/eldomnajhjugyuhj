-- ============ BILLING (platform-wide) ============
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  period text NOT NULL DEFAULT 'one_time',
  duration_days integer NOT NULL DEFAULT 0,
  calc_credits integer,
  engines text[] NOT NULL DEFAULT ARRAY['sa','ye'],
  show_details boolean NOT NULL DEFAULT true,
  show_legal_refs boolean NOT NULL DEFAULT true,
  allow_pdf boolean NOT NULL DEFAULT true,
  auto_renew boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_plans TO anon;
GRANT SELECT ON public.billing_plans TO authenticated;
GRANT ALL ON public.billing_plans TO service_role;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_plans public read" ON public.billing_plans FOR SELECT USING (true);
CREATE POLICY "billing_plans admin write" ON public.billing_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER billing_plans_touch BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'manual',
  logo_url text,
  instructions text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_providers TO anon;
GRANT SELECT ON public.payment_providers TO authenticated;
GRANT ALL ON public.payment_providers TO service_role;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_providers public read" ON public.payment_providers FOR SELECT USING (true);
CREATE POLICY "payment_providers admin write" ON public.payment_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER payment_providers_touch BEFORE UPDATE ON public.payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_code text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  credits_remaining integer,
  auto_renew boolean NOT NULL DEFAULT false,
  provider_code text,
  provider_ref text,
  payment_method_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_subscriptions_user_idx ON public.billing_subscriptions(user_id, status);
GRANT SELECT, INSERT, UPDATE ON public.billing_subscriptions TO authenticated;
GRANT ALL ON public.billing_subscriptions TO service_role;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscriptions read" ON public.billing_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own subscriptions update autorenew" ON public.billing_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage subscriptions" ON public.billing_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER billing_subscriptions_touch BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  plan_code text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'pending',
  provider_code text NOT NULL DEFAULT 'manual_transfer',
  provider_txn_id text,
  payment_method_ref text,
  receipt_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_transactions_user_idx ON public.billing_transactions(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.billing_transactions TO authenticated;
GRANT ALL ON public.billing_transactions TO service_role;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions read" ON public.billing_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own transactions insert" ON public.billing_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER billing_transactions_touch BEFORE UPDATE ON public.billing_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SAUDI REGULATORY ENGINE ============
CREATE TABLE public.sa_regulatory_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'general',
  label text NOT NULL,
  description text,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sa_regulatory_settings TO anon;
GRANT SELECT ON public.sa_regulatory_settings TO authenticated;
GRANT ALL ON public.sa_regulatory_settings TO service_role;
ALTER TABLE public.sa_regulatory_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_settings read" ON public.sa_regulatory_settings FOR SELECT USING (true);
CREATE POLICY "sa_settings admin write" ON public.sa_regulatory_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER sa_settings_touch BEFORE UPDATE ON public.sa_regulatory_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.sa_official_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'national',
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sa_official_holidays TO anon;
GRANT SELECT ON public.sa_official_holidays TO authenticated;
GRANT ALL ON public.sa_official_holidays TO service_role;
ALTER TABLE public.sa_official_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_holidays read" ON public.sa_official_holidays FOR SELECT USING (true);
CREATE POLICY "sa_holidays admin write" ON public.sa_official_holidays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER sa_holidays_touch BEFORE UPDATE ON public.sa_official_holidays
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.sa_contract_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sa_contract_rules TO anon;
GRANT SELECT ON public.sa_contract_rules TO authenticated;
GRANT ALL ON public.sa_contract_rules TO service_role;
ALTER TABLE public.sa_contract_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_rules read" ON public.sa_contract_rules FOR SELECT USING (true);
CREATE POLICY "sa_rules admin write" ON public.sa_contract_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER sa_rules_touch BEFORE UPDATE ON public.sa_contract_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.sa_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_name text,
  employer_name text,
  nationality text,
  job_title text,
  sector text,
  start_date date,
  end_date date,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  plan_code text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sa_cases_user_idx ON public.sa_cases(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sa_cases TO authenticated;
GRANT ALL ON public.sa_cases TO service_role;
ALTER TABLE public.sa_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sa_cases" ON public.sa_cases FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER sa_cases_touch BEFORE UPDATE ON public.sa_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.sa_case_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.sa_cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step text NOT NULL,
  decision text NOT NULL,
  reason text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sa_case_audit_case_idx ON public.sa_case_audit(case_id);
GRANT SELECT ON public.sa_case_audit TO authenticated;
GRANT ALL ON public.sa_case_audit TO service_role;
ALTER TABLE public.sa_case_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sa_case_audit read" ON public.sa_case_audit FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ ACCESS FUNCTION ============
CREATE OR REPLACE FUNCTION public.get_platform_entitlements()
RETURNS TABLE(
  plan_code text, status text, expires_at timestamptz,
  credits_remaining integer, auto_renew boolean,
  show_details boolean, show_legal_refs boolean, allow_pdf boolean,
  engines text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.billing_subscriptions%ROWTYPE;
  v_plan public.billing_plans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'none'::text, 'anonymous'::text, NULL::timestamptz, 0, false, false, false, false, ARRAY[]::text[];
    RETURN;
  END IF;

  SELECT * INTO v_sub FROM public.billing_subscriptions s
   WHERE s.user_id = v_uid AND s.status = 'active'
     AND (s.expires_at IS NULL OR s.expires_at > now())
     AND (s.credits_remaining IS NULL OR s.credits_remaining > 0)
   ORDER BY (s.credits_remaining IS NULL) DESC, s.expires_at DESC NULLS LAST
   LIMIT 1;

  IF v_sub.id IS NULL THEN
    SELECT * INTO v_plan FROM public.billing_plans WHERE code = 'free';
    RETURN QUERY SELECT 'free'::text, 'free'::text, NULL::timestamptz, NULL::integer, false,
      COALESCE(v_plan.show_details,false), COALESCE(v_plan.show_legal_refs,false),
      COALESCE(v_plan.allow_pdf,false), COALESCE(v_plan.engines, ARRAY['sa']::text[]);
    RETURN;
  END IF;

  SELECT * INTO v_plan FROM public.billing_plans WHERE code = v_sub.plan_code;
  RETURN QUERY SELECT v_sub.plan_code, v_sub.status, v_sub.expires_at, v_sub.credits_remaining,
    v_sub.auto_renew, COALESCE(v_plan.show_details,true), COALESCE(v_plan.show_legal_refs,true),
    COALESCE(v_plan.allow_pdf,true), COALESCE(v_plan.engines, ARRAY['sa','ye']::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_calc_credit()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT id INTO v_id FROM public.billing_subscriptions
   WHERE user_id = v_uid AND status='active' AND credits_remaining > 0
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY created_at LIMIT 1;
  IF v_id IS NULL THEN RETURN false; END IF;
  UPDATE public.billing_subscriptions
     SET credits_remaining = credits_remaining - 1,
         status = CASE WHEN credits_remaining - 1 <= 0 THEN 'consumed' ELSE status END
   WHERE id = v_id;
  RETURN true;
END;
$$;

-- ============ SEED ============
INSERT INTO public.billing_plans (code,name,description,price,currency,period,duration_days,calc_credits,engines,show_details,show_legal_refs,allow_pdf,auto_renew,sort_order) VALUES
 ('free','التجربة المجانية','عرض إجمالي المطالبة فقط للحاسبة السعودية، بدون تفاصيل أو مواد نظامية أو تصدير PDF.',0,'SAR','free',0,NULL,ARRAY['sa'],false,false,false,false,1),
 ('single','الحسبة المنفردة','عملية حسابية واحدة كاملة مع التفاصيل والمواد النظامية وتصدير PDF.',5,'SAR','one_time',30,1,ARRAY['sa','ye'],true,true,true,false,2),
 ('monthly','الاشتراك الشهري','عمليات وتقارير وملفات PDF غير محدودة لمدة شهر مع تجديد تلقائي.',15,'SAR','monthly',30,NULL,ARRAY['sa','ye'],true,true,true,true,3),
 ('yearly','الاشتراك السنوي','استخدام غير محدود لمدة سنة كاملة مع تجديد تلقائي.',100,'SAR','yearly',365,NULL,ARRAY['sa','ye'],true,true,true,true,4);

INSERT INTO public.payment_providers (code,name,kind,is_active,sort_order,instructions) VALUES
 ('manual_transfer','تحويل بنكي / محفظة — تفعيل يدوي','manual',true,1,'حوّل قيمة الباقة ثم ارفع صورة الإيصال ليتم التفعيل بعد المراجعة.'),
 ('visa','Visa','card',false,2,NULL),
 ('mastercard','Mastercard','card',false,3,NULL),
 ('mada','Mada','card',false,4,NULL),
 ('applepay','Apple Pay','wallet',false,5,NULL);

INSERT INTO public.sa_regulatory_settings (key,category,label,description,value) VALUES
 ('working_hours','hours','ساعات العمل النظامية','الساعات اليومية والأسبوعية العادية وفي رمضان.','{"daily":8,"weekly":48,"ramadan_daily":6,"ramadan_weekly":36,"ramadan_applies_to":"muslim","days_per_week":6,"days_per_month":30}'),
 ('overtime','overtime','الأجر الإضافي','نسبة أجر الساعة الإضافية من أجر الساعة الأساسي.','{"rate":1.5,"basis":"actual_wage"}'),
 ('holiday_work','holidays','العمل في الإجازات الرسمية','نسبة تعويض العمل خلال الإجازات والمناسبات الوطنية.','{"rate":2.0,"overtime_rate":1.5}'),
 ('eosb','eosb','مكافأة نهاية الخدمة','نصف أجر شهر عن كل سنة من الخمس الأولى وأجر شهر عن كل سنة تالية.','{"first_years":5,"first_rate":0.5,"after_rate":1.0,"resignation_scale":[{"from":0,"to":2,"rate":0},{"from":2,"to":5,"rate":0.3333},{"from":5,"to":10,"rate":0.6667},{"from":10,"to":null,"rate":1}]}'),
 ('annual_leave','leave','الإجازة السنوية','عدد أيام الإجازة السنوية المستحقة حسب مدة الخدمة.','{"base_days":21,"long_service_days":30,"long_service_years":5}'),
 ('sick_leave','leave','الإجازة المرضية','شرائح أجر الإجازة المرضية خلال السنة الواحدة.','{"tiers":[{"from":1,"to":30,"rate":1},{"from":31,"to":90,"rate":0.75},{"from":91,"to":120,"rate":0}]}'),
 ('notice_period','notice','مهلة الإشعار','مدة الإشعار النظامية حسب نوع العقد وطريقة صرف الأجر.','{"indefinite_monthly_days":60,"indefinite_other_days":30,"fixed_term_days":30}'),
 ('probation','probation','فترة التجربة','الحد الأقصى لفترة التجربة وإمكانية تمديدها باتفاق كتابي.','{"max_days":90,"extended_max_days":180,"requires_written":true,"eosb_entitled":false}'),
 ('termination_compensation','compensation','تعويض الفصل غير المشروع','تعويض العقد غير محدد المدة وعقد المدة المحددة.','{"indefinite_days_per_year":15,"indefinite_min_months":2,"fixed_term":"remaining_wages"}'),
 ('contract_conversion','contract','تحويل العقد محدد المدة','شروط اعتبار العقد غير محدد المدة.','{"saudi_max_renewals":3,"saudi_max_years":4,"non_saudi_follows_permit":true}'),
 ('claim_limitation','general','تقادم الدعوى العمالية','مدة سقوط الدعوى بعد انتهاء العلاقة العمالية.','{"months":12}');

INSERT INTO public.sa_official_holidays (name,kind,start_date,end_date) VALUES
 ('يوم التأسيس','national','2026-02-22','2026-02-22'),
 ('اليوم الوطني','national','2026-09-23','2026-09-23'),
 ('عيد الفطر','religious','2026-03-19','2026-03-22'),
 ('عيد الأضحى','religious','2026-05-26','2026-05-29');

INSERT INTO public.sa_contract_rules (code,name,description,rule,sort_order) VALUES
 ('fixed_to_indefinite_saudi','تحويل عقد السعودي إلى غير محدد المدة','يتحول العقد محدد المدة للعامل السعودي إلى غير محدد المدة عند تجديده ثلاث مرات متتالية أو بلوغ مدته أربع سنوات.','{"nationality":"saudi","max_renewals":3,"max_years":4,"result":"indefinite"}',1),
 ('non_saudi_permit','عقد غير السعودي مرتبط برخصة العمل','يُعد عقد العامل غير السعودي محدد المدة، وإذا خلا من المدة تكون مدة رخصة العمل هي مدة العقد.','{"nationality":"non_saudi","result":"fixed_term","source":"work_permit"}',2),
 ('continuation_after_expiry','الاستمرار بعد انتهاء المدة','إذا استمر الطرفان في تنفيذ العقد بعد انتهاء مدته اعتُبر مجدداً لمدة غير محددة للسعودي.','{"nationality":"saudi","result":"indefinite"}',3);