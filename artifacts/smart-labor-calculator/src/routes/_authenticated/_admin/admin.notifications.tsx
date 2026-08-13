import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/notifications")({
  component: NotificationsPage,
});

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success: "bg-green-500/10 text-green-700 dark:text-green-300",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "bg-red-500/10 text-red-700 dark:text-red-300",
};

function NotificationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "notifications", filter],
    queryFn: async () => {
      let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
      if (filter === "unread") q = q.eq("read", false);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((n) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      n.title?.toLowerCase().includes(s) ||
      n.message?.toLowerCase().includes(s) ||
      n.type?.toLowerCase().includes(s)
    );
  });

  const unreadCount = (data ?? []).filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString(), read_by: userData.user?.id ?? null })
      .eq("id", id);
    if (error) return toast.error("تعذر تحديث الإشعار");
    qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
  };

  const markAllRead = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString(), read_by: userData.user?.id ?? null })
      .eq("read", false);
    if (error) return toast.error("تعذر التحديث");
    toast.success("تم تعليم الكل كمقروء");
    qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) return toast.error("تعذر الحذف");
    qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">الإشعارات</h1>
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setFilter(filter === "all" ? "unread" : "all")}>
              {filter === "all" ? "غير المقروءة فقط" : "عرض الكل"}
            </Button>
            <Button size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
              <Check className="h-4 w-4 ml-1" /> تعليم الكل
            </Button>
          </div>
        </div>

        <Card className="p-4 mb-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث في العنوان أو الرسالة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </Card>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            لا توجد إشعارات
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => (
              <Card key={n.id} className={`p-4 ${!n.read ? "border-primary/40 bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${SEVERITY_COLORS[n.severity] ?? SEVERITY_COLORS.info}`}>
                        {n.severity}
                      </span>
                      <span className="text-xs text-muted-foreground">{n.type}</span>
                      {!n.read && <Badge variant="secondary" className="text-xs">جديد</Badge>}
                    </div>
                    <h3 className="font-semibold">{n.title}</h3>
                    {n.message && <p className="text-sm text-muted-foreground mt-1">{n.message}</p>}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(n.created_at).toLocaleString("ar")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!n.read && (
                      <Button variant="ghost" size="icon" onClick={() => markRead(n.id)} title="تعليم كمقروء">
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove(n.id)} title="حذف">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
