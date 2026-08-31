import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { useCachedAds, AD_DEFAULT_DISPLAY_SECONDS, type CachedAd } from "@/lib/ads-cache";
import oskarBanner from "@/assets/oskar-banner.png.asset.json";
import hashemBanner from "@/assets/hashem-banner.jpg.asset.json";
import { moazBannerV2Url } from "@/assets/moaz-banner-v2";

type Ad = CachedAd;

// Static built-in slide(s) that always appear in the hero carousel alongside
// any database-driven ads. Structured like a CachedAd so future DB migration
// requires no UI/logic change — just remove this array.
const STATIC_HERO_SLIDES: CachedAd[] = [
  {
    id: "static:moaz-banner",
    title: "أ/ معاذ البناء — تحت إشراف أ.د/ رشاد العامري",
    description: "مترافع أمام المحاكم العليا — استشارات قانونية ومحاماة | واتساب 771061110 — اتصال 775155452",
    image_url: moazBannerV2Url,
    redirect_url: "https://wa.me/967771061110",
    position: "hero",
    display_seconds: 10,
  },
  {
    id: "static:hashem-banner",
    title: "المحامي هاشم المداني — للاستشارات القانونية",
    description: "للتواصل والحجز: 776634546",
    image_url: hashemBanner.url,
    redirect_url: "tel:776634546",
    position: "hero",
    display_seconds: 10,
  },
  {
    id: "static:oskar-banner",
    title: "شركة أوسكار للبرمجيات والحلول الذكية",
    description: "تم تصميم وتطوير الموقع بواسطة شركة أوسكار — +967 730 762 713",
    image_url: oskarBanner.url,
    redirect_url: null,
    position: "hero",
    display_seconds: 10,
  },
];

