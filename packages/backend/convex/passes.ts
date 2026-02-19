import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { billingType } from "./schema";

export const create = mutation({
	args: {
		tenantId: v.id("tenants"),
		name: v.string(),
		description: v.string(),
		targetMemberCount: v.number(),
	},
	handler: async (ctx, args) => {
		const passId = await ctx.db.insert("passes", {
			tenantId: args.tenantId,
			name: args.name,
			description: args.description,
			targetMemberCount: args.targetMemberCount,
			createdAt: Date.now(),
		});
		return { ok: true as const, passId };
	},
});

export const update = mutation({
	args: {
		passId: v.id("passes"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		targetMemberCount: v.optional(v.number()),
		billingType: v.optional(billingType),
	},
	handler: async (ctx, { passId, ...fields }) => {
		const pass = await ctx.db.get(passId);
		if (!pass) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Pass not found",
			};
		}

		const updates: Record<string, string | number> = {};
		if (fields.name !== undefined) updates.name = fields.name;
		if (fields.description !== undefined)
			updates.description = fields.description;
		if (fields.targetMemberCount !== undefined)
			updates.targetMemberCount = fields.targetMemberCount;
		if (fields.billingType !== undefined)
			updates.billingType = fields.billingType;

		await ctx.db.patch(passId, updates);
		return { ok: true as const, passId };
	},
});

export const remove = mutation({
	args: { passId: v.id("passes") },
	handler: async (ctx, { passId }) => {
		const pass = await ctx.db.get(passId);
		if (!pass) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Pass not found",
			};
		}

		const members = await ctx.db
			.query("members")
			.withIndex("by_pass", (q) => q.eq("passId", passId))
			.first();

		if (members) {
			return {
				ok: false as const,
				code: "HAS_MEMBERS",
				message: "Cannot delete a pass that has members",
			};
		}

		await ctx.db.delete(passId);
		return { ok: true as const };
	},
});

export const listByTenant = query({
	args: { tenantId: v.id("tenants") },
	handler: async (ctx, { tenantId }) => {
		const passes = await ctx.db
			.query("passes")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();

		const enriched = await Promise.all(
			passes.map(async (pass) => {
				const members = await ctx.db
					.query("members")
					.withIndex("by_pass", (q) => q.eq("passId", pass._id))
					.collect();

				const statusBreakdown = {
					draft: 0,
					invited: 0,
					accepted: 0,
					approved: 0,
					rejected: 0,
				};

				for (const m of members) {
					statusBreakdown[m.status as keyof typeof statusBreakdown]++;
				}

				return {
					...pass,
					memberCount: members.length,
					statusBreakdown,
				};
			}),
		);

		return enriched;
	},
});
