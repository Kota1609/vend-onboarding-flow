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
- companyName, createdAt
- Onboarding status is COMPUTED (never stored)

### tenantAdmins
- tenantId (FK), name, email?, phone?, createdAt
- One admin per tenant for now; multi-admin modeled but not built

### passes
- tenantId (FK), name, description, targetMemberCount, billingType?, createdAt

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
- tenantId (FK), passId (FK), sourceType, status, createdAt

### importRows
- batchId (FK), name, email?, phone?, confidence, notes?, errors[], accepted

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

## AI Import Pipeline
1. Upload/paste -> Convex action
2. Convex action -> Anthropic Claude (generateObject + Zod schema)
3. Validated result -> importBatch + importRows
4. Frontend: editable review table
5. User confirms -> write to members
6. NEVER auto-write LLM output to members

## Mock Auth
- React context with role switcher (Vend Admin / Tenant Admin)
- Views gated by role, no real authentication
