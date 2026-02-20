# AI Prompts & Extraction Schema

## LLM Provider
Anthropic Claude (via @ai-sdk/anthropic)
Model: claude-sonnet-4-20250514 (or latest available)

## Document Extraction

### System Prompt
```
You are a data extraction assistant for a parking pass onboarding system.
Given a document (lease agreement, security export, spreadsheet, or free-form text),
extract all person records with their name and contact information.

Rules:
- Extract every person mentioned who could be a parking pass member
- For each person, extract: full name, email address (if present), phone number (if present)
- If you find role/title information, include it in the notes field
- If confidence is low for any field, set confidence to "low"
- Return an empty array if no people are found
- Never fabricate contact information. If not present, set to null.
```

### Zod Extraction Schema
```typescript
import { z } from "zod";

export const ExtractedMemberSchema = z.object({
  name: z.string().min(1).describe("Full name of the person"),
  email: z.string().email().nullable().describe("Email address if found, null if not present"),
  phone: z.string().nullable().describe("Phone number if found, null if not present"),
  notes: z.string().nullable().describe("Role/title info or extraction notes"),
  confidence: z.enum(["high", "medium", "low"]).describe(
    "high = all fields clearly present; medium = some ambiguity; low = guessed/partial"
  ),
});

export const ExtractionResultSchema = z.object({
  members: z.array(ExtractedMemberSchema),
  sourceNotes: z.string().nullable().describe("Overall notes about document quality"),
  warnings: z.array(z.string()).describe("Any issues encountered during extraction"),
});
```

### Usage with Vercel AI SDK 6
```typescript
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const { output } = await generateText({
  model: anthropic("claude-sonnet-4-20250514"),
  output: Output.object({ schema: ExtractionResultSchema }),
  system: EXTRACTION_SYSTEM_PROMPT,
  prompt: `Extract all person/member records:\n\n${documentText}`,
});
```

> **Note:** `generateObject` is deprecated in AI SDK 6. Use `generateText` with
> `Output.object({ schema })` instead for structured output extraction.

## Smart Column Mapping (CSV/Excel)

### System Prompt
```
You are a data mapping assistant. Given CSV/Excel column headers and sample data rows,
determine which columns map to which member fields.

Target fields:
- name: The person's full name (required)
- email: Email address
- phone: Phone number
- skip: Column does not map to any member field

Rules:
- Every column must be mapped to exactly one target field or "skip"
- At most one column per target field (no duplicates)
- Use sample data to resolve ambiguous headers
- Assign confidence: high = obvious match, medium = reasonable guess, low = uncertain
- Provide brief reasoning for each mapping
```

### Schema
```typescript
export const ColumnMappingSchema = z.object({
  mappings: z.array(z.object({
    sourceColumn: z.string().describe("Original header name from the file"),
    targetField: z.enum(["name", "email", "phone", "skip"]).describe("Which member field this maps to"),
    confidence: z.enum(["high", "medium", "low"]),
    reasoning: z.string().describe("Brief explanation of why this mapping was chosen"),
  })),
});
```

## Onboarding Copilot Prompts

### Tenant Admin System Prompt
- Role: manages passes, members, invites, and approvals for one facility
- Tools are filtered by the current wizard step (max 8-9 per request)
- Rules:
  - ALWAYS call resolvePass/resolveMember before single-entity operations
  - If resolveMember returns multiple matches, list them and ask the user to clarify — NEVER pick arbitrarily
  - For bulk text like "Add X, Y, Z to Executive", use proposeAddBulkMembers
  - Proposal summaries use "all current draft members" not hard counts (counts go stale)
  - The pre-loaded state is always current. If it differs from earlier conversation, trust the current state — the user may have made changes outside of chat
  - NEVER use emojis

### Vend Admin System Prompt
- Role: manages tenants, oversees onboarding, handles billing and demo operations
- Rules:
  - Use resolveTenant before tenant-specific operations
  - proposeMockAcceptAll is for demo/testing only
  - proposeResetTenant archives data (not permanent delete). Summary MUST show counts.
  - NEVER use emojis

### Tool Descriptions (Tenant Admin)

**Read tools (always present, 5):**
- `resolvePass` — name → passId lookup
- `resolveMember` — name → ALL matches with status (multi-match, for disambiguation)
- `getPassProgress` — per-pass member counts by status
- `getBlockers` — current blockers for onboarding
- `getMembersByStatus` — members filtered by status

**Write tools (step-filtered):**

| Step | Tools |
|------|-------|
| 0 (Passes) | proposeCreatePass, proposeEditPass, proposeDeletePass |
| 1 (Members) | proposeAddMember, proposeAddBulkMembers, proposeDeleteMember |
| 2 (Invites) | proposeSendInvites, proposeSendSingleInvite, proposeResendInvite, proposeChangeMethod |
| 3 (Approve) | proposeApproveSingle, proposeApproveAll, proposeRejectMember |
| undefined | proposeCreatePass, proposeAddMember, proposeSendInvites, proposeApproveAll |

### Tool Descriptions (Vend Admin)

**Read tools (4):**
- `getAllTenantsProgress` — all tenants with onboarding status
- `getCrossTenantBlockers` — blockers across tenants
- `getTenantDetail` — single tenant deep-dive
- `resolveTenant` — name → tenantId lookup

**Write tools (5):**
- `proposeCreateTenant` — create tenant + admin atomically
- `proposeSetBilling` — set billingType on a pass
- `proposeMockAcceptAll` — demo: transition all invited → accepted in a pass
- `proposeArchiveTenant` — soft-deactivate tenant
- `proposeResetTenant` — archive all data (NOT hard delete)

## Error Handling
- LLM returns invalid JSON: retry once, then show error + let user re-upload
- Zod validation fails: show partial results with warnings, let user correct
- No members extracted: show "No members found" with option to try different format
- Missing API key: return `{ ok: false, code: "NO_API_KEY" }` → UI shows helpful message
- All errors logged to console + shown in UI toast
