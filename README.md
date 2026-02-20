# Vend Park: Guided Pass-Member Onboarding Flow

A guided onboarding flow that enables Vend Admins and Tenant Admins to collaboratively onboard all pass members for a parking facility before go-live.

**[Video Walkthrough (Loom)](https://www.loom.com/share/36d0c69553b84fe09f9e6a14d27de0d9)**

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- A free [Convex](https://convex.dev) account
- (Optional) An [Anthropic API key](https://console.anthropic.com) for AI document import

### Install & Run

```bash
# Install dependencies
pnpm install

# Start the Convex backend (opens browser to configure project on first run)
pnpm dev:server

# In a separate terminal, start the web frontend
pnpm dev:web

# Or run both at once via Turborepo
pnpm dev
```

**First time only:** run `pnpm dev:setup` to configure Convex. Select **"Start without an account (run Convex locally)"** and name the project `onboarding-flow`.

### Seed Demo Data

Open the Convex dashboard (shown in terminal after `pnpm dev:server`), navigate to **Functions**, find `seed:run`, and click **Run**. This populates 1 tenant, 2 passes, and ~8 members across all lifecycle statuses so you can explore the app immediately.

### Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_CONVEX_URL` | `apps/web/.env.local` | Convex deployment URL (auto-set by `npx convex dev`) |
| `ANTHROPIC_API_KEY` | Convex dashboard env vars | Enables AI document import (optional) |

## Architecture

### Stack

- **Frontend:** React 19 + Vite + TanStack Router + Tailwind v4 + shadcn/ui
- **Backend:** Convex (serverless functions, reactive queries, real-time sync)
- **Validation:** Zod (forms + route params) + Convex validators (schema)
- **Visualization:** React Flow (member pipeline diagram)
- **Auth:** Mocked via role switcher (Vend Admin / Tenant Admin)
- **Storybook:** Stories for all shared components

### Monorepo Structure

```
apps/web/             React + Vite frontend
packages/backend/     Convex serverless functions + schema
packages/config/      Shared TypeScript config
packages/env/         Environment variable validation (Zod)
```

### Data Model

| Table | Purpose |
|---|---|
| `tenants` | Companies that lease parking |
| `tenantAdmins` | Tenant admin contacts (1:many with tenants) |
| `passes` | Named pass types with target member counts |
| `members` | Individuals assigned to passes, with lifecycle status |
| `inviteAttempts` | Audit trail of all invite sends |
| `importBatches` / `importRows` | AI document import staging area |
| `setupSuggestions` | AI-extracted pass type suggestions from documents |
| `copilotLog` | Observability log for all copilot requests |

### Member Lifecycle

```
Draft  -->  Invited  -->  Accepted  -->  Approved
                                    -->  Rejected
```

Enforced server-side in Convex mutations. No direct status jumps allowed.

### Key Principle

**Progress is always computed, never stored.** Convex queries compute onboarding status, approval counts, and pipeline breakdowns from member statuses in real-time. This ensures a single source of truth with no stale data.

## Architectural Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Anthropic Claude for AI extraction | Best at messy/unstructured document parsing |
| 2 | Import pipeline uses staging tables | Human-in-the-loop: admin must review before data enters system of record |
| 3 | Progress always computed | Single source of truth, no stale data, Convex reactive queries make it performant |
| 4 | Mock auth via role switcher | Brief requirement; simplest approach that demonstrates role-based views |
| 5 | AI runs inside Convex actions | No extra server needed; Convex actions support Node.js |
| 6 | Separate tenantAdmins table | Cleaner domain model, supports multi-admin in future |
| 7 | Demo seed data | Reviewers get a working app immediately |
| 8 | Draft method override via update mutation | Small API surface; one mutation handles all draft edits |

See `docs/03-decisions.md` for full ADR details.

## AI Features

### Document Import

Upload or paste any document (PDF, CSV, Excel, free-text, images) and the system extracts member data using Anthropic Claude.

**How it works:**
1. User uploads/pastes a document in the "Add Members" step via the "AI Import" button
2. Client-side processing: PDF text extraction (pdfjs-dist), Excel→CSV (xlsx), image→base64
3. Hybrid routing: text-rich docs use text extraction; scanned/image docs use VLM (vision)
4. Convex action sends content to Claude via Vercel AI SDK `generateText` + `Output.object`
5. Claude returns structured member data (name, email, phone) with confidence scores
6. Results go to staging tables (`importBatches` / `importRows`) for review
7. Admin reviews (with inline editing, confidence badges, duplicate detection), then confirms
8. Confirmed rows are inserted as "draft" members

**Safety:** LLM output is **never** auto-written to the members table. The admin always has final review.

### Smart Column Mapping

When uploading CSV files with non-standard headers, the system uses AI to suggest column mappings (e.g., mapping "Full Name" to `name`, "E-mail Address" to `email`). Each suggestion includes a confidence score and reasoning. The admin can accept, adjust, or skip AI suggestions and use raw headers instead.

### AI Copilot

A persistent chat panel that can both answer questions and take actions — built with the Vercel AI SDK's `tool()` and `stepCountIs()` for multi-step tool calling.

**Key architecture:**
- **Proposal-then-confirm:** Write tools return a proposal card with a summary. Nothing mutates until the admin clicks "Confirm & Execute."
- **Step-filtered tools:** The backend only gives Claude tools relevant to the current wizard step (pass tools on Step 0, member tools on Step 1, invite tools on Step 2, approval tools on Step 3).
- **Ambient state injection:** Pass counts, member statuses, and blockers are pre-loaded into the system prompt so basic questions answer instantly without tool calls.
- **Multi-step chaining:** Claude can chain up to 8 tool calls per message (e.g., resolve a pass name → check draft count → propose sending invites).

**Tenant Admin tools (6 read + 2-3 write per step):** create/edit/delete passes, add/delete members, send/resend invites, change invite method, approve/reject members.

**Vend Admin tools (4 read + 5 write):** create tenants, configure billing, view cross-tenant progress, mock accept (demo), archive/reset tenants.

Every request is logged to `copilotLog` for observability. Rate limited at 30 requests/hour per tenant.

## What I Would Improve

- **Real authentication** — Replace mock role switcher with Clerk or Auth0
- **Optimistic updates** — Use Convex optimistic updates for instant UI feedback
- **Pagination** — Add cursor-based pagination for large member lists
- **E2E tests** — Add Playwright tests for the full onboarding flow
- **Real email/SMS** — Integrate SendGrid/Twilio for actual invite delivery
- **Real-time notifications** — Push notifications when members accept invites
- **Accessibility** — Full ARIA labels, keyboard navigation, screen reader testing
- **Mobile responsive** — Optimize the onboarding wizard for mobile viewports

## Development

### Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all services (Convex + web) via Turborepo |
| `pnpm dev:web` | Start only the web frontend |
| `pnpm dev:server` | Start only the Convex backend |
| `pnpm build` | Production build |
| `pnpm check-types` | TypeScript type checking across all packages |

### Storybook

```bash
cd apps/web
npx storybook dev -p 6006
```

Stories exist for: PassCard, MemberRow, InviteRow, MonitorRow, StatCard, BillingCard, CsvUploadCard, MemberForm, PassForm, PipelineFlow, OnboardingStatusBadge, AiImportCard, ColumnMappingCard, ImportReviewTable.

### Project Structure (Frontend)

```
apps/web/src/
  components/           Shared UI components + Storybook stories
    onboarding/         Step components (define passes, add members, send invites, monitor)
    ui/                 shadcn/ui primitives
  routes/               TanStack Router file-based routes
  lib/                  Auth context, types, constants, schemas, utilities
```
