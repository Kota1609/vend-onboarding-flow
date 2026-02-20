"use node";

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { v } from "convex/values";
import type { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import {
	ColumnMappingSchema,
	ExtractionResultSchema,
	ExtractionWithQuestionsSchema,
	SetupSuggestionSchema,
} from "./lib/aiSchemas";
import {
	COLUMN_MAPPING_PROMPT,
	EXTRACTION_SYSTEM_PROMPT,
	SETUP_EXTRACTION_PROMPT,
} from "./lib/prompts";
import { importSourceType } from "./schema";

interface ClarifyingQuestion {
	id: string;
	question: string;
	options?: string[];
	context: string;
}

type ExtractionSuccess = {
	ok: true;
	batchId: Id<"importBatches">;
	memberCount: number;
	warning?: string;
	questions?: ClarifyingQuestion[];
};

type ExtractionError = {
	ok: false;
	code: string;
	message: string;
};

type ExtractionResult = ExtractionSuccess | ExtractionError;

// --- Text-based extraction (cheap, for PDFs with text, CSVs, pasted text) ---

export const extractMembers = action({
	args: {
		text: v.string(),
		sourceType: importSourceType,
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
	},
	handler: async (ctx, args): Promise<ExtractionResult> => {
		if (!process.env.ANTHROPIC_API_KEY) {
			return {
				ok: false,
				code: "NO_API_KEY",
				message: "ANTHROPIC_API_KEY not set",
			};
		}

		const wasTruncated = args.text.length > 50_000;
		const text = wasTruncated ? args.text.slice(0, 50_000) : args.text;

		const anthropic = createAnthropic({
			apiKey: process.env.ANTHROPIC_API_KEY,
		});

		let output: z.infer<typeof ExtractionWithQuestionsSchema> | undefined;
		try {
			const result = await generateText({
				model: anthropic("claude-sonnet-4-20250514"),
				output: Output.object({ schema: ExtractionWithQuestionsSchema }),
				system: EXTRACTION_SYSTEM_PROMPT,
				prompt: `Extract all person/member records:\n\n${text}`,
			});
			output = result.output;
		} catch (e) {
			return {
				ok: false,
				code: "AI_ERROR",
				message:
					e instanceof Error
						? `AI extraction failed: ${e.message}`
						: "AI extraction failed unexpectedly. Please try again.",
			};
		}

		if (!output) {
			return {
				ok: false,
				code: "EXTRACTION_FAILED",
				message: "No data extracted",
			};
		}

		const batchId: Id<"importBatches"> = await ctx.runMutation(
			internal.imports.createBatch,
			{
				tenantId: args.tenantId,
				passId: args.passId,
				sourceType: args.sourceType,
				rawText: text,
			},
		);

		await ctx.runMutation(internal.imports.addRows, {
			batchId,
			rows: output.members.map((m) => ({
				name: m.name,
				email: m.email ?? undefined,
				phone: m.phone ?? undefined,
				confidence: m.confidence,
				notes: m.notes ?? undefined,
				errors: [],
			})),
		});

		const questions: ClarifyingQuestion[] | undefined =
			output.questions && output.questions.length > 0
				? output.questions.map((q) => ({
						id: q.id,
						question: q.question,
						options: q.options ?? undefined,
						context: q.context,
					}))
				: undefined;

		return {
			ok: true,
			batchId,
			memberCount: output.members.length,
			...(questions ? { questions } : {}),
			...(wasTruncated
				? {
						warning:
							"Document was truncated to 50,000 characters. Some data may be missing.",
					}
				: {}),
		};
	},
});

// --- VLM extraction (for scanned PDFs, screenshots, photos) ---

export const extractMembersVision = action({
	args: {
		images: v.array(v.string()),
		sourceType: importSourceType,
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
	},
	handler: async (ctx, args): Promise<ExtractionResult> => {
		if (!process.env.ANTHROPIC_API_KEY) {
			return {
				ok: false,
				code: "NO_API_KEY",
				message: "ANTHROPIC_API_KEY not set",
			};
		}

		const images = args.images.slice(0, 10);

		const anthropic = createAnthropic({
			apiKey: process.env.ANTHROPIC_API_KEY,
		});

		let output: z.infer<typeof ExtractionResultSchema> | undefined;
		try {
			const result = await generateText({
				model: anthropic("claude-sonnet-4-20250514"),
				output: Output.object({ schema: ExtractionResultSchema }),
				system: EXTRACTION_SYSTEM_PROMPT,
				messages: [
					{
						role: "user",
						content: [
							...images.map((img) => ({
								type: "image" as const,
								image: img,
							})),
							{
								type: "text" as const,
								text: "Extract all person/member records from these document pages.",
							},
						],
					},
				],
			});
			output = result.output;
		} catch (e) {
			return {
				ok: false,
				code: "AI_ERROR",
				message:
					e instanceof Error
						? `AI extraction failed: ${e.message}`
						: "AI extraction failed unexpectedly. Please try again.",
			};
		}

		if (!output) {
			return {
				ok: false,
				code: "EXTRACTION_FAILED",
				message: "No data extracted from images",
			};
		}

		const batchId: Id<"importBatches"> = await ctx.runMutation(
			internal.imports.createBatch,
			{
				tenantId: args.tenantId,
				passId: args.passId,
				sourceType: args.sourceType,
				rawText: `[VLM: ${images.length} images]`,
			},
		);

		await ctx.runMutation(internal.imports.addRows, {
			batchId,
			rows: output.members.map((m) => ({
				name: m.name,
				email: m.email ?? undefined,
				phone: m.phone ?? undefined,
				confidence: m.confidence,
				notes: m.notes ?? undefined,
				errors: [],
			})),
		});

		return {
			ok: true,
			batchId,
			memberCount: output.members.length,
			...(args.images.length > 10
				? {
						warning: "Only first 10 pages were processed to control costs.",
					}
				: {}),
		};
	},
});

// --- Smart Column Mapping ---

type MappingResult =
	| {
			ok: true;
			mappings: Array<{
				sourceColumn: string;
				targetField: "name" | "first_name" | "last_name" | "email" | "phone" | "skip";
				confidence: "high" | "medium" | "low";
				reasoning: string;
			}>;
	  }
	| { ok: false; code: string; message: string };

export const mapColumns = action({
	args: {
		headers: v.array(v.string()),
		sampleRows: v.array(v.array(v.string())),
	},
	handler: async (_ctx, args): Promise<MappingResult> => {
		if (!process.env.ANTHROPIC_API_KEY) {
			return {
				ok: false,
				code: "NO_API_KEY",
				message: "ANTHROPIC_API_KEY not set",
			};
		}

		const anthropic = createAnthropic({
			apiKey: process.env.ANTHROPIC_API_KEY,
		});

		let output: z.infer<typeof ColumnMappingSchema> | undefined;
		try {
			const result = await generateText({
				model: anthropic("claude-sonnet-4-20250514"),
				output: Output.object({ schema: ColumnMappingSchema }),
				system: COLUMN_MAPPING_PROMPT,
				prompt: `Headers: ${JSON.stringify(args.headers)}\nSample rows:\n${args.sampleRows.map((r) => JSON.stringify(r)).join("\n")}`,
			});
			output = result.output;
		} catch (e) {
			return {
				ok: false,
				code: "AI_ERROR",
				message:
					e instanceof Error
						? `AI column mapping failed: ${e.message}`
						: "AI column mapping failed unexpectedly. Please try again.",
			};
		}

		if (!output) {
			return {
				ok: false,
				code: "MAPPING_FAILED",
				message: "Could not map columns",
			};
		}

		return { ok: true, ...output };
	},
});

// --- Setup extraction (pass + member extraction from documents) ---

type SetupExtractionSuccess = {
	ok: true;
	suggestionId: Id<"setupSuggestions">;
	passCount: number;
	memberCount: number;
	warning?: string;
};

type SetupExtractionResult = SetupExtractionSuccess | ExtractionError;

export const extractSetup = action({
	args: {
		text: v.string(),
		sourceType: importSourceType,
		tenantId: v.id("tenants"),
	},
	handler: async (ctx, args): Promise<SetupExtractionResult> => {
		if (!process.env.ANTHROPIC_API_KEY) {
			return {
				ok: false,
				code: "NO_API_KEY",
				message: "ANTHROPIC_API_KEY not set",
			};
		}

		const wasTruncated = args.text.length > 50_000;
		const text = wasTruncated ? args.text.slice(0, 50_000) : args.text;

		const anthropic = createAnthropic({
			apiKey: process.env.ANTHROPIC_API_KEY,
		});

		let output: z.infer<typeof SetupSuggestionSchema> | undefined;
		try {
			const result = await generateText({
				model: anthropic("claude-sonnet-4-20250514"),
				output: Output.object({ schema: SetupSuggestionSchema }),
				system: SETUP_EXTRACTION_PROMPT,
				prompt: `Extract pass types and member records from this document:\n\n${text}`,
			});
			output = result.output;
		} catch (e) {
			return {
				ok: false,
				code: "AI_ERROR",
				message:
					e instanceof Error
						? `AI extraction failed: ${e.message}`
						: "AI extraction failed unexpectedly. Please try again.",
			};
		}

		if (!output) {
			return {
				ok: false,
				code: "EXTRACTION_FAILED",
				message: "Could not extract setup information from document",
			};
		}

		const suggestionId = await ctx.runMutation(
			internal.setup.createSuggestion,
			{
				tenantId: args.tenantId,
				suggestedPasses: output.passes.map((p) => ({
					name: p.name,
					description: p.description,
					estimatedMemberCount: p.estimatedMemberCount,
					reasoning: p.reasoning,
					confidence: p.confidence,
				})),
				members: output.members.map((m) => ({
					name: m.name,
					email: m.email ?? undefined,
					phone: m.phone ?? undefined,
					suggestedPassName: m.suggestedPassName ?? undefined,
					confidence: m.confidence,
					notes: m.notes ?? undefined,
				})),
				sourceNotes: output.sourceNotes ?? undefined,
			},
		);

		return {
			ok: true,
			suggestionId,
			passCount: output.passes.length,
			memberCount: output.members.length,
			...(wasTruncated
				? {
						warning:
							"Document was truncated to 50,000 characters. Some data may be missing.",
					}
				: {}),
		};
	},
});

// --- Refinement extraction (re-extract with user answers to clarifying questions) ---

export const refineExtraction = action({
	args: {
		batchId: v.id("importBatches"),
		answers: v.array(v.object({ questionId: v.string(), answer: v.string() })),
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
		round: v.number(),
	},
	handler: async (ctx, args): Promise<ExtractionResult> => {
		if (args.round > 2) {
			return {
				ok: false,
				code: "MAX_ROUNDS",
				message: "Maximum refinement rounds reached.",
			};
		}

		if (!process.env.ANTHROPIC_API_KEY) {
			return {
				ok: false,
				code: "NO_API_KEY",
				message: "ANTHROPIC_API_KEY not set",
			};
		}

		const rawText = await ctx.runQuery(internal.imports.getBatchRawText, {
			batchId: args.batchId,
		});

		if (!rawText) {
			return {
				ok: false,
				code: "NO_RAW_TEXT",
				message: "Original document text not found.",
			};
		}

		const anthropic = createAnthropic({
			apiKey: process.env.ANTHROPIC_API_KEY,
		});

		const guidance = args.answers
			.map((a) => `- Question "${a.questionId}": ${a.answer}`)
			.join("\n");

		let output: z.infer<typeof ExtractionResultSchema> | undefined;
		try {
			const result = await generateText({
				model: anthropic("claude-sonnet-4-20250514"),
				output: Output.object({ schema: ExtractionResultSchema }),
				system: EXTRACTION_SYSTEM_PROMPT,
				prompt: `Re-extract members from this document using the clarifications below.\n\nClarifications:\n${guidance}\n\nDocument:\n${rawText}`,
			});
			output = result.output;
		} catch (e) {
			return {
				ok: false,
				code: "AI_ERROR",
				message:
					e instanceof Error
						? `AI refinement failed: ${e.message}`
						: "AI refinement failed unexpectedly. Please try again.",
			};
		}

		if (!output) {
			return {
				ok: false,
				code: "EXTRACTION_FAILED",
				message: "Refinement extraction failed.",
			};
		}

		// Delete old rows and insert new ones
		await ctx.runMutation(internal.imports.deleteRowsByBatch, {
			batchId: args.batchId,
		});

		await ctx.runMutation(internal.imports.addRows, {
			batchId: args.batchId,
			rows: output.members.map((m) => ({
				name: m.name,
				email: m.email ?? undefined,
				phone: m.phone ?? undefined,
				confidence: m.confidence,
				notes: m.notes ?? undefined,
				errors: [],
			})),
		});

		return {
			ok: true,
			batchId: args.batchId,
			memberCount: output.members.length,
		};
	},
});
