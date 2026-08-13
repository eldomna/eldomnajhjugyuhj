-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text,
  severity text NOT NULL DEFAULT 'info',
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  read_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete notifications" ON public.notifications
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_notifications_created ON public.notifications (created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications (read, created_at DESC);

-- Backups table
CREATE TABLE public.backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  snapshot jsonb NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view backups" ON public.backups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins create backups" ON public.backups
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete backups" ON public.backups
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_backups_table_created ON public.backups (table_name, created_at DESC);

-- Triggers to notify admins on key events
CREATE OR REPLACE FUNCTION public.notify_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (type, title, message, severity, link, metadata)
  VALUES ('user.new', 'مستخدم جديد', COALESCE(NEW.full_name, NEW.email, 'مستخدم'), 'info', '/admin/users',
    jsonb_build_object('user_id', NEW.id));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_user ON public.profiles;
CREATE TRIGGER trg_notify_new_user AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_user();

CREATE OR REPLACE FUNCTION public.notify_new_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (type, title, message, severity, link, metadata)
  VALUES ('document.new', 'تم إصدار تقرير جديد', NEW.serial_number || ' — ' || COALESCE(NEW.employee_name, ''),
    'success', '/admin/analytics', jsonb_build_object('document_id', NEW.id, 'serial', NEW.serial_number));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_document ON public.documents;
CREATE TRIGGER trg_notify_new_document AFTER INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_document();

CREATE OR REPLACE FUNCTION public.notify_settings_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (type, title, message, severity, link, metadata)
  VALUES ('settings.update', 'تم تحديث إعدادات المنصة', 'تم تعديل ' || TG_TABLE_NAME, 'warning', '/admin/settings',
    jsonb_build_object('table', TG_TABLE_NAME));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_settings ON public.platform_settings;
CREATE TRIGGER trg_notify_settings AFTER UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.notify_settings_change();

DROP TRIGGER IF EXISTS trg_notify_template ON public.pdf_templates;
CREATE TRIGGER trg_notify_template AFTER UPDATE ON public.pdf_templates
  FOR EACH ROW EXECUTE FUNCTION public.notify_settings_change();
