-- ============ PART 1P: Admin Dashboard core ============

-- Organizations & branches (multi-tenant)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  country_code text,
  currency text DEFAULT 'SAR',
  timezone text DEFAULT 'Asia/Riyadh',
  language text DEFAULT 'ar',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage organizations" ON public.organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  country_code text,
  city text,
  currency text DEFAULT 'SAR',
  timezone text DEFAULT 'Asia/Riyadh',
  language text DEFAULT 'ar',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage branches" ON public.branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- RBAC
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL UNIQUE,
  role_name text NOT NULL,
  description text,
  system_role boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_roles TO authenticated;
GRANT ALL ON public.admin_roles TO service_role;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage admin_roles" ON public.admin_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code text NOT NULL UNIQUE,
  permission_name text NOT NULL,
  module text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage admin_permissions" ON public.admin_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.admin_permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_role_permissions TO authenticated;
GRANT ALL ON public.admin_role_permissions TO service_role;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage admin_role_permissions" ON public.admin_role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.admin_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  mfa_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, organization_id, branch_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_role_assignments TO authenticated;
GRANT ALL ON public.admin_role_assignments TO service_role;
ALTER TABLE public.admin_role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage role assignments" ON public.admin_role_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "users read own role assignments" ON public.admin_role_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- System settings (key/value, typed)
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key text PRIMARY KEY,
  setting_value text,
  data_type text NOT NULL DEFAULT 'string',
  module text,
  label text,
  is_encrypted boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage system_settings" ON public.system_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Feature flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  country_code text,
  plan_code text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flag_key, country_code, plan_code, organization_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage feature_flags" ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "authenticated read feature_flags" ON public.feature_flags FOR SELECT TO authenticated USING (true);

-- API management
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  rate_limit_per_min integer NOT NULL DEFAULT 60,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage api_keys" ON public.api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  status_code integer,
  response_ms integer,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.api_usage_logs TO authenticated;
GRANT ALL ON public.api_usage_logs TO service_role;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read api_usage_logs" ON public.api_usage_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  secret_hint text,
  is_active boolean NOT NULL DEFAULT true,
  last_status integer,
  last_delivery_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage webhook_endpoints" ON public.webhook_endpoints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Security center
CREATE TABLE IF NOT EXISTS public.ip_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_value text NOT NULL,
  rule_type text NOT NULL DEFAULT 'blacklist',
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_rules TO authenticated;
GRANT ALL ON public.ip_rules TO service_role;
ALTER TABLE public.ip_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ip_rules" ON public.ip_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'info',
  alert_type text NOT NULL,
  message text NOT NULL,
  user_id uuid,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage security_alerts" ON public.security_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- AI monitoring
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  feature text NOT NULL,
  model text,
  document_type text,
  tokens_used integer,
  latency_ms integer,
  success boolean NOT NULL DEFAULT true,
  quality_rating integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read ai_usage_logs" ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "users insert own ai_usage_logs" ON public.ai_usage_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Notification dispatches (multi-channel outbox)
CREATE TABLE IF NOT EXISTS public.notification_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  target text,
  audience text NOT NULL DEFAULT 'all',
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  sent_by uuid,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_dispatches TO authenticated;
GRANT ALL ON public.notification_dispatches TO service_role;
ALTER TABLE public.notification_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage notification_dispatches" ON public.notification_dispatches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Legal rule versions
CREATE TABLE IF NOT EXISTS public.legal_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  rule_key text NOT NULL,
  version text NOT NULL,
  title text,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from date,
  effective_to date,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, rule_key, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_rule_versions TO authenticated;
GRANT ALL ON public.legal_rule_versions TO service_role;
ALTER TABLE public.legal_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage legal_rule_versions" ON public.legal_rule_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "authenticated read active legal_rule_versions" ON public.legal_rule_versions FOR SELECT TO authenticated
  USING (status = 'active');

-- Case admin extensions
ALTER TABLE public.sa_cases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
ALTER TABLE public.sa_cases ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.sa_cases ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.sa_cases ADD COLUMN IF NOT EXISTS assigned_lawyer_id uuid;
ALTER TABLE public.sa_cases ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.sa_cases ADD COLUMN IF NOT EXISTS national_id text;
ALTER TABLE public.sa_cases ADD COLUMN IF NOT EXISTS contract_type text;
ALTER TABLE public.sa_cases ADD COLUMN IF NOT EXISTS merged_into uuid;
DROP POLICY IF EXISTS "admins manage sa_cases" ON public.sa_cases;
CREATE POLICY "admins manage sa_cases" ON public.sa_cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Timestamp triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','branches','admin_role_assignments','feature_flags','api_keys','webhook_endpoints','legal_rule_versions']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER touch_%1$s BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;

