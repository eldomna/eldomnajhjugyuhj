import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, LogIn } from "lucide-react";

export function AccessGate({ mode }: { mode: "signin" | "subscribe" }) {
  if (mode === "signin") {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto">
        <LogIn className="h-10 w-10 text-primary mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">سجّل الدخول لاستخدام الحاسبة</h2>
        <p className="text-sm text-muted-foreground mb-6">
          إنشاء الحساب مجاني، وتحصل على حساب تجريبي مجاني واحد لكل رقم جوال.
        </p>
        <Button asChild size="lg">
          <Link to="/auth">دخول / إنشاء حساب</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-8 text-center max-w-xl mx-auto">
      <Lock className="h-10 w-10 text-primary mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">انتهت تجربتك المجانية</h2>
      <p className="text-sm text-muted-foreground mb-6">
        لقد استخدمت الحساب التجريبي المجاني المتاح لرقم جوالك. اشترك الآن للوصول الكامل
        لجميع الحاسبات والتقارير القانونية.
      </p>
      <Button asChild size="lg" className="gap-2">
        <Link to="/subscribe">
          <Sparkles className="h-4 w-4" /> عرض باقات الاشتراك
        </Link>
      </Button>
    </Card>
  );
}
