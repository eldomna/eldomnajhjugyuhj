import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LegalReference = {
  id: string;
  article_number: string;
  title: string;
  summary: string;
  approval_status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  last_review_date: string | null;
  sort_order: number;
};

export const PENDING_REFERENCE_NOTICE =
  "مرجع قانوني قيد المراجعة من إدارة المنصة";

export function formatLegalReference(r: Pick<LegalReference, "article_number" | "title" | "summary">) {
  const art = r.article_number && r.article_number !== "—" ? `المادة (${r.article_number}): ` : "";
  return `${art}${r.title} — ${r.summary}`;
}

export async function fetchApprovedLegalReferences(): Promise<LegalReference[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return [];
  const { data, error } = await (supabase as any)
    .from("legal_references")
    .select("*")
    .eq("approval_status", "approved")
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data || []) as LegalReference[];
}

export function useApprovedLegalReferences() {
  return useQuery({
    queryKey: ["legal-references", "approved"],
    queryFn: fetchApprovedLegalReferences,
    enabled: typeof navigator === "undefined" || navigator.onLine,
    staleTime: 60_000,
  });
}
