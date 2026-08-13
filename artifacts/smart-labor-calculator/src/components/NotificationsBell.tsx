import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUserNotifications } from "@/lib/useUserNotifications";

/** جرس الإشعارات الداخلية للمستخدم المسجل. */
export function NotificationsBell() {
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user)).catch(() => setSignedIn(false));
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { items, unread, markRead } = useUserNotifications(signedIn);

  if (!signedIn) return null;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" aria-label="الإشعارات" onClick={() => setOpen((o) => !o)}>
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center tabular-nums">
            {unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 end-0 w-80 max-w-[85vw] rounded-lg border bg-popover shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-semibold">الإشعارات</span>
              {unread > 0 && (
                <button className="text-xs text-primary flex items-center gap-1" onClick={() => markRead()}>
                  <CheckCheck className="h-3.5 w-3.5" /> تعليم الكل كمقروء
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">لا توجد إشعارات.</p>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    className={`px-3 py-2 border-b last:border-0 text-sm ${n.read ? "" : "bg-primary/5"}`}
                    onClick={() => !n.read && markRead(n.id)}
                  >
                    <div className="font-medium">{n.title}</div>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground" dir="ltr">
                        {new Date(n.created_at).toLocaleString("en-GB")}
                      </span>
                      {n.link === "/my-subscription" && (
                        <Link to="/my-subscription" className="text-[11px] text-primary" onClick={() => setOpen(false)}>
                          عرض الاشتراك
                        </Link>
                      )}
                      {n.link === "/subscribe" && (
                        <Link to="/subscribe" className="text-[11px] text-primary" onClick={() => setOpen(false)}>
                          إعادة الإرسال
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
