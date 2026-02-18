---
description: Scaffold a new Convex query, mutation, or action
user_invocable: true
---

# Convex Function

Create a new Convex function in `packages/backend/convex/`.

## Instructions

1. Ask what type: query, mutation, or action
2. Ask what domain it belongs to (tenants, passes, members, invites, imports)
3. Create or update the file `packages/backend/convex/{domain}.ts`
4. Follow these rules:
   - Import validators from `convex/values` and use `v.*` for args
   - Validate all inputs
   - For mutations that change member status: enforce lifecycle transitions (Draft→Invited→Accepted→Approved|Rejected). Throw on invalid transition.
   - For mutations with expected failures (sendInvite, resendInvite, AI import): return `{ ok: true, data }` or `{ ok: false, code, message }` instead of throwing
   - For queries: return screen-ready view models with joins and computed fields
   - Reference `packages/backend/convex/schema.ts` for table shapes
5. Run `pnpm run check-types` after creating
