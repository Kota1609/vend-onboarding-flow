---
description: Add a new TanStack Router page
user_invocable: true
---

# Route

Add a new page route using TanStack Router file-based routing.

## Instructions

1. Ask what the route path should be and which role sees it (Vend Admin, Tenant Admin, or both)
2. Create `apps/web/src/routes/{path}.tsx` following TanStack Router conventions:
   - Export `Route` using `createFileRoute`
   - Use `Route.useParams()` / `Route.useSearch()` for params
   - Wrap content in role gate if role-specific
   - Use Convex `useQuery` for data, show `<Skeleton>` while loading
   - Handle empty states
3. The route tree auto-generates — no manual registration needed
4. Run `pnpm run check-types` after creating
