---
description: Run typecheck and lint across the monorepo
user_invocable: true
---

# Check

Run all checks to verify the codebase is clean.

## Instructions

Run these commands and report results:

1. `pnpm run check-types` — TypeScript strict mode check
2. `pnpm biome check .` — Biome lint + format check

If there are errors:
- Fix type errors (never use `any` to suppress)
- Fix lint/format issues with `pnpm biome check --write .`
- Re-run checks to confirm clean
