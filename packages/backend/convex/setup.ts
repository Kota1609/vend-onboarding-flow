import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { confidence } from "./schema";

export const createSuggestion = internalMutation({
	args: {
		tenantId: v.id("tenants"),
		suggestedPasses: v.array(
			v.object({
				name: v.string(),
				description: v.string(),
				estimatedMemberCount: v.number(),
				reasoning: v.string(),
				confidence,
			}),
		),
		members: v.array(
			v.object({
				name: v.string(),
				email: v.optional(v.string()),
				phone: v.optional(v.string()),
				suggestedPassName: v.optional(v.string()),
				confidence,
				notes: v.optional(v.string()),
			}),
		),
		sourceNotes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		return ctx.db.insert("setupSuggestions", {
			...args,
			status: "pending",
			createdAt: Date.now(),
		});
	},
});

export const get = query({
	args: { suggestionId: v.id("setupSuggestions") },
	handler: async (ctx, { suggestionId }) => {
		return ctx.db.get(suggestionId);
	},
});

export const markApplied = mutation({
	args: { suggestionId: v.id("setupSuggestions") },
	handler: async (ctx, { suggestionId }) => {
		await ctx.db.patch(suggestionId, { status: "applied" });
	},
});

export const dismiss = mutation({
	args: { suggestionId: v.id("setupSuggestions") },
	handler: async (ctx, { suggestionId }) => {
		await ctx.db.patch(suggestionId, { status: "dismissed" });
	},
});
