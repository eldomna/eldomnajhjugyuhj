// Standalone Vite configuration — no vendor-specific wrappers.
// Works for local dev, `vite build`, `vite preview`, Docker, VPS and any
// Node/edge host supported by Nitro presets.
//
// Deploy target selection:
//   NITRO_PRESET=node-server        (default: portable Node server, dist/server/index.mjs)
//   NITRO_PRESET=vercel | netlify | cloudflare-module | ...
// When NITRO_PRESET is unset, Nitro auto-detects the hosting provider from the
// build environment and falls back to `node-server`.
import { defineConfig, loadEnv, type PluginOption } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(async ({ command, mode }) => {
  // Expose VITE_* values as static replacements so they also work in
  // pre-rendered/SSR output on hosts that don't inject build-time env.
  const clientEnv = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(clientEnv).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  );

  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
      // Keep server-only modules out of the browser bundle.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    viteReact(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      strategies: "generateSW",
      filename: "sw.js",
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}"],
        // Nitro emits browser files under a local "client/" folder while the
        // deployed site serves them from the web root, so precache URLs are
        // rewritten to root-relative paths.
        modifyURLPrefix: { "client/": "" },
        // "/" is rendered by SSR (no index.html on disk), so it is seeded
        // manually to make the app shell available offline.
        additionalManifestEntries: [{ url: "/", revision: `${Date.now()}` }],
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // App shell / navigation: network first, cached HTML as fallback.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-nav",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
              precacheFallback: { fallbackURL: "/" },
              matchOptions: { ignoreSearch: true },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:js|css|woff2?|ttf|otf)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Public banner images from Supabase Storage.
            urlPattern: /\/storage\/v1\/object\/public\/ad-banners\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ad-banners",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ];

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    const preset = process.env["NITRO_PRESET"];
    plugins.push(
      nitro({
        ...(preset ? { preset } : {}),
        defaultPreset: "node-server",
        output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
        ...(preset?.startsWith("cloudflare")
          ? { cloudflare: { nodeCompat: true, deployConfig: true } }
          : {}),
      }),
    );
  }

  return {
    define,
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: {
      host: "0.0.0.0",
      port: Number(process.env["PORT"] ?? 8080),
      allowedHosts: true as const,
    },
    preview: {
      host: "0.0.0.0",
      port: Number(process.env["PORT"] ?? 8080),
      allowedHosts: true as const,
    },
    plugins,
  };
});
