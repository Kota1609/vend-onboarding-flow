# Architecture

## Monorepo Structure
```
apps/web          -- React + Vite frontend
packages/backend  -- Convex serverless functions
packages/config   -- Shared TypeScript config
packages/env      -- Environment variable validation
```

## Data Model

### tenants
- companyName, status?: "active" | "archived", createdAt
- Onboarding status is COMPUTED (never stored)

### tenantAdmins
- tenantId (FK), name, email?, phone?, createdAt
- One admin per tenant for now; multi-admin modeled but not built

### passes
- tenantId (FK), name, description, targetMemberCount, billingType?, status?: "active" | "archived", createdAt

### members
- tenantId (FK), passId (FK), name, email?, phone?
- status: draft | invited | accepted | approved | rejected
- inviteAutoMethod: email | phone | access_code (computed from contact data)
- inviteOverrideMethod?: same union (admin override)
- accessCode? (8-char base32, unique, stable across resends)

### inviteAttempts
- memberId (FK), method, sentAt, result?, error?
- Compound index: [memberId, sentAt] for time-ordered audit trail

### importBatches
- tenantId (FK), passId (FK), sourceType, status, rawText?, createdAt

### importRows
- batchId (FK), name, email?, phone?, confidence, notes?, errors[], accepted
- duplicateOfMemberId?, duplicateReason? (set at insert time during addRows)

## Lifecycle State Machine
```
Draft -> Invited      (sendInvite)
Invited -> Accepted   (mock accept)
Accepted -> Approved  (tenant admin approves)
Accepted -> Rejected  (tenant admin rejects)
```
Enforced server-side in Convex mutations. No direct jumps.

## Computed Onboarding Status
- **Not Started**: no passes OR no members
- **In Progress**: has passes with members, approvedCount < targetMemberCount for any pass
- **Complete**: for every pass, approvedCount >= targetMemberCount

### copilotLog
- tenantId (string, not FK — uses "__vend_admin__" for platform-level), role? ("tenant_admin" | "vend_admin"), prompt, toolNames[], responseLength, durationMs, createdAt
- Index: by_tenant_time [tenantId, createdAt]

### setupSuggestions
- tenantId (FK), suggestedPasses[] ({name, description, estimatedMemberCount, reasoning, confidence}), members[] ({name, email?, phone?, suggestedPassName?, confidence, notes?}), sourceNotes?, status: "pending" | "applied" | "dismissed", createdAt
- Index: by_tenant [tenantId]

## AI Import Pipeline
1. Upload/paste -> client-side file processing (PDF text extraction, Excel→CSV, image→base64)
2. Hybrid routing: text-rich docs → `extractMembers` action; scanned/image docs → `extractMembersVision` action
3. Convex action -> Anthropic Claude via Vercel AI SDK (`generateText` + `Output.object` + Zod schema)
4. Validated result -> importBatch + importRows (staging tables, ADR-002)
5. Frontend: editable review table with confidence badges, inline editing, duplicate detection
6. User confirms -> write to members as "draft"
7. NEVER auto-write LLM output to members

## Smart Column Mapping
1. CSV upload with non-standard headers triggers AI column mapping
2. `mapColumns` action sends headers + sample rows to Claude
3. AI suggests targetField per column with confidence + reasoning
4. User can accept, adjust, or skip AI suggestions
5. Mapped data flows into standard CSV preview/import pipeline

## Onboarding Copilot (Zero-Click Architecture)

Two role-separated copilots, each with own tools, prompts, and quick actions.
The 60% wizard updates reactively via Convex `useQuery` — no explicit refresh.

### Layout
- `/onboarding` route: 60/40 grid (`grid-cols-[3fr_2fr]`). Left = wizard, right = inline CopilotPanel.
- All other routes: floating CopilotPanel (380x500px bottom-right popup).

### Tenant Admin Copilot
- 5 read tools (always) + 3-4 write tools (step-filtered) = 8-9 tools max per request
- Step filtering: Step 0 → pass tools, Step 1 → member tools, Step 2 → invite tools, Step 3 → approve tools
- Outside wizard → 4 common write tools (createPass, addMember, sendInvites, approveAll)

### Vend Admin Copilot
- 4 read tools + 5 write tools = 9 tools max per request
- No step context. Manages tenants, billing, demo operations.

### Proposal Pattern
- Write tools return `{ action, intent, summary, requiresConfirmation: true }`
- Frontend shows summary + "Confirm" button
- User clicks → `executeProposal` validates + runs internal mutation
- Outcome injected as `{ role: "user", content: "System: Action completed — ..." }`

### Consistency
- Idempotent mutations: skip wrong-status members, return { succeeded, skipped }
- All-or-nothing bulk: validate upfront, insert all or none
- 500ms post-confirm input delay for Convex reactivity
- Prompt instructs LLM to trust current state over earlier conversation

## Mock Auth
- React context with role switcher (Vend Admin / Tenant Admin)
- Views gated by role, no real authentication
