import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
	args: {
		companyName: v.string(),
		adminName: v.string(),
		adminEmail: v.optional(v.string()),
		adminPhone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		const tenantId = await ctx.db.insert("tenants", {
			companyName: args.companyName,
			createdAt: now,
		});

		await ctx.db.insert("tenantAdmins", {
			tenantId,
			name: args.adminName,
			email: args.adminEmail,
			phone: args.adminPhone,
			createdAt: now,
		});

		return { ok: true as const, tenantId };
	},
});

export const list = query({
	handler: async (ctx) => {
		const tenants = await ctx.db.query("tenants").collect();

		const enriched = await Promise.all(
			tenants.map(async (tenant) => {
				const passes = await ctx.db
					.query("passes")
					.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
					.collect();

				const admin = await ctx.db
					.query("tenantAdmins")
					.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
					.first();

				if (passes.length === 0) {
					return {
						...tenant,
						admin,
						onboardingStatus: "not_started" as const,
						passCount: 0,
						totalMembers: 0,
						approvedMembers: 0,
						totalTarget: 0,
						draftMembers: 0,
						invitedMembers: 0,
						acceptedMembers: 0,
						rejectedMembers: 0,
						billingConfigured: 0,
						blockers: ["No passes created"],
					};
				}

				let totalMembers = 0;
				let approvedMembers = 0;
				let totalTarget = 0;
				let draftMembers = 0;
				let invitedMembers = 0;
				let acceptedMembers = 0;
				let rejectedMembers = 0;
				let billingConfigured = 0;
				let allComplete = true;

				for (const pass of passes) {
					totalTarget += pass.targetMemberCount;
					if (pass.billingType) billingConfigured++;

					const members = await ctx.db
						.query("members")
						.withIndex("by_pass", (q) => q.eq("passId", pass._id))
						.collect();

					totalMembers += members.length;

					let passApproved = 0;
					for (const m of members) {
						if (m.status === "approved") {
							approvedMembers++;
							passApproved++;
						} else if (m.status === "draft") draftMembers++;
						else if (m.status === "invited") invitedMembers++;
						else if (m.status === "accepted") acceptedMembers++;
						else if (m.status === "rejected") rejectedMembers++;
					}

					if (passApproved < pass.targetMemberCount) {
						allComplete = false;
					}
				}

				const hasMembers = totalMembers > 0;
				let onboardingStatus: "not_started" | "in_progress" | "complete";
				if (!hasMembers) {
					onboardingStatus = "not_started";
				} else if (allComplete) {
					onboardingStatus = "complete";
				} else {
					onboardingStatus = "in_progress";
				}

				const blockers: string[] = [];
				if (totalTarget === 0) blockers.push("Targets not set");
				if (totalMembers === 0) blockers.push("No members added");
				if (acceptedMembers > 0)
					blockers.push(
						`${acceptedMembers} member${acceptedMembers === 1 ? "" : "s"} awaiting approval`,
					);
				if (billingConfigured < passes.length)
					blockers.push(
						`${passes.length - billingConfigured} pass${passes.length - billingConfigured === 1 ? "" : "es"} need billing configured`,
					);

				return {
					...tenant,
					admin,
					onboardingStatus,
					passCount: passes.length,
					totalMembers,
					approvedMembers,
					totalTarget,
					draftMembers,
					invitedMembers,
					acceptedMembers,
					rejectedMembers,
					billingConfigured,
					blockers,
				};
			}),
		);

		return enriched;
	},
});

export const getById = query({
	args: { tenantId: v.id("tenants") },
	handler: async (ctx, { tenantId }) => {
		const tenant = await ctx.db.get(tenantId);
		if (!tenant) return null;

		const admin = await ctx.db
			.query("tenantAdmins")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.first();

		const passes = await ctx.db
			.query("passes")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();

		return { ...tenant, admin, passes };
	},
});
