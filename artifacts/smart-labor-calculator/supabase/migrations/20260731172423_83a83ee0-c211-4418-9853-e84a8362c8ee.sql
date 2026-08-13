
-- Countries manager extra fields
ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Riyadh',
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS employment_law_name text,
  ADD COLUMN IF NOT EXISTS social_insurance_law text,
  ADD COLUMN IF NOT EXISTS legislator text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Legal systems
CREATE TABLE IF NOT EXISTS public.legal_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  system_code text NOT NULL,
  system_name text NOT NULL,
  system_type text NOT NULL DEFAULT 'labor_law',
  version text NOT NULL DEFAULT '1.0',
  effective_date date NOT NULL DEFAULT current_date,
  expiry_date date,
  authority text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, system_code, version)
);
GRANT SELECT ON public.legal_systems TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_systems TO authenticated;
GRANT ALL ON public.legal_systems TO service_role;
ALTER TABLE public.legal_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_systems_read" ON public.legal_systems FOR SELECT USING (true);
CREATE POLICY "legal_systems_admin" ON public.legal_systems FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Legal articles
CREATE TABLE IF NOT EXISTS public.legal_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  system_id uuid REFERENCES public.legal_systems(id) ON DELETE SET NULL,
  article_number text NOT NULL,
  article_title text NOT NULL,
  article_text text NOT NULL,
  interpretation text,
  source_url text,
  version text NOT NULL DEFAULT '1.0',
  effective_date date NOT NULL DEFAULT current_date,
  expiry_date date,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.legal_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_articles TO authenticated;
GRANT ALL ON public.legal_articles TO service_role;
ALTER TABLE public.legal_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_articles_read" ON public.legal_articles FOR SELECT USING (true);
CREATE POLICY "legal_articles_admin" ON public.legal_articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Formula repository
CREATE TABLE IF NOT EXISTS public.rule_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_code text NOT NULL,
  formula_name text NOT NULL,
  formula_expression text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  return_type text NOT NULL DEFAULT 'number',
  description text,
  version text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formula_code, version)
);
GRANT SELECT ON public.rule_formulas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_formulas TO authenticated;
GRANT ALL ON public.rule_formulas TO service_role;
ALTER TABLE public.rule_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_formulas_read" ON public.rule_formulas FOR SELECT USING (true);
CREATE POLICY "rule_formulas_admin" ON public.rule_formulas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Legal rules repository
CREATE TABLE IF NOT EXISTS public.legal_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  system_id uuid REFERENCES public.legal_systems(id) ON DELETE SET NULL,
  rule_code text NOT NULL,
  rule_name text NOT NULL,
  rule_type text NOT NULL DEFAULT 'calculation',
  claim_type text,
  sector text,
  worker_type text,
  contract_type text,
  priority integer NOT NULL DEFAULT 100,
  specificity integer NOT NULL DEFAULT 0,
  formula_id uuid REFERENCES public.rule_formulas(id) ON DELETE SET NULL,
  article_id uuid REFERENCES public.legal_articles(id) ON DELETE SET NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  version text NOT NULL DEFAULT '1.0',
  effective_date date NOT NULL DEFAULT current_date,
  expiry_date date,
  status text NOT NULL DEFAULT 'draft',
  supersedes_id uuid REFERENCES public.legal_rules(id) ON DELETE SET NULL,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, rule_code, version)
);
GRANT SELECT ON public.legal_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_rules TO authenticated;
GRANT ALL ON public.legal_rules TO service_role;
ALTER TABLE public.legal_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_rules_read" ON public.legal_rules FOR SELECT USING (true);
CREATE POLICY "legal_rules_admin" ON public.legal_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS legal_rules_lookup_idx ON public.legal_rules (country_code, rule_code, status, effective_date);

-- Rule conditions
CREATE TABLE IF NOT EXISTS public.rule_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.legal_rules(id) ON DELETE CASCADE,
  condition_expression jsonb NOT NULL DEFAULT '{}'::jsonb,
  logic_operator text NOT NULL DEFAULT 'AND',
  execution_order integer NOT NULL DEFAULT 1,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rule_conditions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_conditions TO authenticated;
