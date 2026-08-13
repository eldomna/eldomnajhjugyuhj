import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Shield, ShieldOff, Power, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { SearchInput } from "@/components/admin/SearchInput";
import { ActiveBadge, RoleBadges } from "@/components/admin/StatusBadges";
import { Can } from "@/components/admin/PermissionGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/_admin/admin/users")({
  component: AdminUsersPage,
});

const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  roles: string[];
  admin_roles: string[];
};

function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ user: UserRow; kind: "reset" } | null>(null);

  const { data, isLoading } = useQuery<UserRow[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data, error } = await db.rpc("admin_list_users", { _search: null });
      if (error) throw new Error(error.message);
      return (data ?? []) as UserRow[];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((u) =>
      [u.full_name, u.email, u.mobile_number].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [data, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "my-permissions"] });
  };

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.rpc("admin_set_user_active", { _user_id: id, _active: active });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(v.active ? "تم تفعيل الحساب" : "تم تعطيل الحساب");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role, grant }: { id: string; role: string; grant: boolean }) => {
      const { error } = await db.rpc("admin_set_user_role", { _user_id: id, _role: role, _grant: grant });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم تحديث الدور");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetRoles = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("admin_reset_user_roles", { _user_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      toast.success("تمت إعادة تعيين الصلاحيات إلى مستخدم عادي");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = setActive.isPending || setRole.isPending || resetRoles.isPending;

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "المستخدم",
      cell: (u) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{u.full_name || "—"}</div>
          <div className="text-xs text-muted-foreground truncate">{u.email || "—"}</div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "الجوال",
      cell: (u) => <span className="text-muted-foreground">{u.mobile_number || "—"}</span>,
    },
    {
      key: "country",
      header: "الدولة",
      cell: (u) => <Badge variant="outline">{u.country === "SA" ? "السعودية" : "اليمن"}</Badge>,
    },
    { key: "roles", header: "الأدوار", cell: (u) => <RoleBadges roles={u.roles} /> },
    {
      key: "adminRoles",
      header: "أدوار إدارية",
      cell: (u) =>
        u.admin_roles.length ? (
          <div className="flex flex-wrap gap-1">
            {u.admin_roles.map((r) => (
              <Badge key={r} variant="secondary" className="text-[11px]">{r}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { key: "status", header: "الحالة", cell: (u) => <ActiveBadge active={u.is_active} /> },
    {
      key: "created",
      header: "انضم في",
      cell: (u) => (
        <span className="text-xs text-muted-foreground">
          {new Date(u.created_at).toLocaleDateString("ar-SA")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "إجراءات",
      cell: (u) => (
        <Can permission="users.manage">
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={u.is_active ? "outline" : "default"}
              disabled={busy}
              className="gap-1"
              onClick={() => setActive.mutate({ id: u.id, active: !u.is_active })}
            >
              <Power className="h-3 w-3" />
              {u.is_active ? "تعطيل" : "تفعيل"}
            </Button>
            <Button
              size="sm"
              variant={u.roles.includes("admin") ? "outline" : "secondary"}
              disabled={busy}
              className="gap-1"
              onClick={() =>
                setRole.mutate({ id: u.id, role: "admin", grant: !u.roles.includes("admin") })
              }
            >
              {u.roles.includes("admin") ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              {u.roles.includes("admin") ? "سحب الإدارة" : "ترقية لمدير"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              className="gap-1 text-destructive"
              onClick={() => setConfirm({ user: u, kind: "reset" })}
            >
              <RotateCcw className="h-3 w-3" /> إعادة تعيين
            </Button>
          </div>
        </Can>
      ),
    },
  ];

  const activeCount = (data ?? []).filter((u) => u.is_active).length;
  const adminCount = (data ?? []).filter((u) => u.roles.includes("admin")).length;

  return (
    <AdminShell
      title="إدارة المستخدمين"
      description="قائمة المستخدمين مع البحث، التفعيل/التعطيل، وإدارة الأدوار والصلاحيات"
      icon={Users}
      permission="users.view"
      actions={<SearchInput value={search} onChange={setSearch} placeholder="ابحث بالاسم أو البريد أو الجوال" />}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "إجمالي المستخدمين", value: data?.length ?? 0 },
          { label: "حسابات مفعّلة", value: activeCount },
          { label: "حسابات معطّلة", value: (data?.length ?? 0) - activeCount },
          { label: "مديرو النظام", value: adminCount },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-2xl font-bold">{isLoading ? "—" : s.value.toLocaleString("ar-SA")}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(u) => u.id}
        emptyText={search ? "لا نتائج مطابقة للبحث" : "لا يوجد مستخدمون"}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إعادة تعيين الصلاحيات</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم سحب جميع الأدوار والأدوار الإدارية من «{confirm?.user.full_name || confirm?.user.email}»
              وإرجاعه إلى مستخدم عادي. لا يمكن التراجع عن هذه العملية.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && resetRoles.mutate(confirm.user.id)}
              disabled={resetRoles.isPending}
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
