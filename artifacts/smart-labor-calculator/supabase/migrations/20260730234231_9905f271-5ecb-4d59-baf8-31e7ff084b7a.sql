ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS payload jsonb;

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  severity text NOT NULL DEFAULT 'info',
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON public.user_notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications" ON public.user_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users update own notifications" ON public.user_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_user_subscription_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_notifications (user_id, type, title, message, severity, link, metadata)
    VALUES (NEW.user_id, 'subscription.request.sent', 'تم استلام طلب الاشتراك',
      'طلبك قيد المراجعة من الإدارة وسيتم تفعيل الاشتراك بعد التحقق من الإيصال.',
      'info', '/my-subscription', jsonb_build_object('request_id', NEW.id));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.user_notifications (user_id, type, title, message, severity, link, metadata)
      VALUES (NEW.user_id, 'subscription.request.approved', 'تم تفعيل اشتراكك',
        COALESCE(NEW.admin_notes, 'تمت الموافقة على طلبك ويمكنك الآن استخدام الحاسبة والتقارير بالكامل.'),
        'success', '/my-subscription', jsonb_build_object('request_id', NEW.id));
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.user_notifications (user_id, type, title, message, severity, link, metadata)
      VALUES (NEW.user_id, 'subscription.request.rejected', 'تم رفض طلب الاشتراك',
        COALESCE(NEW.admin_notes, 'لم يتم قبول الطلب. يرجى مراجعة بيانات التحويل وإعادة الإرسال.'),
        'warning', '/subscribe', jsonb_build_object('request_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_subscription_request ON public.subscription_requests;
CREATE TRIGGER trg_notify_user_subscription_request
AFTER INSERT OR UPDATE ON public.subscription_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_user_subscription_request();