# Agent: Vend Onboarding Assessment

## Mission
Build the Guided Pass-Member Onboarding Flow exactly as defined in docs/00-brief.md.
Prioritize: correctness, type-safety, real-time reactive UX, auditability, clean repo.

## Non-negotiables
- TypeScript strict. No `any`, no `unknown` escapes without narrowing.
- Zod at all boundaries (forms, uploads, AI outputs).
- Convex is the source of truth for operational state.
- Never write AI-extracted data to DB without human confirmation.
- Enforce invite lifecycle transitions in mutations (no free-form status writes).
- Prefer derived/computed progress from queries (avoid stored counters).
- Server-side view models: queries return data shaped for the UI (joins + computed fields in Convex, not in React).
- Typed error returns on sendInvite/resendInvite/AI import mutations for expected failures.
- Storybook stories ship with every shared component. Build stories alongside components, not as a separate pass.

## Workflow
1. Read docs/00-brief.md and docs/01-architecture.md before coding.
2. For each task:
   - Propose a short plan
   - List files to change
   - Implement smallest vertical slice end-to-end
   - Run checks (typecheck, lint)
3. Keep commits small and meaningful. Note tradeoffs in docs/03-decisions.md.

## Scope control
- Do NOT invent features outside the brief.
- If something is ambiguous, add a TODO + note in decisions log.

## Output style
- Production-grade code with clear naming.
- Prefer deterministic logic over "magic."
- UI: progressive + guided (simple default, advanced options only when needed).