GRANT ALL ON public.rule_conditions TO service_role;
ALTER TABLE public.rule_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_conditions_read" ON public.rule_conditions FOR SELECT USING (true);
CREATE POLICY "rule_conditions_admin" ON public.rule_conditions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Exceptions engine
CREATE TABLE IF NOT EXISTS public.rule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  rule_id uuid REFERENCES public.legal_rules(id) ON DELETE CASCADE,
  exception_code text NOT NULL,
  exception_name text NOT NULL,
  category text NOT NULL DEFAULT 'special_category',
  applies_to jsonb NOT NULL DEFAULT '{}'::jsonb,
  effect jsonb NOT NULL DEFAULT '{}'::jsonb,
  article_id uuid REFERENCES public.legal_articles(id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 50,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rule_exceptions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_exceptions TO authenticated;
GRANT ALL ON public.rule_exceptions TO service_role;
ALTER TABLE public.rule_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_exceptions_read" ON public.rule_exceptions FOR SELECT USING (true);
CREATE POLICY "rule_exceptions_admin" ON public.rule_exceptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Immutable rule audit log
CREATE TABLE IF NOT EXISTS public.rule_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid,
  rule_code text,
  action text NOT NULL,
  old_version text,
  new_version text,
  snapshot jsonb,
  change_reason text,
  changed_by uuid,
  approved_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rule_audit_log TO authenticated;
GRANT ALL ON public.rule_audit_log TO service_role;
ALTER TABLE public.rule_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_audit_admin_read" ON public.rule_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rule_audit_insert" ON public.rule_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Multi-level approvals
CREATE TABLE IF NOT EXISTS public.rule_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.legal_rules(id) ON DELETE CASCADE,
  stage text NOT NULL,
  stage_order integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  reviewer_id uuid,
  notes text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, stage)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_approvals TO authenticated;
GRANT ALL ON public.rule_approvals TO service_role;
ALTER TABLE public.rule_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_approvals_admin" ON public.rule_approvals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Regression test cases + runs
CREATE TABLE IF NOT EXISTS public.rule_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'SA',
  case_name text NOT NULL,
  rule_code text,
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_output jsonb,
  is_baseline boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_test_cases TO authenticated;
GRANT ALL ON public.rule_test_cases TO service_role;
ALTER TABLE public.rule_test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_test_cases_admin" ON public.rule_test_cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.rule_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.legal_rules(id) ON DELETE CASCADE,
  rule_code text,
  run_type text NOT NULL DEFAULT 'sandbox',
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  previous_result jsonb,
  diff jsonb,
  passed boolean,
  duration_ms integer,
  run_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.rule_test_runs TO authenticated;
GRANT ALL ON public.rule_test_runs TO service_role;
ALTER TABLE public.rule_test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_test_runs_admin" ON public.rule_test_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Timestamps
CREATE TRIGGER legal_systems_touch BEFORE UPDATE ON public.legal_systems FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER legal_articles_touch BEFORE UPDATE ON public.legal_articles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER rule_formulas_touch BEFORE UPDATE ON public.rule_formulas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER legal_rules_touch BEFORE UPDATE ON public.legal_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER rule_exceptions_touch BEFORE UPDATE ON public.rule_exceptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Resolver: pick the correct rule for a context/date
CREATE OR REPLACE FUNCTION public.resolve_legal_rule(
  _country text,
  _rule_code text,
  _as_of date DEFAULT current_date,
  _sector text DEFAULT NULL,
  _worker_type text DEFAULT NULL,
  _contract_type text DEFAULT NULL
)
RETURNS SETOF public.legal_rules
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.* FROM public.legal_rules r
  WHERE r.country_code = upper(_country)
    AND r.rule_code = _rule_code
    AND r.status = 'published'
    AND r.effective_date <= _as_of
    AND (r.expiry_date IS NULL OR r.expiry_date >= _as_of)
    AND (r.sector IS NULL OR _sector IS NULL OR r.sector = _sector)
    AND (r.worker_type IS NULL OR _worker_type IS NULL OR r.worker_type = _worker_type)
    AND (r.contract_type IS NULL OR _contract_type IS NULL OR r.contract_type = _contract_type)
  ORDER BY r.priority DESC, r.specificity DESC, r.effective_date DESC, r.created_at DESC
  LIMIT 1
$$;

