---
name: Smart Labor Calculator removal decisions
description: Durable decisions from the "safe removal of unwanted modules" task (Aug 2026)
---
- Rule conflict handling: `resolveRule` must FAIL SAFELY — >1 matching legal rule returns `rule: null, conflict: true` (Arabic review-required message). Never re-add tiebreak/auto-resolution logic.
- **Why:** user requirement — no invented legal results; ambiguity requires human legal review.
- Engine/rule/system/template versions are internal only (persisted `rule_version`, snapshots kept for audit/compatibility) — never render them in UI text, report views, or HTML/PDF/DOCX/XLSX exports.
- **How to apply:** when adding report sections or UI copy, do not surface `policy.version`, `engineVersion`, `systemVersion`, `templateVersion` or Arabic "إصدار القاعدة/القواعد/النظام" strings.
- Regression testing module removed entirely (sandbox + regression UI, `rule_test_cases`/`rule_test_runs` tables; drop migration added, live drop pending user in Supabase).
- `runConflictEngine` in `src/lib/saudi/calcEngine.ts` is case-DATA validation (confidence score), not legal-rule conflict management — it is intentionally KEPT.
- `admin.backups.tsx` is normal operational backups, not a disaster-recovery module — KEPT.
