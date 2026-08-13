INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role FROM public.profiles p WHERE lower(p.email) = 'admin@example.com'
ON CONFLICT DO NOTHING;

UPDATE public.profiles SET must_change_password = true, is_active = true
 WHERE lower(email) = 'admin@example.com';