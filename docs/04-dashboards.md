# Dashboard Design

## Core Principle
Dashboards are built from server-shaped view models (Convex queries return joined + computed data). React renders and triggers actions — it does not assemble joins or compute business logic.

## Readiness Formula (never stored)
- readinessPercent = Σ(approvedMembers) / Σ(targetMemberCount) across passes
- If Σ(targetMemberCount) = 0 → return 0 and flag blocker "Targets not set"

## Computed Onboarding Status (never stored)
- **Not Started**: no passes OR no members
- **In Progress**: has passes with members, but approvedCount < targetMemberCount for any pass
- **Complete**: for every pass, approvedCount >= targetMemberCount

## Blockers (derived, not stored)

### Onboarding blockers
- No passes created
- No members added to a pass
- Σ(targetMemberCount) = 0 ("Targets not set")
- Members stuck in "invited" for > STALE_INVITE_DAYS
- Members in "accepted" awaiting approval

### Billing blockers (Vend Admin only)
- Pass missing billingType

### Constants
- STALE_INVITE_DAYS = 7 (single knob, keep logic deterministic)
- Stale = member.status === "invited" AND latestInviteAttempt.sentAt < (now - STALE_INVITE_DAYS)

## View Model Queries

### getVendDashboard()
Returns: tenants + computed onboarding status + readinessPercent + blockers (including billing blockers)

### getTenantDashboard(tenantId)
Returns: passes + per-pass progress + pending actions + blockers + recent invite activity

### getPassMembers(passId)
Returns: members + effectiveInviteMethod + lastInviteAt + duplicate flags

## Dashboard Actions (in-scope)

### Vend Admin
- Configure billing per pass (Part 3)
- View tenant details
- Resend invites

### Tenant Admin
- Send bulk invites
- Approve/reject accepted members
- Resend invites
- Change invite method (updates inviteOverrideMethod + logs attempt)

## Copilot Actions (Zero-Click)

### Tenant Admin (from copilot chat)
- Create/edit/delete passes
- Add single or bulk members (parsed from text)
- Send single/bulk invites, resend, change method
- Approve single/all, reject members
- All via proposal → confirm pattern

### Vend Admin (from copilot chat)
- Create tenant (atomic: tenant + admin)
- Set billing per pass
- Mock accept all (demo)
- Archive/reset tenant (soft-delete)

### Copilot Layout
- `/onboarding`: 60/40 grid. Wizard left, copilot right (always visible).
- Other pages: floating chat popup (bottom-right).
