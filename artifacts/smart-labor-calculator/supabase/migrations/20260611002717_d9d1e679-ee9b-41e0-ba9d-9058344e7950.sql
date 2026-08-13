
-- Extend audit_logs with IP & user agent
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON public.audit_logs(actor_id);

-- Fix INSERT policy: any authenticated user can write their OWN audit entry
DROP POLICY IF EXISTS "admins write audit logs" ON public.audit_logs;
CREATE POLICY "users write own audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Generic audit trigger writing previous/new value into metadata
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_action text;
  v_target_id text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF v_actor IS NULL THEN
    -- system / trigger fired with no auth context; still log as system
    v_actor := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := TG_TABLE_NAME || '.insert';
    v_new := to_jsonb(NEW);
    v_target_id := COALESCE(v_new->>'id', '');
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := TG_TABLE_NAME || '.update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_target_id := COALESCE(v_new->>'id', '');
  ELSIF TG_OP = 'DELETE' THEN
    v_action := TG_TABLE_NAME || '.delete';
    v_old := to_jsonb(OLD);
    v_target_id := COALESCE(v_old->>'id', '');
  END IF;

  -- Only log when there's a real actor (skip system writes like signup trigger to keep noise low)
  IF v_actor <> '00000000-0000-0000-0000-000000000000'::uuid THEN
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
    VALUES (
      v_actor,
      v_action,
      TG_TABLE_NAME,
      v_target_id,
      jsonb_build_object('old', v_old, 'new', v_new)
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Attach to important tables
DROP TRIGGER IF EXISTS audit_calculations ON public.calculations;
CREATE TRIGGER audit_calculations
  AFTER INSERT OR UPDATE OR DELETE ON public.calculations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_documents ON public.documents;
CREATE TRIGGER audit_documents
  AFTER INSERT OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_profiles_update ON public.profiles;
CREATE TRIGGER audit_profiles_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_platform_settings ON public.platform_settings;
CREATE TRIGGER audit_platform_settings
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
