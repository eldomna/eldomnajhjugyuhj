import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/roles")({
  component: RolesPage,
});

function RolesPage() {
  const qc = useQueryClient();
  const [newRole, setNewRole] = useState({ code: "", name: "", description: "" });
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [assign, setAssign] = useState({ email: "", roleId: "", orgId: "none", branchId: "none" });

  const { data: roles } = useQuery({
    queryKey: ["admin", "admin_roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_roles")
        .select("id, role_code, role_name, description, system_role")
        .order("system_role", { ascending: false })
        .order("role_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: permissions } = useQuery({
    queryKey: ["admin", "admin_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_permissions")
        .select("id, permission_code, permission_name, module")
        .order("module");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rolePerms } = useQuery({
    queryKey: ["admin", "admin_role_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_role_permissions").select("role_id, permission_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orgs } = useQuery({
    queryKey: ["admin", "orgs-lite"],
    queryFn: async () => (await supabase.from("organizations").select("id, name").order("name")).data ?? [],
  });
  const { data: branches } = useQuery({
    queryKey: ["admin", "branches-lite"],
    queryFn: async () => (await supabase.from("branches").select("id, name").order("name")).data ?? [],
  });

  const { data: assignments } = useQuery({
    queryKey: ["admin", "role_assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_role_assignments")
        .select("id, user_id, role_id, organization_id, branch_id, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((a) => a.user_id))];
      const profiles = ids.length
        ? ((await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? [])
        : [];
      return (data ?? []).map((a) => ({ ...a, profile: profiles.find((p) => p.id === a.user_id) ?? null }));
    },
  });

  const selectedRole = activeRole ?? roles?.[0]?.id ?? null;
  const has = (permId: string) =>
    (rolePerms ?? []).some((rp) => rp.role_id === selectedRole && rp.permission_id === permId);

  const togglePerm = async (permId: string, next: boolean) => {
    if (!selectedRole) return;
    const res = next
      ? await supabase.from("admin_role_permissions").insert({ role_id: selectedRole, permission_id: permId })
      : await supabase
          .from("admin_role_permissions")
          .delete()
          .eq("role_id", selectedRole)
          .eq("permission_id", permId);
    if (res.error) return toast.error(res.error.message);
    qc.invalidateQueries({ queryKey: ["admin", "admin_role_permissions"] });
  };

  const createRole = async () => {
    if (!newRole.code || !newRole.name) return toast.error("أدخل رمز واسم الدور");
    const { error } = await supabase.from("admin_roles").insert({
      role_code: newRole.code,
      role_name: newRole.name,
      description: newRole.description || null,
      system_role: false,
    });
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء الدور");
    setNewRole({ code: "", name: "", description: "" });
    qc.invalidateQueries({ queryKey: ["admin", "admin_roles"] });
  };

  const createAssignment = async () => {
    if (!assign.email || !assign.roleId) return toast.error("أدخل البريد واختر الدور");
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", assign.email.trim())
      .maybeSingle();
    if (!profile) return toast.error("لا يوجد مستخدم بهذا البريد");
    const { error } = await supabase.from("admin_role_assignments").insert({
      user_id: profile.id,
      role_id: assign.roleId,
      organization_id: assign.orgId === "none" ? null : assign.orgId,
      branch_id: assign.branchId === "none" ? null : assign.branchId,
    });
    if (error) return toast.error(error.message);
    toast.success("تم تعيين الدور");
    setAssign({ email: "", roleId: "", orgId: "none", branchId: "none" });
    qc.invalidateQueries({ queryKey: ["admin", "role_assignments"] });
  };

  const modules = [...new Set((permissions ?? []).map((p) => p.module))];

  return (
    <AdminShell
      permission="roles.manage"
      title="الأدوار والصلاحيات"
      description="نظام RBAC مرن على مستوى الوحدة والعملية، مع تعيينات على مستوى المؤسسة والفرع"
      icon={ShieldCheck}
    >
      <Tabs defaultValue="matrix">
        <TabsList className="mb-4">
          <TabsTrigger value="matrix">مصفوفة الصلاحيات</TabsTrigger>
          <TabsTrigger value="roles">الأدوار</TabsTrigger>
          <TabsTrigger value="assignments">التعيينات</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          <Card className="p-4 mb-4">
            <Label className="text-xs">الدور</Label>
            <Select value={selectedRole ?? ""} onValueChange={setActiveRole}>
              <SelectTrigger className="max-w-sm"><SelectValue placeholder="اختر دوراً" /></SelectTrigger>
              <SelectContent>
                {(roles ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.role_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
          <div className="grid md:grid-cols-2 gap-4">
            {modules.map((mod) => (
              <Card key={mod} className="p-4">
                <h3 className="font-bold text-sm mb-3">{mod}</h3>
                <div className="space-y-2">
                  {(permissions ?? [])
                    .filter((p) => p.module === mod)
                    .map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={has(p.id)} onCheckedChange={(v) => togglePerm(p.id, Boolean(v))} />
                        <span>{p.permission_name}</span>
                        <code className="text-[10px] text-muted-foreground">{p.permission_code}</code>
                      </label>
                    ))}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="p-4 mb-4">
            <h3 className="font-bold text-sm mb-3">إنشاء دور مخصص</h3>
            <div className="grid md:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">الرمز</Label>
                <Input value={newRole.code} onChange={(e) => setNewRole({ ...newRole, code: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">الاسم</Label>
                <Input value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">الوصف</Label>
                <Input
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                />
              </div>
              <Button onClick={createRole}><Plus className="h-4 w-4 ml-1" /> إضافة</Button>
            </div>
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">الدور</th>
                  <th className="p-2 text-right">الرمز</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">الوصف</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(roles ?? []).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 font-medium">{r.role_name}</td>
                    <td className="p-2"><code className="text-xs">{r.role_code}</code></td>
                    <td className="p-2">
                      <Badge variant={r.system_role ? "secondary" : "outline"}>
                        {r.system_role ? "دور نظام" : "مخصص"}
                      </Badge>
                    </td>
                    <td className="p-2 text-muted-foreground text-xs">{r.description ?? "—"}</td>
                    <td className="p-2">
                      {!r.system_role && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await supabase.from("admin_roles").delete().eq("id", r.id);
                            qc.invalidateQueries({ queryKey: ["admin", "admin_roles"] });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card className="p-4 mb-4">
            <h3 className="font-bold text-sm mb-3">تعيين دور لمستخدم</h3>
            <div className="grid md:grid-cols-5 gap-3 items-end">
              <div>
                <Label className="text-xs">بريد المستخدم</Label>
                <Input value={assign.email} onChange={(e) => setAssign({ ...assign, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">الدور</Label>
                <Select value={assign.roleId} onValueChange={(v) => setAssign({ ...assign, roleId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {(roles ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.role_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">المؤسسة</Label>
                <Select value={assign.orgId} onValueChange={(v) => setAssign({ ...assign, orgId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">الكل</SelectItem>
                    {(orgs ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الفرع</Label>
                <Select value={assign.branchId} onValueChange={(v) => setAssign({ ...assign, branchId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">الكل</SelectItem>
                    {(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createAssignment}><Plus className="h-4 w-4 ml-1" /> تعيين</Button>
            </div>
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2 text-right">المستخدم</th>
                  <th className="p-2 text-right">الدور</th>
                  <th className="p-2 text-right">المؤسسة</th>
                  <th className="p-2 text-right">الفرع</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(assignments ?? []).map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{a.profile?.full_name || a.profile?.email || a.user_id.slice(0, 8)}</td>
                    <td className="p-2">{(roles ?? []).find((r) => r.id === a.role_id)?.role_name ?? "—"}</td>
                    <td className="p-2">{(orgs ?? []).find((o) => o.id === a.organization_id)?.name ?? "الكل"}</td>
                    <td className="p-2">{(branches ?? []).find((b) => b.id === a.branch_id)?.name ?? "الكل"}</td>
                    <td className="p-2"><Badge variant="outline">{a.status}</Badge></td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await supabase.from("admin_role_assignments").delete().eq("id", a.id);
                          qc.invalidateQueries({ queryKey: ["admin", "role_assignments"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(assignments ?? []).length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد تعيينات</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
