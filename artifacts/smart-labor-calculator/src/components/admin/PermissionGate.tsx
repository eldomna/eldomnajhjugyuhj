import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPermissions, PERMISSION_LABELS, type AdminPermission } from "@/lib/admin/permissions";

/**
 * Blocks a module when the signed-in admin lacks the required permission.
 * A global `admin` role holds every permission, so existing super admins are
 * never locked out.
 */
export function PermissionGate({
  permission,
  children,
}: {
  permission?: AdminPermission;
  children: ReactNode;
}) {
  const { loading, can } = useAdminPermissions();

  if (!permission) return <>{children}</>;
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (can(permission)) return <>{children}</>;

  return (
    <Card className="p-8 text-center max-w-lg mx-auto">
      <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
      <h2 className="text-lg font-bold mb-1">لا تملك صلاحية الوصول</h2>
      <p className="text-sm text-muted-foreground">
        هذه الوحدة تتطلب صلاحية «{PERMISSION_LABELS[permission]}». راجع مدير النظام لمنحك الصلاحية من
        شاشة الأدوار والصلاحيات.
      </p>
    </Card>
  );
}

/** Inline helper: renders children only when the permission is held. */
export function Can({ permission, children }: { permission: AdminPermission; children: ReactNode }) {
  const { can } = useAdminPermissions();
  return can(permission) ? <>{children}</> : null;
}
