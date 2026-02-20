# Skills: Patterns for Vend Onboarding Assessment

## Data Model (Convex tables)

### tenants
- companyName, status?: "active" | "archived", createdAt
- NO onboardingStatus stored (always computed from pass/member progress)

### tenantAdmins
- tenantId, name, email?, phone?, createdAt
- Index: by_tenant [tenantId]
- UI uses one seeded tenantAdmin per tenant for now. Multi-admin modeled but not built.

### passes
- tenantId, name, description, targetMemberCount
- billingType?: "recurring" | "usage_based" (set by Vend Admin)
- status?: "active" | "archived" (used by resetTenant soft-delete)
- createdAt
- Index: by_tenant [tenantId]

### members
- A membership/enrollment (person-in-pass), NOT a unique person. Same person can appear multiple times across passes or even within the same pass. De-dup is advisory (flag + let admin resolve), not a uniqueness constraint.
- tenantId, passId, name, email?, phone?
- status: "draft" | "invited" | "accepted" | "approved" | "rejected"
- inviteAutoMethod: "email" | "phone" | "access_code" (computed from contact data)
- inviteOverrideMethod?: same union (admin override)
- accessCode?
- createdAt
- Indexes: by_pass [passId], by_tenant [tenantId], by_pass_status [passId, status]

### inviteAttempts
- memberId, method, sentAt, result?: "sent" | "failed", error?
- Indexes: by_member [memberId], by_member_sentAt [memberId, sentAt]

### importBatches
- tenantId, passId, sourceType: "csv" | "excel" | "pdf" | "text" | "image"
- status: "pending_review" | "confirmed" | "cancelled"
- rawText? (optional, stored for re-processing)
- createdAt
- Index: by_tenant [tenantId]

### importRows
- batchId, name, email?, phone?, confidence, notes?
- errors: string[]
- duplicateOfMemberId?, duplicateReason?
- accepted: boolean
- Index: by_batch [batchId]

### copilotLog
- tenantId (string, not FK — uses "__vend_admin__" for platform-level), role? ("tenant_admin" | "vend_admin"), prompt, toolNames[], responseLength, durationMs, createdAt
- Index: by_tenant_time [tenantId, createdAt]

### setupSuggestions
- tenantId (FK), suggestedPasses[] ({name, description, estimatedMemberCount, reasoning, confidence}), members[] ({name, email?, phone?, suggestedPassName?, confidence, notes?}), sourceNotes?, status: "pending" | "applied" | "dismissed", createdAt
- Index: by_tenant [tenantId]

## Lifecycle State Machine
- Draft -> Invited (send invite)
- Invited -> Accepted (mock accept endpoint)
- Accepted -> Approved (tenant admin approves)
- Accepted -> Rejected (tenant admin rejects)
Never allow direct jumps. Enforce in Convex mutations.

## Invite Method Resolution
Auto priority: email > phone > access_code
Effective method = overrideMethod ?? autoMethod
Log every send attempt to inviteAttempts (including resends).

### Resend rules
- sendInvite: draft -> invited (status changes)
- resendInvite: stays invited (only adds inviteAttempts row)
- changeMethod + resend: updates inviteOverrideMethod, adds inviteAttempts row, stays invited

### Access Code Rules
- Format: 8-char uppercase base32 token (e.g., "A3BK7M2X")
- Generate on first invite requiring access_code method
- Stable across resends unless user clicks "Regenerate"
- Enforce uniqueness: collision-check before writing

## Tenant Onboarding Status (computed, never stored)
- Not Started: no passes OR no members
- In Progress: has passes with members, approvedCount < targetMemberCount for any pass
- Complete: for every pass, approvedCount >= targetMemberCount

## Progress Computation (always derived)
Per pass: targetCount, totalMembers, draftCount, invitedCount, acceptedCount, approvedCount, rejectedCount
Per tenant: aggregate across all passes

## AI Document Import Pipeline
1. Upload/paste -> client-side file processing (PDF text extraction, Excel→CSV, image→base64)
2. Hybrid routing: text-rich docs → `extractMembers` action; scanned/image docs → `extractMembersVision` action
3. Convex action calls Anthropic via Vercel AI SDK (`generateText` + `Output.object` + Zod schema)
4. Validated result -> create importBatch + importRows (staging tables, ADR-002)
5. Frontend renders editable review table from importRows
6. User edits/confirms -> write confirmed rows to members table
7. NEVER write LLM output directly to members