-- Seed roles
INSERT INTO public.admin_roles (role_code, role_name, description, system_role) VALUES
  ('super_admin','مدير النظام الأعلى','صلاحيات كاملة على جميع الوحدات',true),
  ('org_admin','مدير المؤسسة','إدارة مؤسسة واحدة وفروعها',true),
  ('branch_manager','مدير الفرع','إدارة قضايا ومستخدمي الفرع',true),
  ('hr_officer','مسؤول الموارد البشرية','إدخال ومتابعة القضايا',true),
  ('lawyer','محامٍ','مراجعة القضايا واعتماد التقارير',true),
  ('legal_consultant','مستشار قانوني','مراجعة قانونية واستشارات',true),
  ('finance','المالية','الاشتراكات والفواتير والمدفوعات',true),
  ('auditor','مدقق','عرض السجلات والتقارير للتدقيق',true),
  ('read_only','عرض فقط','عرض البيانات دون تعديل',true),
  ('api_user','مستخدم API','وصول برمجي عبر مفاتيح API',true)
ON CONFLICT (role_code) DO NOTHING;

-- Seed permissions
INSERT INTO public.admin_permissions (permission_code, permission_name, module) VALUES
  ('cases.view','عرض القضايا','cases'),
  ('cases.create','إنشاء قضية','cases'),
  ('cases.update','تعديل قضية','cases'),
  ('cases.delete','حذف قضية','cases'),
  ('cases.export','تصدير القضايا','cases'),
  ('cases.print','طباعة القضايا','cases'),
  ('calc.approve','اعتماد الحساب','calculation'),
  ('report.approve','اعتماد التقرير','reports'),
  ('report.view','عرض التقارير','reports'),
  ('rules.manage','تعديل القوانين','legal_rules'),
  ('countries.manage','إدارة الدول','countries'),
  ('users.manage','إدارة المستخدمين','users'),
  ('roles.manage','إدارة الأدوار والصلاحيات','roles'),
  ('orgs.manage','إدارة المؤسسات والفروع','organizations'),
  ('subscriptions.manage','إدارة الاشتراكات','subscriptions'),
  ('billing.manage','إدارة الفوترة','billing'),
  ('notifications.send','إرسال الإشعارات','notifications'),
  ('api.manage','إدارة API','api'),
  ('backups.manage','إدارة النسخ الاحتياطية','backups'),
  ('audit.view','عرض سجل التدقيق','audit'),
  ('monitoring.view','مراقبة النظام','monitoring'),
  ('security.manage','إدارة مركز الأمان','security'),
  ('ai.monitor','مراقبة الذكاء الاصطناعي','ai'),
  ('settings.manage','إعدادات النظام','settings')
ON CONFLICT (permission_code) DO NOTHING;

-- Grant all permissions to super_admin
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r CROSS JOIN public.admin_permissions p
WHERE r.role_code = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r JOIN public.admin_permissions p ON true
WHERE r.role_code = 'read_only' AND p.permission_code IN ('cases.view','report.view','audit.view','monitoring.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r JOIN public.admin_permissions p ON true
WHERE r.role_code = 'finance' AND p.permission_code IN ('subscriptions.manage','billing.manage','report.view')
ON CONFLICT DO NOTHING;

-- Seed system settings
INSERT INTO public.system_settings (setting_key, setting_value, data_type, module, label) VALUES
  ('system.name','حاسبة العمال الذكية','string','general','اسم النظام'),
  ('system.logo_url','','string','general','شعار النظام'),
  ('system.default_language','ar','string','general','اللغة الافتراضية'),
  ('system.default_currency','SAR','string','general','العملة الافتراضية'),
  ('system.timezone','Asia/Riyadh','string','general','المنطقة الزمنية'),
  ('system.support_phone','+966542152395','string','general','رقم الدعم'),
  ('mail.from_address','no-reply@smartlabor.app','string','mail','بريد المرسل'),
  ('storage.max_upload_mb','15','number','storage','أقصى حجم للمرفق (ميجابايت)'),
  ('ai.enabled','true','boolean','ai','تفعيل الذكاء الاصطناعي'),
  ('ai.model','google/gemini-2.5-flash','string','ai','موديل الذكاء الاصطناعي'),
  ('report.watermark','true','boolean','reports','علامة مائية على التقارير'),
  ('calc.confidence_threshold','70','number','calculation','حد جودة البيانات المقبول'),
  ('security.password_min_length','8','number','security','أقل طول لكلمة المرور'),
  ('security.mfa_required','false','boolean','security','إلزام المصادقة الثنائية'),
  ('security.session_timeout_min','120','number','security','مهلة الجلسة (دقيقة)'),
  ('backup.auto_enabled','true','boolean','backup','النسخ الاحتياطي التلقائي'),
  ('backup.schedule_cron','0 2 * * *','string','backup','جدولة النسخ الاحتياطي')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.feature_flags (flag_key, description, enabled) VALUES
  ('ai_document_analysis','تحليل المستندات بالذكاء الاصطناعي',true),
  ('final_report_docx','تصدير التقرير بصيغة Word',true),
  ('yemen_engine','محرك اليمن',false),
  ('referrals','نظام الإحالات',true)
ON CONFLICT DO NOTHING;