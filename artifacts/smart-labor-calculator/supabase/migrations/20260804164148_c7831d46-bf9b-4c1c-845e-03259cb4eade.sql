-- 1) account activation state
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2) permission catalog
INSERT INTO public.admin_permissions (permission_code, permission_name, module, description) VALUES
  ('overview.view','عرض لوحة المؤشرات','overview','الوصول إلى الرئيسية ولوحة المؤشرات'),
  ('cases.manage','إدارة القضايا','cases','عرض وتعديل القضايا'),
  ('users.view','عرض المستخدمين','users','عرض قائمة المستخدمين'),
  ('users.manage','إدارة المستخدمين','users','تفعيل/تعطيل وإعادة تعيين الصلاحيات'),
  ('roles.manage','إدارة الأدوار والصلاحيات','roles','إنشاء الأدوار وربط الصلاحيات'),
  ('organizations.manage','إدارة المؤسسات والفروع','organizations',NULL),
  ('legal.manage','إدارة المحتوى القانوني','legal','محرك القوانين والإصدارات والدول'),
  ('reports.view','مركز التقارير','reports',NULL),
  ('ai.view','مراقبة الذكاء الاصطناعي','ai',NULL),
  ('subscriptions.manage','إدارة الاشتراكات','subscriptions',NULL),
  ('billing.manage','إدارة الفوترة','billing',NULL),
  ('notifications.manage','إدارة الإشعارات','notifications',NULL),
  ('api.manage','إدارة واجهات API','api',NULL),
  ('backups.manage','النسخ الاحتياطية','backups',NULL),
  ('security.manage','مركز الأمان','security',NULL),
  ('audit.view','سجل التدقيق','audit',NULL),
  ('features.manage','مفاتيح الميزات','features',NULL),
  ('settings.manage','إعدادات النظام','settings',NULL)
ON CONFLICT (permission_code) DO UPDATE
  SET permission_name = EXCLUDED.permission_name,
      module = EXCLUDED.module,
      description = COALESCE(EXCLUDED.description, public.admin_permissions.description);

INSERT INTO public.admin_roles (role_code, role_name, description, system_role) VALUES
  ('super_admin','مدير عام','كل الصلاحيات', true),
  ('ops_admin','مدير عمليات','القضايا والمستخدمون والمؤسسات', true),
  ('finance_admin','مدير مالي','الاشتراكات والفوترة', true),
  ('legal_admin','مدير محتوى قانوني','محرك القوانين والتقارير', true),
  ('support_admin','دعم فني','عرض المستخدمين والإشعارات', true),
  ('viewer','مطالع','قراءة فقط للمؤشرات والتقارير', true)
ON CONFLICT (role_code) DO UPDATE
  SET role_name = EXCLUDED.role_name, description = EXCLUDED.description;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.role_code = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r
JOIN public.admin_permissions p ON p.permission_code = ANY (
  CASE r.role_code
    WHEN 'ops_admin' THEN ARRAY['overview.view','cases.manage','users.view','users.manage','organizations.manage','reports.view','audit.view']
    WHEN 'finance_admin' THEN ARRAY['overview.view','subscriptions.manage','billing.manage','reports.view']
    WHEN 'legal_admin' THEN ARRAY['overview.view','legal.manage','reports.view','ai.view']
    WHEN 'support_admin' THEN ARRAY['overview.view','users.view','notifications.manage']
    WHEN 'viewer' THEN ARRAY['overview.view','reports.view']
    ELSE ARRAY[]::text[]
  END
)
ON CONFLICT DO NOTHING;

-- 3) permission helpers
CREATE OR REPLACE FUNCTION public.my_admin_permissions()
RETURNS SETOF text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.permission_code
    FROM public.admin_permissions p
   WHERE public.has_role(auth.uid(), 'admin')
  UNION
  SELECT p.permission_code
    FROM public.admin_role_assignments a
    JOIN public.admin_role_permissions rp ON rp.role_id = a.role_id
    JOIN public.admin_permissions p ON p.id = rp.permission_id
   WHERE a.user_id = auth.uid() AND COALESCE(a.status,'active') = 'active'
$$;

CREATE OR REPLACE FUNCTION public.admin_has_permission(_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.my_admin_permissions() c WHERE c = _code)
$$;

