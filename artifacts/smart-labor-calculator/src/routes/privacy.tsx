import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "سياسة الخصوصية" }, { name: "description", content: "كيف نتعامل مع بياناتك في حاسبة العمال الذكية." }] }),
  component: () => (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto px-4 py-10 max-w-3xl prose prose-sm sm:prose-base">
        <h1 className="font-display text-3xl font-bold mb-4">سياسة الخصوصية</h1>
        <p className="text-muted-foreground leading-relaxed">نلتزم بحماية خصوصيتك. لا نشارك بياناتك مع أي طرف ثالث دون موافقتك الصريحة. تُخزَّن بياناتك بشكل مشفّر، ولك حق الوصول إليها وتعديلها وحذفها في أي وقت.</p>
        <h2 className="font-bold text-xl mt-6 mb-2">البيانات التي نجمعها</h2>
        <ul className="list-disc pr-5 space-y-1 text-sm text-muted-foreground">
          <li>الاسم الكامل والبريد الإلكتروني ورقم الجوال (عند التسجيل).</li>
          <li>بيانات الحسابات التي تجريها (الراتب، سنوات الخدمة، النتائج).</li>
          <li>أوقات الدخول والاستخدام لأغراض الأمن.</li>
        </ul>
        <h2 className="font-bold text-xl mt-6 mb-2">حقوقك</h2>
        <p className="text-sm text-muted-foreground">يمكنك حذف حسابك وبياناتك في أي وقت من صفحة الملف الشخصي.</p>
      </main>
    </div>
  ),
});
