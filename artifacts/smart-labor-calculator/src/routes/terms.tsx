import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "شروط الاستخدام" }, { name: "description", content: "شروط استخدام حاسبة العمال الذكية." }] }),
  component: () => (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-display text-3xl font-bold mb-4">شروط الاستخدام</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          باستخدامك لهذه المنصة فإنك توافق على استخدام الحاسبة لأغراض شخصية أو مهنية مشروعة فقط.
          النتائج إرشادية ومبنية على المعطيات المُدخلة من قِبلك، ولا تُعدّ بديلاً عن الاستشارة القانونية.
          نحتفظ بحق تعديل هذه الشروط أو الخدمة في أي وقت دون إشعار مسبق.
        </p>
      </main>
    </div>
  ),
});
