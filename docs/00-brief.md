# Vend Park: Guided Pass-Member Onboarding Flow

## Goal
Build a guided onboarding flow that enables a Vend Admin and a Tenant Admin to collaboratively onboard all pass members for a parking facility before go-live.

## Roles
- **Vend Admin**: Internal operator, kicks off onboarding by inviting Tenant Admin
- **Tenant Admin**: Tenant's point-of-contact, manages their company's pass member onboarding

## Core Entities
- **Tenant**: Company that leases parking
- **Pass**: Named parking pass type (e.g., "Executive Reserved", "General Employee")
- **Pass Member**: Individual who receives a pass (must be invited, accept, and be approved)

## Functional Requirements

### Part 1: Vend Admin -- Tenant Setup
- Tenant invite form (company name, admin name, email, phone)
- Tenant list with onboarding status (Not Started / In Progress / Complete)

### Part 2: Tenant Admin -- Onboarding Wizard
- **Step 1**: Define passes (name, description, target member count)
- **Step 2**: Add members per pass (manual entry, CSV/template upload, AI document import)
- **Step 3**: Send invites (auto-method: email > phone > access_code, with override, bulk/individual, audit trail)
- **Step 4**: Monitor & approve (accept/reject, resend, change method)

### Part 3: Vend Admin -- Configure Billing
- Set billing type per pass: Recurring or Usage-based (no real payments)

### Part 4: Onboarding Dashboard
- Vend Admin: cross-tenant overview, progress, at-risk indicators
- Tenant Admin: per-pass progress, member breakdown, blockers, quick actions

### Part 5: AI-Assisted Features
- Document parsing (required): extract member data from PDF/CSV/Excel/text via LLM
- Smart column mapping (encouraged): AI suggests CSV/Excel column mappings
- Onboarding assistant (bonus): chat-based helper for status queries

## Invite Lifecycle
```
Draft -> Invited -> Accepted -> Approved
                             -> Rejected
```

## Stack (prescribed)
- Frontend: React + Vite + TanStack Router
- Backend: Convex
- Styling: Tailwind v4 + shadcn/ui
- Validation: Zod
- Auth: Mocked (role switcher)
- Storybook: Required for shared components
- TypeScript: Strict, no `any`
