# Architecture Decision Records

## ADR-001: Anthropic Claude for AI extraction
- **Decision:** Use @ai-sdk/anthropic with Claude for document parsing
- **Rationale:** Strong at messy/unstructured document parsing, good structured output support via Vercel AI SDK `generateText` + `Output.object`
- **Tradeoff:** Requires ANTHROPIC_API_KEY env var

## ADR-002: Import pipeline uses intermediate tables
- **Decision:** AI extraction writes to importBatches/importRows, NOT directly to members
- **Rationale:** Human-in-the-loop requirement. Admin must review and confirm before data enters the system of record.
- **Tradeoff:** Extra tables + UI for review, but this is a core requirement

## ADR-003: Progress is always computed
- **Decision:** Never store derived counts. Convex queries compute progress from member statuses.
- **Rationale:** Single source of truth, no stale data, Convex reactive queries make this performant.

## ADR-004: Mock auth via role switcher
- **Decision:** No real auth. Simple React context with a role toggle (Vend Admin / Tenant Admin).
- **Rationale:** Brief says "fake/mock auth where needed." Role switcher is the simplest approach that still demonstrates role-based views.

## ADR-005: AI extraction runtime strategy
- **Decision:** Primary: call Anthropic from Convex action via Vercel AI SDK (`generateText` + `Output.object` for structured output). Fallback: direct @anthropic-ai/sdk in same Convex action.
- **Rationale:** Both approaches stay inside Convex (no extra server). Convex actions support Node.js with `"use node"` directive; the direct SDK is a safe fallback if Vercel AI SDK has bundling issues.
- **Tradeoff:** Keeping everything in Convex is simplest. Only add a server endpoint as a last resort.

## ADR-006: Tenant admin as separate entity
- **Decision:** tenantAdmins is a separate table from tenants (not inlined admin fields on tenants).
- **Rationale:** Cleaner domain model. Supports multiple admins per tenant in future. Matches Vend's "platform" mindset.
- **Scope:** UI uses one seeded tenantAdmin per tenant for now. Multi-admin is modeled but not built.

## ADR-007: Demo seed data
- **Decision:** Include a dev-only seed() mutation that populates 1 tenant, 2 passes, ~8 members across statuses.
- **Rationale:** Reviewers will run locally and want it to "just work." Also makes Loom recording smooth.

## ADR-008: Draft method override via update mutation
- **Decision:** Allow `inviteOverrideMethod` on the existing `members.update` mutation (draft-only) rather than creating a separate mutation or reusing `changeInviteMethod` (which requires `status === "invited"`).
- **Rationale:** The brief says admins can override method before sending. Reusing `update` keeps the API surface small — one mutation handles all draft edits. `sendInvite` already reads `inviteOverrideMethod ?? inviteAutoMethod`, so the override propagates without extra wiring.
- **Tradeoff:** `update` now serves two purposes (edit fields + set method). Acceptable given draft is the only mutable status.

## ADR-009: Onboarding Assistant implementation
- **Decision:** Simple action-based chat using `generateText` with context injection rather than `@convex-dev/agent`.
- **Rationale:** `@convex-dev/agent` has a peer dependency on `ai@^5` which conflicts with the project's `ai@^6`. Rather than downgrade or fight version mismatches, a simpler approach using `generateText` with real-time data context achieves the same UX. The assistant queries actual pass/member data via internal queries and injects it as context before each LLM call. The `@convex-dev/agent` package was removed to avoid dead weight.
- **Tradeoff:** No persistent thread history or streaming. Acceptable for a demo/MVP. Can revisit `@convex-dev/agent` when `ai@^6` compatibility is released.

## ADR-010: Multi-pass membership model
- **Decision:** The `members` table is intentionally a junction table (membership), not a persons table. A person can belong to many passes, including multiple memberships in the same pass.
- **Rationale:** Karan confirmed: "pass member could belong to many passes...and multiple memberships in the same pass." Duplicate detection is scoped per-pass (warns but doesn't reject). This matches Vend's flexible parking model.
- **Tradeoff:** No global person deduplication. Acceptable — the domain requires it.

## ADR-011: Multiplayer upload deferred
- **Decision:** Multi-user file upload coordination ("multiplayer experience where different roles can upload files") is not in scope for the initial implementation.
- **Rationale:** The brief mentions multiplayer but doesn't require it as a core deliverable. The `setupSuggestions` table provides a foundation for future multi-user coordination. The AI copilot and document-to-config extraction are higher-impact features for demonstrating senior-level work.
- **Tradeoff:** Noted as future enhancement. Foundation exists in the persistence layer.

## ADR-012: Split copilot architecture (Tenant Admin vs Vend Admin)
- **Decision:** Two completely separate copilot tool sets, prompts, and quick actions per role.
- **Rationale:** Tool count degrades LLM selection accuracy past ~15 tools. Splitting by role keeps each under 9 tools. Roles have no overlapping write operations.
- **Tradeoff:** Two system prompts to maintain. Acceptable — they serve distinct domains.

## ADR-013: Step-based tool filtering for Tenant Admin
- **Decision:** Write tools filtered by current wizard step. Outside wizard → 4 most common tools.
- **Rationale:** Step 0 user doesn't need invite tools. Filtering keeps context focused and reduces LLM confusion.
- **Tradeoff:** User on wrong step can't access tools for other steps. Acceptable — wizard guides them.

## ADR-014: Outcome injection as user message
- **Decision:** After proposal confirmation, inject result as `{ role: "user", content: "System: ..." }`.
- **Rationale:** Using role "assistant" causes LLM to attribute the message to itself. User role with "System:" prefix gives correct context for follow-up operations without self-attribution.
- **Tradeoff:** Slightly unconventional use of user role. "System:" prefix makes intent clear.

## ADR-015: Hybrid delete for destructive tenant operations
- **Decision:** resetTenant uses soft-delete for domain data (passes archived, members set to rejected) and hard-delete for transient data (inviteAttempts, importBatches/rows, setupSuggestions).
- **Rationale:** Domain data (passes, members) may be needed for audit or recovery — soft-delete preserves it. Transient data (invite logs, import staging, AI suggestions) has no recovery value and would clutter queries if left archived. Summary shows counts for user verification before confirming.
- **Tradeoff:** Mixed strategy is slightly more complex than pure soft-delete, but correctly matches the data's lifecycle importance. Acceptable for demo scope.

## ADR-016: All-or-nothing bulk member creation
- **Decision:** createBulkInternal validates ALL members upfront. If any fail validation, none are inserted.
- **Rationale:** Partial inserts create confusing state where user must figure out which succeeded. All-or-nothing with explicit error list is clearer.
- **Tradeoff:** One bad entry blocks entire batch. User can fix and retry. Acceptable.
