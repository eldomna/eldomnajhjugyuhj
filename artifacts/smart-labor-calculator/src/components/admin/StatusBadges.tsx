import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MinusCircle } from "lucide-react";

/** Reusable active/inactive pill for admin lists. */
export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/15" variant="secondary">
      <CheckCircle2 className="h-3 w-3" /> نشط
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <MinusCircle className="h-3 w-3" /> معطّل
    </Badge>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  lawyer: "محامي",
  user: "مستخدم",
};

export function RoleBadges({ roles }: { roles: string[] }) {
  if (!roles.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-[11px]">
          {ROLE_LABELS[r] ?? r}
        </Badge>
      ))}
    </div>
  );
}
