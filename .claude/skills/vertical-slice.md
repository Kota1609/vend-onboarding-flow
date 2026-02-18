---
description: Implement a feature as a vertical slice (schema → backend → UI)
user_invocable: true
---

# Vertical Slice

Implement a feature end-to-end in one pass: schema → Convex functions → React UI.

## Instructions

1. Ask what feature to build
2. Read `docs/00-brief.md` and `docs/01-architecture.md` for requirements
3. Plan the slice:
   - What tables/fields are needed in `packages/backend/convex/schema.ts`
   - What queries/mutations/actions are needed
   - What UI components and routes are needed
4. Implement in this order:
   a. Schema changes in `schema.ts`
   b. Convex queries/mutations (with lifecycle enforcement + typed errors where needed)
   c. React components (with Storybook stories for shared components)
   d. Route/page wiring
5. Run `pnpm run check-types` and `pnpm biome check .`
6. Suggest a conventional commit message
