import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Doc = {
  id: string;
  lawyer_id: string;
  kind: string;
  file_url: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  license: "ترخيص مزاولة",
  professional: "بطاقة مهنية",
  other: "أخرى",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "بانتظار",
  approved: "مقبول",
  rejected: "مرفوض",
};

export function LawyerDocsManager({ lawyerId, canModerate = true }: { lawyerId: string; canModerate?: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<string>("license");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("lawyer_documents")
      .select("*")
      .eq("lawyer_id", lawyerId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setDocs(data || []);
  }

  useEffect(() => { if (lawyerId) load(); /* eslint-disable-next-line */ }, [lawyerId]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("الحد الأقصى 10MB"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${lawyerId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const up = await supabase.storage.from("lawyer-docs").upload(path, file, { upsert: false });
    if (up.error) { setUploading(false); toast.error(up.error.message); return; }

    const { error } = await (supabase as any).from("lawyer_documents").insert({
      lawyer_id: lawyerId, kind, file_url: path, status: "pending", notes: notes || null,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setNotes("");
    toast.success("تم رفع الوثيقة");
    load();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await (supabase as any).from("lawyer_documents").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم التحديث");
    load();
  }

  async function remove(d: Doc) {
    if (!confirm("حذف هذه الوثيقة؟")) return;
    await supabase.storage.from("lawyer-docs").remove([d.file_url]);
    const { error } = await (supabase as any).from("lawyer_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    load();
  }

  async function open(d: Doc) {
    const { data, error } = await supabase.storage.from("lawyer-docs").createSignedUrl(d.file_url, 300);
    if (error || !data) return toast.error(error?.message || "تعذّر فتح الملف");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-primary" /> وثائق المحامي
      </div>

      <div className="grid sm:grid-cols-[160px_1fr_auto] gap-2 items-start">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(KIND_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium border bg-primary text-primary-foreground cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="h-4 w-4" />
          {uploading ? "جارٍ الرفع..." : "رفع"}
          <input type="file" hidden accept="image/*,application/pdf" onChange={onUpload} disabled={uploading} />
        </label>
      </div>

      <div className="space-y-1.5">
        {loading && <p className="text-xs text-muted-foreground">جارٍ التحميل...</p>}
        {!loading && docs.length === 0 && <p className="text-xs text-muted-foreground">لا توجد وثائق.</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-2 bg-background rounded-md border px-2.5 py-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs flex-1 truncate">{KIND_LABEL[d.kind] || d.kind} {d.notes ? `— ${d.notes}` : ""}</span>
            <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">
              {STATUS_LABEL[d.status] || d.status}
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => open(d)} title="فتح"><ExternalLink className="h-3.5 w-3.5" /></Button>
            {canModerate && d.status !== "approved" && <Button size="sm" variant="ghost" onClick={() => setStatus(d.id, "approved")} className="text-xs h-7 px-2">قبول</Button>}
            {canModerate && d.status !== "rejected" && <Button size="sm" variant="ghost" onClick={() => setStatus(d.id, "rejected")} className="text-xs h-7 px-2">رفض</Button>}
            <Button size="sm" variant="ghost" onClick={() => remove(d)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