## De-duplication
- Hard duplicates: same email OR same phone (exact match, case-insensitive for email)
- Soft duplicates: same normalized name (lowercase, trimmed) AND same pass OR same tenant
- Flag both with warning, let admin resolve. Never auto-merge.

## Copilot Architecture (Zero-Click)

### Split Tool Builders
- `buildTenantAdminTools(ctx, tenantId, currentStep?)` — 5 read + step-filtered write tools
- `buildVendAdminTools(ctx)` — 4 read + 5 write tools
- Step filtering: 0=pass, 1=member, 2=invite, 3=approve, undefined=4 common

### Proposal Pattern
- Write tools return `{ action, intent, summary, requiresConfirmation: true }`
- `executeProposal` validates role, validates IDs exist, dispatches to internal mutation
- 18 total action handlers (13 tenant + 5 vend)

### Internal Mutations (copilot-specific)
- members: createInternal, createBulkInternal, removeInternal, sendInviteInternal, resendInternal, changeMethodInternal, acceptBulkInternal, rejectInternal
- passes: createInternal, updateInternal, removeInternal
- tenants: createInternal, archiveInternal, resetInternal

### Idempotency Rules
- Skip if wrong status (e.g., sendInvite on non-draft → skip)
- Return { succeeded, skipped } or { ok, errors }
- Bulk: all-or-nothing (validate ALL upfront)
- Delete member: only draft + rejected. Invited/accepted/approved are not deletable.
- Delete pass: only if zero members. Returns explicit "has X members" error.

### Outcome Injection
- After successful executeProposal, inject `{ role: "user", content: "System: Action completed — ..." }`
- 500ms post-confirm input delay
- LLM prompt: trust current state over earlier conversation

## View Models (server-shaped queries)
- `getTenantDashboard(tenantId)` → passes + per-pass progress + blockers + recent invite attempts
- `getVendDashboard()` → tenant list + computed onboarding status + at-risk flags
- `getPassMembers(passId)` → members + effectiveInviteMethod + duplicate flags + lastInviteAt

## Storybook (required)
Shared components must have stories built alongside them, not after. At minimum per the brief:
- Invite status badges (draft, invited, accepted, approved, rejected)
- Progress indicators (per-pass, per-tenant readiness)
- Member table row (with all status + method variants)
Each story must cover: default, loading, empty, error, and all status variants.

## UI Principles
- Guided, step-based wizard for tenant admin
- Progressive disclosure: overrides/advanced only when needed
- Real-time reactive: Convex useQuery drives live progress
- Actions close to data (bulk send, resend, approve/reject from tables)

## Theme & Styling

### Brand colors
- Primary = teal (`oklch(0.72 0.15 175)` light / `oklch(0.78 0.15 175)` dark)
- Defined in `apps/web/src/index.css` as CSS custom properties
- `--ring` and `--sidebar-primary` match primary

### Button variant rules
- `"default"` (solid teal): ALL active/selected states and action buttons — Add, Send, Approve, Continue, selected pills, selected toggles
- `"outline"`: unselected pills and tabs
- `"ghost"`: unselected toggles, secondary inline actions (Mock Accept, Reject text button)
- `"secondary"`: AVOID for active selection state — it looks disabled (low contrast, nearly identical to muted/disabled)
- `"destructive"`: destructive actions only
- Never set `disabled` on the actively-selected toggle/pill — it applies `opacity-50` and washes out the color

### Status badge colors (from `lib/constants.ts` → `STATUS_CONFIG`)
- Draft: `bg-muted text-muted-foreground` (neutral)
- Invited: `bg-blue-500/10 text-blue-700` (blue)
- Accepted: `bg-yellow-500/10 text-yellow-700` (yellow)
- Approved: `bg-green-500/10 text-green-700` (green)
- Rejected: `bg-red-500/10 text-red-700` (red)
- All badges use `rounded-full` (pill shape)

### Method badges
- Neutral: `bg-muted text-muted-foreground border-border` (not yellow, not teal)

### Toasts
- `<Toaster />` without `richColors` — uses neutral popover theme from `sonner.tsx`
- Icons provide type distinction (check, X, info), not background color

### Shapes
- Base radius: `0.625rem` (from `--radius`)
- Badges: `rounded-full` (pill)
- Cards, inputs, buttons: use shadcn defaults (rounded-md/lg)
