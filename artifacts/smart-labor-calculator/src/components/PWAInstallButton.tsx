import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Props {
  variant?: "default" | "secondary" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
}

type Platform = "ios-safari" | "ios-other" | "android" | "desktop";

const INSTALLED_KEY = "pwa:installed";

// Module-level singleton: captures the browser's beforeinstallprompt event
// once per page load and shares it across every mounted button, preventing
// duplicate prompts / duplicate listeners when routes remount the component.
let cachedPrompt: BeforeInstallPromptEvent | null = null;
let promptConsumed = false;
const promptSubscribers = new Set<(p: BeforeInstallPromptEvent | null) => void>();
const installedSubscribers = new Set<(v: boolean) => void>();
let listenersBound = false;

function notifyPrompt(p: BeforeInstallPromptEvent | null) {
  cachedPrompt = p;
  promptSubscribers.forEach((cb) => cb(p));
}
function notifyInstalled(v: boolean) {
  installedSubscribers.forEach((cb) => cb(v));
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return false;
}

function readInstalledFlag(): boolean {
  if (typeof window === "undefined") return false;
  if (detectStandalone()) return true;
  try {
    return window.localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeInstalledFlag(v: boolean) {
  try {
    if (v) window.localStorage.setItem(INSTALLED_KEY, "1");
    else window.localStorage.removeItem(INSTALLED_KEY);
  } catch {
    /* noop */
  }
}

function bindGlobalListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  const onPrompt = (e: Event) => {
    e.preventDefault();
    if (promptConsumed) return;
    notifyPrompt(e as BeforeInstallPromptEvent);
  };
  const onInstalled = () => {
    promptConsumed = true;
    writeInstalledFlag(true);
    notifyPrompt(null);
    notifyInstalled(true);
  };
  const mql = window.matchMedia("(display-mode: standalone)");
  const onDisplayChange = (e: MediaQueryListEvent) => {
    if (e.matches) {
      writeInstalledFlag(true);
      notifyPrompt(null);
      notifyInstalled(true);
    }
  };

  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  mql.addEventListener?.("change", onDisplayChange);

  // If already standalone at load time, persist the flag so refreshes stay hidden.
  if (detectStandalone()) writeInstalledFlag(true);
}

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  if (isIOS) {
    // Safari on iOS = only browser exposing "add to home screen".
    // In-app browsers (FB/IG/Line) or Chrome/Firefox on iOS use WebKit but
    // can't install — treat separately so we don't mis-instruct.
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line/.test(ua);
    return isSafari ? "ios-safari" : "ios-other";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function PWAInstallButton({ variant = "default", size = "lg", className }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => cachedPrompt,
  );
  const [installed, setInstalled] = useState<boolean>(() => readInstalledFlag());
  const [platform, setPlatform] = useState<Platform>("desktop");

  useEffect(() => {
    bindGlobalListeners();
    setPlatform(detectPlatform());

    // Sync from module state on mount (covers re-mount after route change).
    setInstalled(readInstalledFlag());
    setDeferredPrompt(cachedPrompt);

    const onPromptChange = (p: BeforeInstallPromptEvent | null) => setDeferredPrompt(p);
    const onInstalledChange = (v: boolean) => {
      setInstalled(v);
      if (v) toast.success("تم تثبيت التطبيق بنجاح");
    };
    promptSubscribers.add(onPromptChange);
    installedSubscribers.add(onInstalledChange);

    return () => {
      promptSubscribers.delete(onPromptChange);
      installedSubscribers.delete(onInstalledChange);
    };
  }, []);

  const handleNativeInstall = useCallback(async () => {
    const prompt = cachedPrompt;
    if (!prompt || promptConsumed) return;
    promptConsumed = true;
    notifyPrompt(null); // hide the button on every mounted instance
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("جارٍ تثبيت التطبيق...");
      } else {
        toast.message("تم إلغاء التثبيت");
        // Browser won't refire beforeinstallprompt in this session; keep hidden.
      }
    } catch (err) {
      console.error("PWA install prompt failed", err);
      toast.error("تعذّر بدء عملية التثبيت");
    }
  }, []);

  const handleManualInstructions = useCallback(() => {
    if (platform === "ios-safari") {
      toast.message("للتثبيت على iPhone / iPad", {
        description:
          'اضغط زر المشاركة ⬆️ في شريط Safari السفلي، ثم اختر "إضافة إلى الشاشة الرئيسية".',
        duration: 9000,
      });
    } else if (platform === "ios-other") {
      toast.message("افتح الموقع في Safari للتثبيت", {
        description:
          'التثبيت متاح على iPhone / iPad من متصفح Safari فقط، ثم زر المشاركة ⬆️ ← "إضافة إلى الشاشة الرئيسية".',
        duration: 9000,
      });
    } else if (platform === "android") {
      toast.message("للتثبيت على Android", {
        description: 'افتح قائمة المتصفح (⋮) ثم اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".',
        duration: 9000,
      });
    } else {
      toast.message("التثبيت من سطح المكتب", {
        description: 'افتح الموقع في Chrome أو Edge، ثم اضغط أيقونة التثبيت في شريط العنوان.',
        duration: 9000,
      });
    }
  }, [platform]);

  if (installed) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        <Smartphone className="h-4 w-4" /> التطبيق مثبّت
      </Button>
    );
  }

  if (deferredPrompt) {
    return (
      <Button variant={variant} size={size} className={className} onClick={handleNativeInstall}>
        <Download className="h-4 w-4" /> تثبيت التطبيق
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={handleManualInstructions}>
      <Download className="h-4 w-4" /> تثبيت التطبيق
    </Button>
  );
}
