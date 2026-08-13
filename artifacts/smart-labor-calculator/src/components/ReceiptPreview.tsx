import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, ImageOff, Loader2 } from "lucide-react";

interface Props {
  /** مسار الملف داخل حاوية الإيصالات الخاصة (وليس رابطاً عاماً). */
  path: string;
}

interface Meta {
  name: string;
  size: number | null;
  uploadedAt: string | null;
}

function humanSize(bytes: number | null) {
  if (bytes === null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * معاينة إيصال التحويل داخل لوحة الإدارة: صورة مصغّرة أو ملف PDF،
 * مع اسم الملف وحجمه وتاريخ الرفع. الروابط موقّعة ومؤقتة للحفاظ على الخصوصية.
 */
export function ReceiptPreview({ path }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fileName = path.split("/").pop() ?? path;
  const isPdf = fileName.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);

      const folder = path.split("/").slice(0, -1).join("/");
      const [signed, listed] = await Promise.all([
        supabase.storage.from("receipts").createSignedUrl(path, 600),
        supabase.storage.from("receipts").list(folder, { search: fileName, limit: 100 }),
      ]);

      if (!alive) return;

      if (signed.error || !signed.data) {
        setError("تعذر تحميل الإيصال");
        setLoading(false);
        return;
      }
      setUrl(signed.data.signedUrl);

      const entry = (listed.data ?? []).find((f) => f.name === fileName);
      setMeta({
        name: fileName,
        size: (entry?.metadata as { size?: number } | null)?.size ?? null,
        uploadedAt: entry?.created_at ?? null,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [path, fileName]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ تحميل الإيصال...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive py-2">
        <ImageOff className="h-3.5 w-3.5" /> {error ?? "تعذر تحميل الإيصال"}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-semibold">إيصال التحويل</p>

      {isPdf ? (
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-4">
          <FileText className="h-6 w-6 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground">ملف PDF — افتحه لعرض المحتوى.</span>
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={url}
            alt={`إيصال التحويل ${fileName}`}
            loading="lazy"
            className="max-h-56 w-auto rounded-md border object-contain bg-background"
          />
        </a>
      )}

      <dl className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-3">
        <div className="truncate">
          <dt className="inline">اسم الملف: </dt>
          <dd className="inline text-foreground font-medium" dir="ltr">{meta?.name}</dd>
        </div>
        <div>
          <dt className="inline">الحجم: </dt>
          <dd className="inline text-foreground font-medium tabular-nums" dir="ltr">{humanSize(meta?.size ?? null)}</dd>
        </div>
        <div>
          <dt className="inline">تاريخ الرفع: </dt>
          <dd className="inline text-foreground font-medium" dir="ltr">
            {meta?.uploadedAt ? new Date(meta.uploadedAt).toLocaleString("en-GB") : "—"}
          </dd>
        </div>
      </dl>

      <Button asChild variant="outline" size="sm" className="gap-1 h-8">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" /> فتح الإيصال بحجم كامل
        </a>
      </Button>
    </div>
  );
}
