---
name: Smart Labor Calculator environment quirks
description: Environment constraints for the smart-labor-calculator artifact (Supabase, build memory, port binding, routing)
---
- Supabase is the user's LIVE instance (creds in the artifact's `.env`). Never migrate to Replit DB. Schema drops must be run by the user in Supabase; we only add new migration files under `supabase/migrations/` (never edit historical ones).
- **Why:** live production data; the workspace has no direct DB admin access.
- Replit container has no IPv6: Vite `host: "::"` fails with EAFNOSUPPORT → use `"0.0.0.0"`.
- Production build OOMs at default heap: use `NODE_OPTIONS="--max-old-space-size=6144" pnpm run build`.
- The `api-server` artifact was moved to previewPath `/_internal-api` so this app owns `/api` (its SSR server serves `/api/*` routes).
- `@tanstack/query-core` must be an explicit dependency of the artifact or the vite-plugin-pwa build fails to resolve it.