-- 4) user administration
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT NULL)
RETURNS TABLE(
  id uuid, full_name text, email text, mobile_number text, country text,
  is_active boolean, created_at timestamptz, last_login_at timestamptz,
  roles text[], admin_roles text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.admin_has_permission('users.view') THEN
    RAISE EXCEPTION 'Permission users.view required';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.mobile_number, p.country,
         COALESCE(p.is_active, true), p.created_at, p.last_login_at,
         COALESCE((SELECT array_agg(ur.role::text ORDER BY ur.role::text)
                     FROM public.user_roles ur WHERE ur.user_id = p.id), ARRAY[]::text[]),
         COALESCE((SELECT array_agg(ar.role_name ORDER BY ar.role_name)
                     FROM public.admin_role_assignments aa
                     JOIN public.admin_roles ar ON ar.id = aa.role_id
                    WHERE aa.user_id = p.id AND COALESCE(aa.status,'active') = 'active'), ARRAY[]::text[])
    FROM public.profiles p
   WHERE _search IS NULL OR btrim(_search) = ''
      OR p.full_name ILIKE '%' || btrim(_search) || '%'
      OR p.email ILIKE '%' || btrim(_search) || '%'
      OR COALESCE(p.mobile_number,'') ILIKE '%' || btrim(_search) || '%'
   ORDER BY p.created_at DESC
   LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_active(_user_id uuid, _active boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.admin_has_permission('users.manage') THEN
    RAISE EXCEPTION 'Permission users.manage required';
  END IF;
  IF _user_id = auth.uid() AND NOT _active THEN
    RAISE EXCEPTION 'لا يمكن تعطيل حسابك الحالي';
  END IF;
  UPDATE public.profiles SET is_active = _active WHERE id = _user_id;
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id)
  VALUES (auth.uid(), CASE WHEN _active THEN 'user.activate' ELSE 'user.deactivate' END, 'user', _user_id::text);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_user_roles(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.admin_has_permission('users.manage') THEN
    RAISE EXCEPTION 'Permission users.manage required';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكن إعادة تعيين صلاحيات حسابك الحالي';
  END IF;
  DELETE FROM public.admin_role_assignments WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'user') ON CONFLICT DO NOTHING;
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id)
  VALUES (auth.uid(), 'user.roles_reset', 'user', _user_id::text);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role, _grant boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.admin_has_permission('users.manage') THEN
    RAISE EXCEPTION 'Permission users.manage required';
  END IF;
  IF _user_id = auth.uid() AND _role = 'admin' AND NOT _grant THEN
    RAISE EXCEPTION 'لا يمكن سحب صلاحية المدير من حسابك الحالي';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE WHEN _grant THEN 'user.role_granted' ELSE 'user.role_revoked' END,
          'user', _user_id::text, jsonb_build_object('role', _role));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_admin_role(_user_id uuid, _role_id uuid, _grant boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.admin_has_permission('roles.manage') THEN
    RAISE EXCEPTION 'Permission roles.manage required';
  END IF;
  IF _grant THEN
    INSERT INTO public.admin_role_assignments (user_id, role_id, status)
    VALUES (_user_id, _role_id, 'active')
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.admin_role_assignments WHERE user_id = _user_id AND role_id = _role_id;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE WHEN _grant THEN 'admin_role.assigned' ELSE 'admin_role.unassigned' END,
          'user', _user_id::text, jsonb_build_object('role_id', _role_id));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_role_matrix()
RETURNS TABLE(role_id uuid, role_code text, role_name text, description text, system_role boolean, permission_codes text[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.admin_has_permission('roles.manage') THEN
    RAISE EXCEPTION 'Permission roles.manage required';
  END IF;
  RETURN QUERY
  SELECT r.id, r.role_code, r.role_name, r.description, COALESCE(r.system_role,false),
         COALESCE((SELECT array_agg(p.permission_code ORDER BY p.permission_code)
                     FROM public.admin_role_permissions rp
                     JOIN public.admin_permissions p ON p.id = rp.permission_id
                    WHERE rp.role_id = r.id), ARRAY[]::text[])
    FROM public.admin_roles r
   ORDER BY r.role_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role_permission(_role_id uuid, _permission_code text, _grant boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_pid uuid;
BEGIN
  IF NOT public.admin_has_permission('roles.manage') THEN
    RAISE EXCEPTION 'Permission roles.manage required';
  END IF;
  SELECT id INTO v_pid FROM public.admin_permissions WHERE permission_code = _permission_code;
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Unknown permission'; END IF;
  IF _grant THEN
    INSERT INTO public.admin_role_permissions (role_id, permission_id) VALUES (_role_id, v_pid)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.admin_role_permissions WHERE role_id = _role_id AND permission_id = v_pid;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE WHEN _grant THEN 'role_permission.granted' ELSE 'role_permission.revoked' END,
          'admin_role', _role_id::text, jsonb_build_object('permission', _permission_code));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.my_admin_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_users(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_active(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_user_roles(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, app_role, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_admin_role(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_role_matrix() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_role_permission(uuid, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.my_admin_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_admin_role(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_role_matrix() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role_permission(uuid, text, boolean) TO authenticated;