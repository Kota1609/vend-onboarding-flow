# Skills: Patterns for Vend Onboarding Assessment

## Data Model (Convex tables)

### tenants
- companyName, createdAt
- NO onboardingStatus stored (always computed from pass/member progress)

### tenantAdmins
- tenantId, name, email?, phone?, createdAt
- Index: by_tenant [tenantId]
- UI uses one seeded tenantAdmin per tenant for now. Multi-admin modeled but not built.

### passes
- tenantId, name, description, targetMemberCount
- billingType?: "recurring" | "usage_based" (set by Vend Admin)
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
- tenantId, passId, sourceType: "csv" | "excel" | "pdf" | "text"
- status: "pending_review" | "confirmed" | "cancelled"
- createdAt
- Index: by_tenant [tenantId]

### importRows
- batchId, name, email?, phone?, confidence, notes?
- errors: string[]
- duplicateOfMemberId?, duplicateReason?
- accepted: boolean
- Index: by_batch [batchId]

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
1. Upload/paste -> send to Convex action
2. Convex action calls Anthropic via Vercel AI SDK generateObject
3. Zod validates response -> create importBatch + importRows
4. Frontend renders editable review table from importRows
5. User edits/confirms -> write confirmed rows to members table
6. NEVER write LLM output directly to members

## De-duplication
- Hard duplicates: same email OR same phone (exact match, case-insensitive for email)
- Soft duplicates: same normalized name (lowercase, trimmed) AND same pass OR same tenant
- Flag both with warning, let admin resolve. Never auto-merge.

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
