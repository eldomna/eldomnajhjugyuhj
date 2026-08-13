import type { ReactNode } from "react";
import { AdminLayout, AdminPageHeader } from "@/components/admin/AdminLayout";
import { ADMIN_MODULES } from "@/components/admin/adminModules";
import { PermissionGate } from "@/components/admin/PermissionGate";
import type { AdminPermission } from "@/lib/admin/permissions";

export { ADMIN_MODULES };

export function AdminShell({
  title,
  description,
  icon: Icon,
  actions,
  permission,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
  /** Required permission for this module; global admins always pass. */
  permission?: AdminPermission;
  children: ReactNode;
}) {
  return (
    <AdminLayout>
      <AdminPageHeader title={title} description={description} icon={Icon} actions={actions} />
      <PermissionGate permission={permission}>{children}</PermissionGate>
    </AdminLayout>
  );
}
