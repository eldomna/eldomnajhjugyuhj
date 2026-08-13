// Offline-friendly ad loader.
// - Fetches active ads from Supabase (RLS enforces is_active + date range).
// - Persists the resolved list in localStorage so the homepage carousel keeps
//   rendering the last-known banners when the device is offline.
// - Auto-refreshes on window "online" event so admin edits (new images,
//   updated display duration, order) show up as soon as connectivity returns.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CachedAd = {
  id: string;
  title: string;
  description: string | null;
  image_url: string; // resolved to a public URL, safe to cache
  redirect_url: string | null;
  position: "hero" | "rotator";
  display_seconds: number;
};

const STORAGE_KEY = "ylr:ads-cache:v1";
const DEFAULT_DISPLAY_SECONDS = 10;

type Row = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  redirect_url: string | null;
  position: "hero" | "rotator";
  display_seconds: number | null;
};

// Storage bucket is public-read (see migration 20260614010649). Use a stable
// public URL so the browser/SW image cache can persist banners for offline use.
function extractStoragePath(url: string): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/ad-banners\/([^?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (url.startsWith("ad-banners/")) return url.slice("ad-banners/".length);
  return null;
}

function resolveImageUrl(raw: string): string {
  const path = extractStoragePath(raw);
  if (!path) return raw;
  const { data } = supabase.storage.from("ad-banners").getPublicUrl(path);
  return data?.publicUrl || raw;
}

function readCache(): CachedAd[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAd[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(ads: CachedAd[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ads));
  } catch {
    /* quota — ignore */
  }
}

async function fetchAds(position: "hero" | "rotator"): Promise<CachedAd[]> {
  const result = await (supabase as any)
    .from("advertisements")
    .select("id,title,description,image_url,redirect_url,position,display_seconds")
    .eq("position", position)
    .order("sort_order", { ascending: true });
  if (result.error) throw result.error;
  const rows: Row[] = result.data || [];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    image_url: resolveImageUrl(r.image_url),
    redirect_url: r.redirect_url,
    position: r.position,
    display_seconds:
      typeof r.display_seconds === "number" && r.display_seconds >= 2
        ? r.display_seconds
        : DEFAULT_DISPLAY_SECONDS,
  }));
}

// Prewarms the SW image cache so images survive going offline mid-session.
function prewarmImages(ads: CachedAd[]) {
  if (typeof window === "undefined") return;
  ads.forEach((a) => {
    if (!a.image_url) return;
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = a.image_url;
  });
}

export function useCachedAds(position: "hero" | "rotator") {
  const [ads, setAds] = useState<CachedAd[]>(() => {
    const cached = readCache();
    return (cached || []).filter((a) => a.position === position);
  });

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const fresh = await fetchAds(position);
        if (cancelled) return;
        setAds(fresh);
        prewarmImages(fresh);
        // Merge into the cross-position cache so both hero+rotator persist.
        const existing = readCache() || [];
        const kept = existing.filter((a) => a.position !== position);
        writeCache([...kept, ...fresh]);
      } catch {
        // Network / RLS error → keep whatever's already in state (cache).
      }
    };

    sync();
    const onOnline = () => sync();
    window.addEventListener("online", onOnline);
    // Periodic soft refresh while online (every 5 min).
    const t = window.setInterval(sync, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.clearInterval(t);
    };
  }, [position]);

  return ads;
}

export const AD_DEFAULT_DISPLAY_SECONDS = DEFAULT_DISPLAY_SECONDS;
