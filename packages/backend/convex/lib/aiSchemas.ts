import { z } from "zod";

export const ExtractedMemberSchema = z.object({
	name: z.string().min(1).describe("Full name of the person"),
	email: z
		.string()
		.email()
		.nullable()
		.describe("Email address if found, null if not present"),
	phone: z
		.string()
		.nullable()
		.describe("Phone number if found, null if not present"),
	notes: z.string().nullable().describe("Role/title info or extraction notes"),
	confidence: z
		.enum(["high", "medium", "low"])
		.describe(
			"high = all fields clearly present; medium = some ambiguity; low = guessed/partial",
		),
});

export const ExtractionResultSchema = z.object({
	members: z.array(ExtractedMemberSchema),
	sourceNotes: z
		.string()
		.nullable()
		.describe("Overall notes about document quality"),
	warnings: z
		.array(z.string())
		.describe("Any issues encountered during extraction"),
});

export const SuggestedPassSchema = z.object({
	name: z.string().min(1).describe("Suggested pass name"),
	description: z.string().describe("Description based on document context"),
	estimatedMemberCount: z
		.number()
		.int()
		.positive()
		.describe("Estimated number of members"),
	reasoning: z.string().describe("Why this pass was suggested"),
	confidence: z.enum(["high", "medium", "low"]),
});

export const SetupMemberSchema = ExtractedMemberSchema.extend({
	suggestedPassName: z
		.string()
		.nullable()
		.describe(
			"Name of the suggested pass this member belongs to, or null if unclear",
		),
});

export const SetupSuggestionSchema = z.object({
	passes: z.array(SuggestedPassSchema),
	members: z.array(SetupMemberSchema),
	sourceNotes: z
		.string()
		.nullable()
		.describe("Overall notes about document quality"),
	warnings: z
		.array(z.string())
		.describe("Any issues encountered during extraction"),
});

export const ClarifyingQuestionSchema = z.object({
	id: z.string().describe("Unique question ID"),
	question: z.string().describe("The question to ask the user"),
	options: z
		.array(z.string())
		.optional()
		.describe("Suggested answers if applicable"),
	context: z
		.string()
		.describe("Brief explanation of why this needs clarification"),
});

export const ExtractionWithQuestionsSchema = ExtractionResultSchema.extend({
	questions: z
		.array(ClarifyingQuestionSchema)
		.max(3)
		.describe(
			"Max 3 questions. ONLY for GENUINE ambiguity affecting data quality. If the document is clear, return empty array.",
		),
});

export const ColumnMappingSchema = z.object({
	mappings: z.array(
		z.object({
			sourceColumn: z.string().describe("Original header name from the file"),
			targetField: z
				.enum(["name", "first_name", "last_name", "email", "phone", "skip"])
				.describe("Which member field this maps to. Use first_name + last_name when columns are split."),
			confidence: z.enum(["high", "medium", "low"]),
			reasoning: z
				.string()
				.describe("Brief explanation of why this mapping was chosen"),
		}),
	),
});
