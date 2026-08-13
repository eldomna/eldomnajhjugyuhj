import {
  LayoutDashboard,
  Gauge,
  Briefcase,
  Users,
  ShieldCheck,
  Building2,
  Scale,
  Globe2,
  FileText,
  Brain,
  CreditCard,
  Receipt,
  Bell,
  Plug,
  Archive,
  Lock,
  ScrollText,
  Settings,
  ToggleLeft,
  KeyRound,
} from "lucide-react";
import type { AdminPermission } from "@/lib/admin/permissions";

export type AdminModule = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  permission?: AdminPermission;
};

export const ADMIN_MODULES: AdminModule[] = [
  { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, group: "نظرة عامة", permission: "overview.view" },
  { to: "/admin/overview", label: "لوحة المؤشرات", icon: Gauge, group: "نظرة عامة", permission: "overview.view" },
  { to: "/admin/cases", label: "القضايا", icon: Briefcase, group: "العمليات", permission: "cases.manage" },
  { to: "/admin/users", label: "المستخدمون", icon: Users, group: "العمليات", permission: "users.view" },
  { to: "/admin/roles", label: "الأدوار والصلاحيات", icon: ShieldCheck, group: "العمليات", permission: "roles.manage" },
  { to: "/admin/permissions", label: "مصفوفة الصلاحيات", icon: KeyRound, group: "العمليات", permission: "roles.manage" },
  { to: "/admin/organizations", label: "المؤسسات والفروع", icon: Building2, group: "العمليات", permission: "organizations.manage" },
  { to: "/admin/legal-engine", label: "محرك القوانين", icon: Scale, group: "المحتوى القانوني", permission: "legal.manage" },
  { to: "/admin/legal-rules", label: "إصدارات القوانين", icon: ScrollText, group: "المحتوى القانوني", permission: "legal.manage" },
  { to: "/admin/countries", label: "الدول", icon: Globe2, group: "المحتوى القانوني", permission: "legal.manage" },
  { to: "/admin/reports-center", label: "مركز التقارير", icon: FileText, group: "المحتوى القانوني", permission: "reports.view" },
  { to: "/admin/ai-monitoring", label: "مراقبة الذكاء الاصطناعي", icon: Brain, group: "المحتوى القانوني", permission: "ai.view" },
  { to: "/admin/subscriptions", label: "الاشتراكات", icon: CreditCard, group: "المالية", permission: "subscriptions.manage" },
  { to: "/admin/billing", label: "الفوترة", icon: Receipt, group: "المالية", permission: "billing.manage" },
  { to: "/admin/notifications", label: "الإشعارات", icon: Bell, group: "النظام", permission: "notifications.manage" },
  { to: "/admin/api", label: "واجهات API", icon: Plug, group: "النظام", permission: "api.manage" },
  { to: "/admin/backups", label: "النسخ الاحتياطية", icon: Archive, group: "النظام", permission: "backups.manage" },
  { to: "/admin/security", label: "مركز الأمان", icon: Lock, group: "النظام", permission: "security.manage" },
  { to: "/admin/audit", label: "سجل التدقيق", icon: ScrollText, group: "النظام", permission: "audit.view" },
  { to: "/admin/features", label: "مفاتيح الميزات", icon: ToggleLeft, group: "النظام", permission: "features.manage" },
  { to: "/admin/settings", label: "إعدادات النظام", icon: Settings, group: "النظام", permission: "settings.manage" },
];

export const ADMIN_GROUPS = ["نظرة عامة", "العمليات", "المحتوى القانوني", "المالية", "النظام"];

export function findAdminModule(pathname: string): AdminModule | undefined {
  return [...ADMIN_MODULES]
    .sort((a, b) => b.to.length - a.to.length)
    .find((m) => pathname === m.to || pathname.startsWith(m.to + "/"));
}
