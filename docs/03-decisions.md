# Architecture Decision Records

## ADR-001: Anthropic Claude for AI extraction
- **Decision:** Use @ai-sdk/anthropic with Claude for document parsing
- **Rationale:** Strong at messy/unstructured document parsing, good structured output support via Vercel AI SDK generateObject
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
- **Decision:** Primary: call Anthropic from Convex action via Vercel AI SDK (generateObject). Fallback: direct @anthropic-ai/sdk in same Convex action.
- **Rationale:** Both approaches stay inside Convex (no extra server). Convex actions support Node.js; the direct SDK is a safe fallback if Vercel AI SDK has bundling issues.
- **Tradeoff:** Keeping everything in Convex is simplest. Only add a server endpoint as a last resort.

## ADR-006: Tenant admin as separate entity
- **Decision:** tenantAdmins is a separate table from tenants (not inlined admin fields on tenants).
- **Rationale:** Cleaner domain model. Supports multiple admins per tenant in future. Matches Vend's "platform" mindset.
- **Scope:** UI uses one seeded tenantAdmin per tenant for now. Multi-admin is modeled but not built.

## ADR-007: Demo seed data
- **Decision:** Include a dev-only seed() mutation that populates 1 tenant, 2 passes, ~8 members across statuses.
- **Rationale:** Reviewers will run locally and want it to "just work." Also makes Loom recording smooth.
