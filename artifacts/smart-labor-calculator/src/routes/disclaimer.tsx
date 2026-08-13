import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({ meta: [{ title: "إخلاء المسؤولية" }, { name: "description", content: "إخلاء مسؤولية حاسبة العمال الذكية." }] }),
  component: () => (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-display text-3xl font-bold mb-4">إخلاء المسؤولية</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          المعلومات والحسابات المقدمة في هذه المنصة لأغراض معلوماتية فقط، وليست بديلاً عن
          الاستشارة القانونية الرسمية. يُنصح بمراجعة محامٍ مختصّ بقضايا العمل قبل اتخاذ
          أي إجراء قانوني. لا تتحمل المنصة أي مسؤولية عن أي قرار يُتَّخذ بناءً على هذه النتائج.
        </p>
      </main>
    </div>
  ),
});
