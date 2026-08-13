import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Admin area has its own isolated sign-in surface.
      throw redirect({ to: location.pathname.startsWith("/admin") ? "/admin/login" : "/auth" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
