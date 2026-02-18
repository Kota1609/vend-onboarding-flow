---
description: Create a new React component with Storybook story
user_invocable: true
---

# Component

Create a new React component in `apps/web/src/components/` with a matching Storybook story.

## Instructions

1. Ask what the component does and what props it needs
2. Create `apps/web/src/components/{name}.tsx`:
   - Use shadcn/ui primitives as base
   - Accept typed props (no `any`)
   - Handle loading, empty, and error states
3. Create `apps/web/src/components/{name}.stories.tsx`:
   - Import from `@storybook/react`
   - Include stories for: default, loading, empty, error, and all relevant status variants
   - Use realistic mock data
4. Run `pnpm run check-types` after creating
