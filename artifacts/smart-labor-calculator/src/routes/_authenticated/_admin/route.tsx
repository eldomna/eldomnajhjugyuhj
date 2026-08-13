import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { readAdminState } from "@/lib/admin/adminAuth";
import { fetchMyPermissions } from "@/lib/admin/permissions";
import { findAdminModule } from "@/components/admin/adminModules";

/**
 * Admin gate.
 * 1. Unauthenticated / non-admin visitors go to /admin/login.
 * 2. A temporary admin account must set a new password first.
 * 3. Module-level Roles & Permissions: a module is only reachable when the
 *    signed-in admin holds its permission (global `admin` role holds all).
 */
export const Route = createFileRoute("/_authenticated/_admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const state = await readAdminState();
    if (!state.userId || !state.isAdmin) throw redirect({ to: "/admin/login" });
    if (state.mustChangePassword) throw redirect({ to: "/admin/change-password" });

    const required = findAdminModule(location.pathname)?.permission;
    if (required) {
      const permissions = await fetchMyPermissions();
      if (!permissions.includes(required) && location.pathname !== "/admin") {
        throw redirect({ to: "/admin" });
      }
    }
  },
  component: () => <Outlet />,
});
