# Smart Labor Calculator — حاسبة العمال الذكية

منصة حساب الحقوق العمالية وإصدار التقارير القانونية وفق **نظام العمل السعودي** و**قانون العمل اليمني**.

The project is fully **platform-agnostic**: it builds, runs and deploys with standard
open-source tooling (Vite + TanStack Start + Nitro) on any Node host, container
platform or edge runtime. There are no proprietary build wrappers or vendor SDKs.

## Stack

- **TanStack Start v1** (React 19, file-based routing, server functions)
- **Vite 7** + **Tailwind CSS v4**
- **Nitro** for the production server (Node, Bun, Deno, Cloudflare, Vercel, Netlify presets)
- **Supabase** (Postgres + Auth + Storage) — standard `@supabase/supabase-js`, self-hostable
- **Pluggable AI provider** — OpenAI, Anthropic, Gemini or any OpenAI-compatible endpoint

## Requirements

- Node.js 20+ (22 recommended) and npm — or Bun 1.2+
- A Supabase project (hosted or self-hosted)

## Quick start

```sh
git clone <repository-url>
cd smart-labor-calculator
npm install
cp .env.example .env      # then fill in the values
npm run dev               # http://localhost:8080
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm start` | Run the built server (`dist/server/index.mjs`) |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | TypeScript check |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Environment variables

See [`.env.example`](./.env.example) for the full list. Summary:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` — public, inlined into the browser bundle at build time.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — server-only.
- `AI_PROVIDER`, `AI_API_KEY`, optional `AI_MODEL` / `AI_BASE_URL` — AI features. When
  unset, AI-assisted features degrade gracefully with a clear message; all
  calculators keep working.
- `PORT` — HTTP port (default `8080`).
- `NITRO_PRESET` — build target (see below).

> `VITE_*` variables are **build-time**. Rebuild (or pass them as Docker build args)
> after changing them.

## Deployment

### Node / VPS

```sh
npm ci
npm run build
NODE_ENV=production PORT=8080 npm start
```

Put Nginx/Caddy in front for TLS and reverse proxying.

### Docker

```sh
docker build \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... \
  --build-arg VITE_SUPABASE_PROJECT_ID=... \
  -t smart-labor-calculator .

docker run --env-file .env -p 8080:8080 smart-labor-calculator
```

Or with Compose: `docker compose up --build`.

### Other targets

Set `NITRO_PRESET` at build time:

| Target | Command |
| --- | --- |
| Node server (default) | `npm run build` |
| Bun | `NITRO_PRESET=bun npm run build` |
| Deno | `NITRO_PRESET=deno-server npm run build` |
| Cloudflare Workers | `NITRO_PRESET=cloudflare-module npm run build` |
| Vercel | `NITRO_PRESET=vercel npm run build` |
| Netlify | `NITRO_PRESET=netlify npm run build` |

## Health check

`GET /api/health` returns app, database and AI-configuration status (never any
secret values) and is used by the Docker healthcheck:

```json
{ "status": "ok", "checks": { "app": {...}, "database": {...}, "ai": {...} } }
```

## Database

Migrations live in `supabase/migrations/`. Apply them with the Supabase CLI:

```sh
supabase link --project-ref <ref>
supabase db push
```

For a self-hosted Postgres, apply the SQL files in order.

## Authentication

Standard Supabase Auth: email/password plus OAuth providers (Google, Apple) enabled
in your Supabase project. OAuth returns to `/auth/callback`, which hydrates the
session and forwards the user onward.

## Error reporting

`src/lib/error-reporting.ts` is vendor-neutral. Plug in any monitoring service:

```ts
import { registerErrorSink } from "@/lib/error-reporting";

registerErrorSink((report) => myMonitoring.capture(report));
```

Without a sink, errors are logged to the console only. Sensitive keys are redacted.

## PWA / offline

Offline support is provided by a Workbox service worker (`vite-plugin-pwa`).
Registration is guarded: it never runs in development, inside iframes, on
insecure origins, or when `?sw=off` is present.

## License

Proprietary — all rights reserved by the project owner.
