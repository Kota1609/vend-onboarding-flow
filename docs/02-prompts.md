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
- Never fabricate contact information. If not present, omit the field.
```

### Zod Extraction Schema
```typescript
import { z } from "zod";

export const ExtractedMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]).default("high"),
});

export const ExtractionResultSchema = z.object({
  members: z.array(ExtractedMemberSchema),
  sourceNotes: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});
```

### Usage with Vercel AI SDK
```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";

const result = await generateObject({
  model: anthropic("claude-sonnet-4-20250514"),
  schema: ExtractionResultSchema,
  prompt: `Extract all person/member records from this document:\n\n${documentText}`,
});
```

## Smart Column Mapping (CSV/Excel)

### Schema
```typescript
export const ColumnMappingSchema = z.object({
  mappings: z.array(z.object({
    sourceColumn: z.string(),
    targetField: z.enum(["name", "email", "phone", "skip"]),
    confidence: z.enum(["high", "medium", "low"]),
  })),
});
```

## Error Handling
- LLM returns invalid JSON: retry once, then show error + let user re-upload
- Zod validation fails: show partial results with warnings, let user correct
- No members extracted: show "No members found" with option to try different format
- All errors logged to console + shown in UI toast
