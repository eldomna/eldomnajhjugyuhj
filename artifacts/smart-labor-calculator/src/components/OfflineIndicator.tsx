import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-full bg-foreground/90 text-background px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
    >
      <WifiOff className="h-3.5 w-3.5" />
      وضع عدم الاتصال — الحاسبة تعمل بشكل كامل
    </div>
  );
}
