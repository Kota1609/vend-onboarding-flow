import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

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

// --- Internal mutations (called from copilot executeProposal) ---

export const createInternal = internalMutation({
	args: {
		companyName: v.string(),
		adminName: v.string(),
		adminEmail: v.optional(v.string()),
		adminPhone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		// Atomic: insert tenant + admin together, no orphan risk
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

export const archiveInternal = internalMutation({
	args: { tenantId: v.id("tenants") },
	handler: async (ctx, { tenantId }) => {
		const tenant = await ctx.db.get(tenantId);
		if (!tenant) return { ok: false as const, message: "Tenant not found" };
		if ((tenant.status ?? "active") === "archived") {
			return { ok: false as const, message: "Tenant is already archived" };
		}

		// Check for active members
		const members = await ctx.db
			.query("members")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();

		const activeCount = members.filter(
			(m) => m.status === "approved" || m.status === "accepted",
		).length;

		await ctx.db.patch(tenantId, { status: "archived" });

		return {
			ok: true as const,
			warning:
				activeCount > 0
					? `Warning: ${activeCount} member${activeCount === 1 ? "" : "s"} have active access. Archiving will NOT revoke their parking access.`
					: undefined,
		};
	},
});

export const resetInternal = internalMutation({
	args: { tenantId: v.id("tenants") },
	handler: async (ctx, { tenantId }) => {
		const tenant = await ctx.db.get(tenantId);
		if (!tenant) return { ok: false as const, message: "Tenant not found" };

		// Soft-delete: mark all members as rejected (inactive)
		const members = await ctx.db
			.query("members")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();

		let membersArchived = 0;
		for (const m of members) {
			if (m.status !== "rejected") {
				await ctx.db.patch(m._id, { status: "rejected" });
				membersArchived++;
			}
		}

		// Soft-delete: mark all passes as archived (NOT hard delete)
		const passes = await ctx.db
			.query("passes")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();

		let passesArchived = 0;
		for (const p of passes) {
			if ((p.status ?? "active") !== "archived") {
				await ctx.db.patch(p._id, { status: "archived" });
				passesArchived++;
			}
		}

		// Delete invite attempts for all members
		let invitesDeleted = 0;
		for (const m of members) {
			const attempts = await ctx.db
				.query("inviteAttempts")
				.withIndex("by_member", (q) => q.eq("memberId", m._id))
				.collect();
			for (const a of attempts) {
				await ctx.db.delete(a._id);
				invitesDeleted++;
			}
		}

		// Clean up import batches and their rows
		const batches = await ctx.db
			.query("importBatches")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();
		for (const batch of batches) {
			const rows = await ctx.db
				.query("importRows")
				.withIndex("by_batch", (q) => q.eq("batchId", batch._id))
				.collect();
			for (const row of rows) {
				await ctx.db.delete(row._id);
			}
			await ctx.db.delete(batch._id);
		}

		// Clean up setup suggestions
		const suggestions = await ctx.db
			.query("setupSuggestions")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();
		for (const s of suggestions) {
			await ctx.db.delete(s._id);
		}

		return {
			ok: true as const,
			passesArchived,
			membersArchived,
			invitesDeleted,
		};
	},
});

export const hardDeleteInternal = internalMutation({
	args: { tenantId: v.id("tenants") },
	handler: async (ctx, { tenantId }) => {
		const tenant = await ctx.db.get(tenantId);
		if (!tenant) return { ok: false as const, message: "Tenant not found" };

		// Delete all members + their invite attempts
		const members = await ctx.db
			.query("members")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();
		for (const m of members) {
			const attempts = await ctx.db
				.query("inviteAttempts")
				.withIndex("by_member", (q) => q.eq("memberId", m._id))
				.collect();
			for (const a of attempts) await ctx.db.delete(a._id);
			await ctx.db.delete(m._id);
		}

		// Delete all passes
		const passes = await ctx.db
			.query("passes")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();
		for (const p of passes) await ctx.db.delete(p._id);

		// Delete import batches + rows
		const batches = await ctx.db
			.query("importBatches")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();
		for (const batch of batches) {
			const rows = await ctx.db
				.query("importRows")
				.withIndex("by_batch", (q) => q.eq("batchId", batch._id))
				.collect();
			for (const row of rows) await ctx.db.delete(row._id);
			await ctx.db.delete(batch._id);
		}

		// Delete setup suggestions
		const suggestions = await ctx.db
			.query("setupSuggestions")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();
		for (const s of suggestions) await ctx.db.delete(s._id);

		// Delete tenant admins
		const admins = await ctx.db
			.query("tenantAdmins")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
			.collect();
		for (const a of admins) await ctx.db.delete(a._id);

		// Delete copilot logs
		const logs = await ctx.db
			.query("copilotLog")
			.withIndex("by_tenant_time", (q) => q.eq("tenantId", tenantId))
			.collect();
		for (const l of logs) await ctx.db.delete(l._id);

		// Delete the tenant itself
		await ctx.db.delete(tenantId);

		return {
			ok: true as const,
			deleted: {
				members: members.length,
				passes: passes.length,
				tenant: tenant.companyName,
			},
		};
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