function getSid() {
  try {
    let s = localStorage.getItem("ylr_sid");
    if (!s) { s = crypto.randomUUID(); localStorage.setItem("ylr_sid", s); }
    return s;
  } catch { return "anon"; }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trackEvent(ad_id: string, kind: "impression" | "click") {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  // Static (non-database) slides have no uuid — skip tracking instead of erroring.
  if (!UUID_RE.test(ad_id)) return;
  (supabase as any).from("ad_events").insert({
    ad_id, kind, session_id: getSid(),
    path: typeof window !== "undefined" ? window.location.pathname : null,
  }).then(() => {}).catch(() => {});
}



export function AdHero() {
  // Hero carousel shows ONLY the two curated static banners (Hashem + Oskar).
  // DB ads are intentionally excluded here per product decision.
  const ads = useMemo<CachedAd[]>(() => STATIC_HERO_SLIDES, []);
  const seen = useRef<Set<string>>(new Set());
  // Track index can go from 0..ads.length (last is a clone of ads[0])
  const [i, setI] = useState(0);
  const [animate, setAnimate] = useState(true);
  const hovering = useRef(false);

  const multi = ads.length > 1;

  // Auto-play using the current slide's admin-configured display duration
  // (defaults to 10 seconds when unset). Only rotates when more than one ad.
  const currentRealIdx = multi ? i % ads.length : 0;
  const currentSeconds =
    ads[currentRealIdx]?.display_seconds || AD_DEFAULT_DISPLAY_SECONDS;
  useEffect(() => {
    if (!multi) return;
    const t = setTimeout(() => {
      if (hovering.current) return;
      setAnimate(true);
      setI((p) => p + 1);
    }, Math.max(2, currentSeconds) * 1000);
    return () => clearTimeout(t);
  }, [multi, currentSeconds, i]);


  // Reset index if ads list changes
  useEffect(() => {
    setI(0);
    setAnimate(false);
  }, [ads.length]);

  // After reaching the cloned slide, jump back to 0 without animation
  const onTransitionEnd = () => {
    if (multi && i >= ads.length) {
      setAnimate(false);
      setI(0);
    }
  };

  // Re-enable animation after a non-animated reset
  useEffect(() => {
    if (!animate) {
      const r = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(r);
    }
  }, [animate]);

  // Track impressions for currently displayed real slide
  useEffect(() => {
    const realIdx = multi ? i % ads.length : 0;
    const a = ads[realIdx];
    if (a && !seen.current.has(a.id)) {
      seen.current.add(a.id);
      trackEvent(a.id, "impression");
    }
  }, [i, ads, multi]);

  const heading = (
    <div className="flex items-center gap-2 mb-3">
      <Megaphone className="h-5 w-5 text-primary" />
      <h2 className="text-base sm:text-lg font-bold">لوحة الإعلانات المتحركة</h2>
    </div>
  );

  if (ads.length === 0) {
    return (
      <section className="container mx-auto px-4 pt-6" aria-label="لوحة الإعلانات المتحركة">
        {heading}
        <div className="grid min-h-32 place-items-center rounded-xl border border-dashed bg-card/70 p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground">لا توجد إعلانات نشطة حالياً</p>
        </div>
      </section>
    );
  }

  // Build slides list, with a clone of the first at the end for seamless loop
  const slides = multi ? [...ads, ads[0]] : ads;

  const goTo = (idx: number) => {
    setAnimate(true);
    setI(idx);
  };
  const next = () => { setAnimate(true); setI((p) => p + 1); };
  const prev = () => {
    if (i <= 0) {
      // jump instantly to the clone (visually identical to ads[0]), then animate to last real slide
      setAnimate(false);
      setI(ads.length);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true);
          setI(ads.length - 1);
        });
      });
    } else {
      setAnimate(true);
      setI(i - 1);
    }
  };

  const realIdx = multi ? i % ads.length : 0;

  // Touch / pointer swipe support (mobile + desktop drag).
  const dragStartX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!multi) return;
    dragStartX.current = e.clientX;
    hovering.current = true; // pause autoplay during drag
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current == null) { hovering.current = false; return; }
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    hovering.current = false;
    if (Math.abs(dx) < 40) return;
    // dir="ltr" track: swipe left (dx<0) => next, swipe right => prev
    if (dx < 0) next(); else prev();
  };

  return (
    <section className="container mx-auto px-4 pt-6" aria-label="لوحة الإعلانات المتحركة">
      {heading}
      <div
        className="relative overflow-hidden rounded-xl border bg-black shadow-sm touch-pan-y select-none aspect-video w-full"
        onMouseEnter={() => { hovering.current = true; }}
        onMouseLeave={() => { hovering.current = false; }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragStartX.current = null; hovering.current = false; }}
      >
        {/* Track. Force LTR layout so translateX math is consistent regardless of RTL parent. */}
        <div
          dir="ltr"
          className="flex w-full h-full"
          style={{
            transform: `translateX(-${i * 100}%)`,
            transition: animate ? "transform 700ms ease-in-out" : "none",
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {slides.map((a, idx) => {
            const inner = (
              <img
                src={a.image_url}
                alt={a.title}
                className="absolute inset-0 w-full h-full object-contain object-center"
                loading={idx === 0 ? "eager" : "lazy"}
                draggable={false}
                onError={(e) => {
                  console.error("[Ads] image failed to load:", a.image_url, "for ad:", a.id);
                  (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                }}
              />
            );
            return (
              <div key={`${a.id}-${idx}`} className="relative shrink-0 w-full h-full">
                {a.redirect_url ? (
                  <a
                    href={a.redirect_url}
                    target="_blank"
                    rel="noopener"
                    onClick={() => trackEvent(a.id, "click")}
                    className="block w-full h-full"
                  >
                    {inner}
                  </a>
                ) : inner}
              </div>
            );
          })}
        </div>
      </div>

      {multi && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={prev}
            aria-label="السابق"
            className="grid place-items-center h-8 w-8 rounded-full bg-muted hover:bg-muted/70 text-foreground shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {ads.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                aria-label={`إعلان ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${idx === realIdx ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            aria-label="التالي"
            className="grid place-items-center h-8 w-8 rounded-full bg-muted hover:bg-muted/70 text-foreground shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}

export function AdRotator() {
  const ads = useCachedAds("rotator");
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    ads.forEach((a) => {
      if (!seen.current.has(a.id)) { seen.current.add(a.id); trackEvent(a.id, "impression"); }
    });
  }, [ads]);
  if (ads.length === 0) return null;
  return (
    <section className="container mx-auto px-4 py-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ads.map((a) => {
          const img = <img src={a.image_url} alt={a.title} className="w-full h-32 object-cover rounded-lg" loading="lazy" onError={() => console.error("[Ads] rotator image failed:", a.image_url, "id:", a.id)} />;
          return (
            <div key={a.id} className="rounded-lg border overflow-hidden bg-card">
              {a.redirect_url ? (
                <a href={a.redirect_url} target="_blank" rel="noopener" onClick={() => trackEvent(a.id, "click")}>{img}</a>
              ) : img}
              <div className="px-3 py-2">
                <div className="text-xs font-semibold">{a.title}</div>
                {a.description && <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{a.description}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
