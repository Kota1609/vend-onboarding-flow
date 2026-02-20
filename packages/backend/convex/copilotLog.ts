import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const logRequest = internalMutation({
	args: {
		tenantId: v.string(),
		role: v.optional(v.string()),
		prompt: v.string(),
		toolNames: v.array(v.string()),
		responseLength: v.number(),
		durationMs: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("copilotLog", {
			tenantId: args.tenantId,
			role: args.role,
			prompt: args.prompt.slice(0, 500),
			toolNames: args.toolNames,
			responseLength: args.responseLength,
			durationMs: args.durationMs,
			createdAt: Date.now(),
		});
	},
});
