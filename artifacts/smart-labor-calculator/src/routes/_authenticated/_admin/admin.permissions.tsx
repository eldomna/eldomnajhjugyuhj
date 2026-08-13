import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { SearchInput } from "@/components/admin/SearchInput";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSION_GROUPS, PERMISSION_LABELS, type AdminPermission } from "@/lib/admin/permissions";

export const Route = createFileRoute("/_authenticated/_admin/admin/permissions")({
  component: AdminPermissionsPage,
});

const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type RoleRow = {
  role_id: string;
  role_code: string;
  role_name: string;
  description: string | null;
  system_role: boolean;
  permission_codes: string[];
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  admin_roles: string[];
};

function AdminPermissionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [assignRole, setAssignRole] = useState<string>("");

  const roles = useQuery<RoleRow[]>({
    queryKey: ["admin", "role-matrix"],
    queryFn: async () => {
      const { data, error } = await db.rpc("admin_role_matrix");
      if (error) throw new Error(error.message);
      return (data ?? []) as RoleRow[];
    },
  });

  const users = useQuery<UserRow[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data, error } = await db.rpc("admin_list_users", { _search: null });
      if (error) throw new Error(error.message);
      return (data ?? []) as UserRow[];
    },
  });

  const togglePermission = useMutation({
    mutationFn: async (v: { roleId: string; code: AdminPermission; grant: boolean }) => {
      const { error } = await db.rpc("admin_set_role_permission", {
        _role_id: v.roleId,
        _permission_code: v.code,
        _grant: v.grant,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "role-matrix"] });
      qc.invalidateQueries({ queryKey: ["admin", "my-permissions"] });
      toast.success("تم تحديث صلاحيات الدور");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: async (v: { userId: string; roleId: string; grant: boolean }) => {
      const { error } = await db.rpc("admin_assign_admin_role", {
        _user_id: v.userId,
        _role_id: v.roleId,
        _grant: v.grant,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "my-permissions"] });
      toast.success("تم تحديث تعيين الدور الإداري");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.data ?? [];
    if (!q) return list.slice(0, 25);
    return list
      .filter((u) => [u.full_name, u.email].some((v) => (v ?? "").toLowerCase().includes(q)))
      .slice(0, 25);
  }, [users.data, search]);

  const roleList = roles.data ?? [];

  const userColumns: Column<UserRow>[] = [
    {
      key: "user",
      header: "المستخدم",
      cell: (u) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{u.full_name || "—"}</div>
          <div className="text-xs text-muted-foreground truncate">{u.email || "—"}</div>
        </div>
      ),
    },
    {
      key: "roles",
      header: "الأدوار الإدارية",
      cell: (u) =>
        u.admin_roles.length ? (
          <div className="flex flex-wrap gap-1">
            {u.admin_roles.map((r) => {
              const role = roleList.find((x) => x.role_name === r);
              return (
                <Badge key={r} variant="secondary" className="gap-1 text-[11px]">
                  {r}
                  {role && (
                    <button
                      type="button"
                      aria-label={`إزالة ${r}`}
                      className="text-destructive"
                      onClick={() => assign.mutate({ userId: u.id, roleId: role.role_id, grant: false })}
                    >
                      ×
                    </button>
                  )}
                </Badge>
              );
            })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "assign",
      header: "تعيين دور",
      cell: (u) => (
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={!assignRole || assign.isPending}
          onClick={() => assign.mutate({ userId: u.id, roleId: assignRole, grant: true })}
        >
          <UserPlus className="h-3 w-3" /> تعيين
        </Button>
      ),
    },
  ];

  return (
    <AdminShell
      title="مصفوفة الصلاحيات"
      description="اربط كل دور إداري بالصلاحيات المسموح بها، ثم عيّن الأدوار للمستخدمين"
      icon={KeyRound}
      permission="roles.manage"
    >
      <Card className="p-4 mb-6 overflow-x-auto">
        <h3 className="font-bold text-sm mb-3">الأدوار × الصلاحيات</h3>
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 text-start font-semibold">الصلاحية</th>
              {roleList.map((r) => (
                <th key={r.role_id} className="p-2 text-center font-semibold whitespace-nowrap">
                  {r.role_name}
                  {r.system_role && <span className="block text-[10px] text-muted-foreground">نظامي</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.isLoading && (
              <tr>
                <td colSpan={roleList.length + 1} className="p-6 text-center text-muted-foreground">
                  جاري التحميل…
                </td>
              </tr>
            )}
            {PERMISSION_GROUPS.map((g) => (
              <Fragment key={g.group}>
                <tr className="border-t bg-muted/30">
                  <td colSpan={roleList.length + 1} className="p-2 text-xs font-semibold text-muted-foreground">
                    {g.group}
                  </td>
                </tr>
                {g.codes.map((code) => (
                  <tr key={code} className="border-t">
                    <td className="p-2">{PERMISSION_LABELS[code]}</td>
                    {roleList.map((r) => {
                      const has = r.permission_codes.includes(code);
                      return (
                        <td key={r.role_id} className="p-2 text-center">
                          <Checkbox
                            checked={has}
                            disabled={togglePermission.isPending}
                            aria-label={`${r.role_name} — ${PERMISSION_LABELS[code]}`}
                            onCheckedChange={(v) =>
                              togglePermission.mutate({ roleId: r.role_id, code, grant: v === true })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="min-w-48">
          <p className="text-xs text-muted-foreground mb-1">الدور المراد تعيينه</p>
          <Select value={assignRole} onValueChange={setAssignRole}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="اختر دوراً إدارياً" />
            </SelectTrigger>
            <SelectContent>
              {roleList.map((r) => (
                <SelectItem key={r.role_id} value={r.role_id}>
                  {r.role_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="ابحث عن مستخدم" />
      </div>

      <DataTable
        columns={userColumns}
        rows={filteredUsers}
        loading={users.isLoading}
        rowKey={(u) => u.id}
        emptyText="لا نتائج"
      />
    </AdminShell>
  );
}
