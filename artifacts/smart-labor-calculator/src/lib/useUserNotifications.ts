import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserNotification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  severity: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

/** إشعارات المستخدم الداخلية (طلبات الاشتراك والقبول والرفض). */
export function useUserNotifications(enabled = true) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["user-notifications"],
    enabled,
    queryFn: async (): Promise<UserNotification[]> => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return [];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("id, type, title, message, severity, link, read, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) return [];
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const items = query.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  const markRead = async (id?: string) => {
    const q = supabase.from("user_notifications").update({ read: true, read_at: new Date().toISOString() });
    if (id) await q.eq("id", id);
    else await q.eq("read", false);
    qc.invalidateQueries({ queryKey: ["user-notifications"] });
  };

  return { items, unread, loading: query.isLoading, markRead, refetch: query.refetch };
}