-- Publishing with immutable audit
CREATE OR REPLACE FUNCTION public.publish_legal_rule(_rule_id uuid, _reason text DEFAULT NULL, _scheduled timestamptz DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.legal_rules%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  SELECT * INTO v FROM public.legal_rules WHERE id = _rule_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Rule not found'; END IF;
  IF v.article_id IS NULL THEN RAISE EXCEPTION 'Rule must reference a legal article before publishing'; END IF;

  IF _scheduled IS NOT NULL AND _scheduled > now() THEN
    UPDATE public.legal_rules SET status = 'scheduled', scheduled_at = _scheduled WHERE id = _rule_id;
  ELSE
    UPDATE public.legal_rules SET status = 'archived', expiry_date = LEAST(COALESCE(expiry_date, v.effective_date), v.effective_date)
      WHERE country_code = v.country_code AND rule_code = v.rule_code AND id <> v.id AND status = 'published';
    UPDATE public.legal_rules SET status = 'published', published_at = now(), scheduled_at = NULL WHERE id = _rule_id;
  END IF;

  INSERT INTO public.rule_audit_log (rule_id, rule_code, action, old_version, new_version, snapshot, change_reason, changed_by)
  VALUES (v.id, v.rule_code, CASE WHEN _scheduled IS NOT NULL AND _scheduled > now() THEN 'schedule' ELSE 'publish' END,
          v.version, v.version, to_jsonb(v), _reason, auth.uid());
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.rollback_legal_rule(_rule_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.legal_rules%ROWTYPE; p public.legal_rules%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  SELECT * INTO v FROM public.legal_rules WHERE id = _rule_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Rule not found'; END IF;
  SELECT * INTO p FROM public.legal_rules
   WHERE country_code = v.country_code AND rule_code = v.rule_code AND id <> v.id AND status = 'archived'
   ORDER BY published_at DESC NULLS LAST, effective_date DESC LIMIT 1;
  IF p.id IS NULL THEN RAISE EXCEPTION 'No previous version to roll back to'; END IF;

  UPDATE public.legal_rules SET status = 'archived' WHERE id = v.id;
  UPDATE public.legal_rules SET status = 'published', expiry_date = NULL, published_at = now() WHERE id = p.id;

  INSERT INTO public.rule_audit_log (rule_id, rule_code, action, old_version, new_version, snapshot, change_reason, changed_by)
  VALUES (v.id, v.rule_code, 'rollback', v.version, p.version, to_jsonb(v), _reason, auth.uid());
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.unpublish_legal_rule(_rule_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.legal_rules%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  SELECT * INTO v FROM public.legal_rules WHERE id = _rule_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Rule not found'; END IF;
  UPDATE public.legal_rules SET status = 'draft', published_at = NULL WHERE id = _rule_id;
  INSERT INTO public.rule_audit_log (rule_id, rule_code, action, old_version, new_version, snapshot, change_reason, changed_by)
  VALUES (v.id, v.rule_code, 'unpublish', v.version, v.version, to_jsonb(v), _reason, auth.uid());
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.new_rule_version(_rule_id uuid, _version text, _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.legal_rules%ROWTYPE; v_new uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  SELECT * INTO v FROM public.legal_rules WHERE id = _rule_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Rule not found'; END IF;

  INSERT INTO public.legal_rules (
    country_code, system_id, rule_code, rule_name, rule_type, claim_type, sector, worker_type, contract_type,
    priority, specificity, formula_id, article_id, value, description, version, effective_date, status, supersedes_id, created_by)
  VALUES (v.country_code, v.system_id, v.rule_code, v.rule_name, v.rule_type, v.claim_type, v.sector, v.worker_type, v.contract_type,
    v.priority, v.specificity, v.formula_id, v.article_id, v.value, v.description, _version, current_date, 'draft', v.id, auth.uid())
  RETURNING id INTO v_new;

  INSERT INTO public.rule_conditions (rule_id, condition_expression, logic_operator, execution_order, description)
  SELECT v_new, condition_expression, logic_operator, execution_order, description
    FROM public.rule_conditions WHERE rule_id = v.id;

  INSERT INTO public.rule_approvals (rule_id, stage, stage_order)
  VALUES (v_new,'legal_review',1),(v_new,'technical_review',2),(v_new,'final_approval',3);

  INSERT INTO public.rule_audit_log (rule_id, rule_code, action, old_version, new_version, snapshot, change_reason, changed_by)
  VALUES (v_new, v.rule_code, 'new_version', v.version, _version, to_jsonb(v), _reason, auth.uid());
  RETURN v_new;
END; $$;

-- Seed Saudi legal system + core articles/formulas/rules
INSERT INTO public.legal_systems (country_code, system_code, system_name, system_type, version, effective_date, authority)
VALUES
  ('SA','sa_labor_law','نظام العمل السعودي','labor_law','2024.1','2024-01-01','وزارة الموارد البشرية والتنمية الاجتماعية'),
  ('SA','sa_gosi','نظام التأمينات الاجتماعية','social_insurance','2024.1','2024-01-01','المؤسسة العامة للتأمينات الاجتماعية'),
  ('YE','ye_labor_law','قانون العمل اليمني','labor_law','1995.1','1995-01-01','وزارة الشؤون الاجتماعية والعمل')
ON CONFLICT (country_code, system_code, version) DO NOTHING;

INSERT INTO public.legal_articles (country_code, system_id, article_number, article_title, article_text, version)
SELECT 'SA', s.id, a.num, a.title, a.body, '2024.1'
FROM public.legal_systems s,
(VALUES
  ('84','مكافأة نهاية الخدمة','إذا انتهت العلاقة العمالية يدفع صاحب العمل للعامل مكافأة نصف شهر عن كل سنة من السنوات الخمس الأولى وشهر عن كل سنة من السنوات التالية.'),
  ('85','المكافأة عند الاستقالة','إذا ترك العامل العمل بإرادته يستحق ثلث المكافأة بعد سنتين وحتى خمس، وثلثيها إذا زادت عن خمس ولم تبلغ عشراً، والمكافأة كاملة إذا بلغت عشر سنوات.'),
  ('77','التعويض عن الإنهاء','إذا أُنهي العقد لسبب غير مشروع يستحق المتضرر تعويضاً بأجر خمسة عشر يوماً عن كل سنة في العقد غير محدد المدة، أو أجر المدة المتبقية في العقد محدد المدة.'),
  ('109','الإجازة السنوية','يستحق العامل إجازة سنوية لا تقل عن واحد وعشرين يوماً تُزاد إلى ثلاثين يوماً إذا أمضى في خدمة صاحب العمل خمس سنوات.'),
  ('117','الإجازة المرضية','للعامل المريض الحق في إجازة مرضية بأجر كامل للثلاثين يوماً الأولى وبثلاثة أرباع الأجر للستين التالية وبدون أجر للثلاثين التي تلي ذلك.'),
  ('151','إجازة الوضع','للعاملة الحق في إجازة وضع بأجر كامل مدة عشرة أسابيع توزعها كيف تشاء.'),
  ('107','العمل الإضافي','يدفع صاحب العمل أجراً إضافياً عن ساعات العمل الإضافية يوازي أجر الساعة مضافاً إليه 50% من أجره الأساسي.')
) AS a(num,title,body)
WHERE s.country_code='SA' AND s.system_code='sa_labor_law'
ON CONFLICT DO NOTHING;

INSERT INTO public.rule_formulas (formula_code, formula_name, formula_expression, variables, return_type, status, version)
VALUES
  ('eosb_standard','معادلة مكافأة نهاية الخدمة','(min(years,5) * 0.5 * wage) + (max(years - 5, 0) * 1 * wage)','["years","wage"]','number','published','1.0'),
  ('leave_balance','معادلة تعويض رصيد الإجازات','(days * wage) / 30','["days","wage"]','number','published','1.0'),
  ('overtime_pay','معادلة الأجر الإضافي','hours * hourly_rate * 1.5','["hours","hourly_rate"]','number','published','1.0'),
  ('notice_allowance','معادلة بدل الإشعار','(notice_days * wage) / 30','["notice_days","wage"]','number','published','1.0'),
  ('article77_indefinite','معادلة تعويض المادة 77 (غير محدد المدة)','(years * 15 * wage) / 30','["years","wage"]','number','published','1.0'),
  ('gosi_contribution','معادلة اشتراك التأمينات','min(wage, wage_cap) * rate','["wage","wage_cap","rate"]','number','published','1.0')
ON CONFLICT (formula_code, version) DO NOTHING;

INSERT INTO public.legal_rules (country_code, system_id, rule_code, rule_name, rule_type, claim_type, priority, specificity,
  formula_id, article_id, value, description, version, effective_date, status, published_at)
SELECT 'SA', s.id, d.code, d.name, d.rtype, d.claim, d.prio, d.spec,
  (SELECT id FROM public.rule_formulas f WHERE f.formula_code = d.formula LIMIT 1),
  (SELECT id FROM public.legal_articles la WHERE la.country_code='SA' AND la.article_number = d.article LIMIT 1),
  d.val::jsonb, d.descr, '2024.1', '2024-01-01', 'published', now()
FROM public.legal_systems s,
(VALUES
  ('eosb_standard','مكافأة نهاية الخدمة — القاعدة العامة','calculation','eosb',100,1,'eosb_standard','84','{"first_years":5,"first_rate":0.5,"later_rate":1}','نصف شهر لكل سنة للخمس الأولى وشهر لما بعدها'),
  ('eosb_resignation_scale','سلم الاستقالة للمكافأة','eligibility','eosb',110,2,'eosb_standard','85','{"tiers":[{"min_years":2,"max_years":5,"factor":0.3333},{"min_years":5,"max_years":10,"factor":0.6667},{"min_years":10,"factor":1}]}','نسب استحقاق المكافأة عند الاستقالة'),
  ('compensation_article_77','تعويض المادة 77','calculation','compensation',100,1,'article77_indefinite','77','{"indefinite_days_per_year":15,"minimum_months":2}','تعويض الإنهاء غير المشروع'),
  ('annual_leave_entitlement','استحقاق الإجازة السنوية','calculation','annual_leave',100,1,'leave_balance','109','{"base_days":21,"after_five_years_days":30,"threshold_years":5}','21 يوماً وترتفع إلى 30 يوماً بعد خمس سنوات'),
  ('sick_leave_tiers','مستويات أجر الإجازة المرضية','calculation','sick_leave',100,1,NULL,'117','{"tiers":[{"days":30,"rate":1},{"days":60,"rate":0.75},{"days":30,"rate":0}]}','تدرج أجر الإجازة المرضية'),
  ('maternity_leave','إجازة الوضع','eligibility','maternity',100,1,NULL,'151','{"weeks":10,"full_pay":true}','عشرة أسابيع بأجر كامل'),
  ('overtime_multiplier','معامل الأجر الإضافي','calculation','overtime',100,1,'overtime_pay','107','{"multiplier":1.5}','أجر الساعة مضافاً إليه 50%')
) AS d(code,name,rtype,claim,prio,spec,formula,article,val,descr)
WHERE s.country_code='SA' AND s.system_code='sa_labor_law'
ON CONFLICT (country_code, rule_code, version) DO NOTHING;

INSERT INTO public.rule_exceptions (country_code, exception_code, exception_name, category, applies_to, effect, priority, description)
VALUES
  ('SA','pregnant_worker','العاملة الحامل','special_category','{"gender":"female","pregnant":true}','{"block_termination":true,"protection_window_days":180}',90,'حماية من الإنهاء خلال فترة الحمل وإجازة الوضع'),
  ('SA','disabled_worker','ذوو الإعاقة','special_category','{"disability":true}','{"extra_protection":true}',80,'أحكام خاصة لذوي الإعاقة'),
  ('SA','domestic_worker','العمالة المنزلية','sector','{"sector":"domestic"}','{"excluded_from_labor_law":true}',95,'تخضع للائحة العمالة المنزلية وليست لنظام العمل'),
  ('SA','seafarer','البحارة','sector','{"sector":"maritime"}','{"special_regime":true}',85,'أحكام خاصة بالعمل البحري'),
  ('SA','trainee','المتدربون','worker_type','{"worker_type":"trainee"}','{"no_eosb":true}',70,'المتدرب لا يستحق مكافأة نهاية الخدمة'),
  ('SA','minor_worker','الأحداث','worker_type','{"worker_type":"minor"}','{"max_daily_hours":6,"no_night_work":true}',88,'قيود على تشغيل الأحداث'),
  ('SA','public_sector','القطاع الحكومي','sector','{"sector":"public"}','{"civil_service_regime":true}',92,'يخضع لنظام الخدمة المدنية')
ON CONFLICT DO NOTHING;

INSERT INTO public.rule_test_cases (country_code, case_name, rule_code, input_data, expected_output)
VALUES
  ('SA','مكافأة 7 سنوات براتب 6000','eosb_standard','{"years":7,"wage":6000}','{"amount":27000}'),
  ('SA','مكافأة 3 سنوات براتب 5000','eosb_standard','{"years":3,"wage":5000}','{"amount":7500}'),
  ('SA','أجر إضافي 20 ساعة','overtime_multiplier','{"hours":20,"hourly_rate":30}','{"amount":900}'),
  ('SA','بدل إشعار 60 يوماً','compensation_article_77','{"years":4,"wage":9000}','{"amount":18000}')
ON CONFLICT DO NOTHING;
