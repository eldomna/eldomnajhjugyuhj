import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, MapPin, Star, Briefcase } from "lucide-react";

export type LawyerListItem = {
  id: string;
  full_name: string;
  slug: string;
  photo_url: string | null;
  governorate: string;
  city: string | null;
  office_name: string | null;
  years_experience: number | null;
  specializations: string[] | null;
  verification_status: string;
  avg_rating: number;
  reviews_count: number;
};

export function VerifiedBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 ${size === "md" ? "text-sm" : "text-xs"} font-semibold`}>
      <ShieldCheck className="h-3.5 w-3.5" /> محامٍ موثّق
    </span>
  );
}

export function LawyerCard({ lawyer }: { lawyer: LawyerListItem }) {
  return (
    <Link to="/lawyers/$slug" params={{ slug: lawyer.slug }}>
      <Card className="p-4 h-full hover:border-primary transition-colors">
        <div className="flex gap-3">
          <div className="h-16 w-16 shrink-0 rounded-full overflow-hidden bg-muted grid place-items-center">
            {lawyer.photo_url ? (
              <img src={lawyer.photo_url} alt={lawyer.full_name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-muted-foreground">{lawyer.full_name.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold truncate">{lawyer.full_name}</h3>
              {lawyer.verification_status === "approved" && <VerifiedBadge />}
            </div>
            {lawyer.office_name && <p className="text-xs text-muted-foreground truncate">{lawyer.office_name}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{lawyer.governorate}{lawyer.city ? ` — ${lawyer.city}` : ""}</span>
              {lawyer.years_experience ? (
                <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{lawyer.years_experience} سنة</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                <Star className="h-3.5 w-3.5 fill-current" />
                {Number(lawyer.avg_rating || 0).toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">({lawyer.reviews_count} تقييم)</span>
            </div>
            {lawyer.specializations && lawyer.specializations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {lawyer.specializations.slice(0, 3).map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
