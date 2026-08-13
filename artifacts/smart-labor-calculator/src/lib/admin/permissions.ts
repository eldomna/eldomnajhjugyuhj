/**
 * Admin Roles & Permissions (client side).
 *
 * Source of truth lives in the database:
 *   admin_permissions / admin_roles / admin_role_permissions / admin_role_assignments
 * and is read through the `my_admin_permissions()` security-definer function.
 * A user holding the global `admin` role implicitly holds every permission.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export const ADMIN_PERMISSIONS = [
  "overview.view",
  "cases.manage",
  "users.view",
  "users.manage",
  "roles.manage",
  "organizations.manage",
  "legal.manage",
  "reports.view",
  "ai.view",
  "subscriptions.manage",
  "billing.manage",
  "notifications.manage",
  "api.manage",
  "backups.manage",
  "security.manage",
  "audit.view",
  "features.manage",
  "settings.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  "overview.view": "عرض لوحة المؤشرات",
  "cases.manage": "إدارة القضايا",
  "users.view": "عرض المستخدمين",
  "users.manage": "إدارة المستخدمين",
  "roles.manage": "إدارة الأدوار والصلاحيات",
  "organizations.manage": "إدارة المؤسسات والفروع",
  "legal.manage": "إدارة المحتوى القانوني",
  "reports.view": "مركز التقارير",
  "ai.view": "مراقبة الذكاء الاصطناعي",
  "subscriptions.manage": "إدارة الاشتراكات",
  "billing.manage": "إدارة الفوترة",
  "notifications.manage": "إدارة الإشعارات",
  "api.manage": "إدارة واجهات API",
  "backups.manage": "النسخ الاحتياطية",
  "security.manage": "مركز الأمان",
  "audit.view": "سجل التدقيق",
  "features.manage": "مفاتيح الميزات",
  "settings.manage": "إعدادات النظام",
};

export const PERMISSION_GROUPS: { group: string; codes: AdminPermission[] }[] = [
  { group: "نظرة عامة", codes: ["overview.view", "reports.view", "audit.view"] },
  {
    group: "العمليات",
    codes: ["cases.manage", "users.view", "users.manage", "roles.manage", "organizations.manage"],
  },
  { group: "المحتوى القانوني", codes: ["legal.manage", "ai.view"] },
  { group: "المالية", codes: ["subscriptions.manage", "billing.manage"] },
  {
    group: "النظام",
    codes: [
      "notifications.manage",
      "api.manage",
      "backups.manage",
      "security.manage",
      "features.manage",
      "settings.manage",
    ],
  },
];

export async function fetchMyPermissions(): Promise<AdminPermission[]> {
  const { data, error } = await db.rpc("my_admin_permissions");
  if (error) return [];
  const rows = (data ?? []) as unknown;
  if (Array.isArray(rows)) {
    return rows
      .map((r) => (typeof r === "string" ? r : ((r as { my_admin_permissions?: string })?.my_admin_permissions ?? "")))
      .filter((c): c is AdminPermission => (ADMIN_PERMISSIONS as readonly string[]).includes(c));
  }
  return [];
}

export type PermissionState = {
  loading: boolean;
  permissions: AdminPermission[];
  can: (code?: AdminPermission) => boolean;
};

/** Reactive permission set of the signed-in admin. */
export function useAdminPermissions(): PermissionState {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "my-permissions"],
    queryFn: fetchMyPermissions,
    staleTime: 60_000,
  });
  const permissions = data ?? [];
  return {
    loading: isLoading,
    permissions,
    can: (code) => (code ? permissions.includes(code) : true),
  };
}
