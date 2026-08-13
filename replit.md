# Smart Labor Calculator (حاسبة العمال الذكية)

## Overview
Arabic-language legal platform for calculating labor rights under Saudi labor law (نظام العمل السعودي) and Yemeni labor law (قانون العمل اليمني). Imported from a Lovable export; do not rebuild or redesign — make surgical changes only.

- Main artifact: `artifacts/smart-labor-calculator` (TanStack Start + Vite SSR + React 19 + Tailwind + shadcn/ui), served at previewPath `/`.
- Database/auth: user's live **Supabase** instance (credentials in `artifacts/smart-labor-calculator/.env`). Keep Supabase — do not migrate to a Replit database.
- The pre-existing `api-server` artifact was moved to previewPath `/_internal-api` so the app can own `/api`.
- Two calculation engines: Yemen (`src/lib/legal/`) and Saudi (`src/lib/saudi/`). Legal rules engine now fails safely on rule conflicts (multiple matching rules → no result, legal review required) — never auto-resolve or invent results.
- Internal versioning (persisted `rule_version`, snapshot versions, template versions) is kept for compatibility/audit, but must NOT be exposed in UI or exported reports (removed per user requirement).
- Build needs extra heap: `NODE_OPTIONS="--max-old-space-size=6144" pnpm run build`.

## User preferences
- Communicate in Arabic-friendly plain language; user is non-technical about internals.
- Preserve landing page, auth, subscriptions, payments, notifications, admin pages, security (RLS, audit logs).
