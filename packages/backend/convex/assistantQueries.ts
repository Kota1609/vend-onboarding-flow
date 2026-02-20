import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";

// Note: These internal queries accept v.string() for IDs because the
// assistant action passes raw strings. We cast to Id<T> at the boundary.

// --- Internal queries called by assistant action ---

export const passProgress = internalQuery({
	args: { tenantId: v.string() },
	handler: async (ctx, { tenantId }) => {
		const tid = tenantId as Id<"tenants">;
		const passes = await ctx.db
			.query("passes")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tid))
			.collect();

		const results = await Promise.all(
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
					passName: pass.name,
					targetMemberCount: pass.targetMemberCount,
					memberCount: members.length,
					statusBreakdown,
				};
			}),
		);

		return results;
	},
});

export const membersByStatus = internalQuery({
	args: {
		tenantId: v.string(),
		passId: v.optional(v.string()),
		status: v.string(),
	},
	handler: async (ctx, args) => {
		const tid = args.tenantId as Id<"tenants">;
		const allMembers = await ctx.db
			.query("members")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tid))
			.collect();

		return allMembers
			.filter((m) => {
				if (m.status !== args.status) return false;
				if (args.passId && m.passId !== args.passId) return false;
				return true;
			})
			.map((m) => ({
				name: m.name,
				email: m.email,
				phone: m.phone,
				status: m.status,
			}));
	},
});

export const passList = internalQuery({
	args: { tenantId: v.string() },
	handler: async (ctx, { tenantId }) => {
		const tid = tenantId as Id<"tenants">;
		const passes = await ctx.db
			.query("passes")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tid))
			.collect();

		const results = await Promise.all(
			passes.map(async (pass) => {
				const members = await ctx.db
					.query("members")
					.withIndex("by_pass", (q) => q.eq("passId", pass._id))
					.collect();

				return {
					passId: pass._id,
					name: pass.name,
					description: pass.description,
					targetMemberCount: pass.targetMemberCount,
					memberCount: members.length,
				};
			}),
		);

		return results;
	},
});

export const blockers = internalQuery({
	args: { tenantId: v.string() },
	handler: async (ctx, { tenantId }) => {
		const tid = tenantId as Id<"tenants">;
		const members = await ctx.db
			.query("members")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tid))
			.collect();

		const uninvitedDrafts = members.filter((m) => m.status === "draft").length;
		const unacceptedInvites = members.filter(
			(m) => m.status === "invited",
		).length;
		const pendingApprovals = members.filter(
			(m) => m.status === "accepted",
		).length;

		const issues: string[] = [];
		if (uninvitedDrafts > 0) {
			issues.push(
				`${uninvitedDrafts} member${uninvitedDrafts === 1 ? "" : "s"} still in draft (not yet invited)`,
			);
		}
		if (unacceptedInvites > 0) {
			issues.push(
				`${unacceptedInvites} member${unacceptedInvites === 1 ? "" : "s"} invited but haven't accepted`,
			);
		}
		if (pendingApprovals > 0) {
			issues.push(
				`${pendingApprovals} member${pendingApprovals === 1 ? "" : "s"} accepted but awaiting approval`,
			);
		}

		return {
			uninvitedDrafts,
			unacceptedInvites,
			pendingApprovals,
			issues,
		};
	},
});

// --- Copilot tool support queries ---

export const countByStatus = internalQuery({
	args: {
		tenantId: v.string(),
		passId: v.optional(v.string()),
		status: v.string(),
	},
	handler: async (ctx, args) => {
		const tid = args.tenantId as Id<"tenants">;
		const members = await ctx.db
			.query("members")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tid))
			.collect();
		return members.filter((m) => {
			if (m.status !== args.status) return false;
			if (args.passId && m.passId !== (args.passId as Id<"passes">))
				return false;
			return true;
		}).length;
	},
});

export const memberIdsByStatus = internalQuery({
	args: {
		tenantId: v.string(),
		passId: v.optional(v.string()),
		status: v.string(),
	},
	handler: async (ctx, args) => {
		const tid = args.tenantId as Id<"tenants">;
		return (
			await ctx.db
				.query("members")
				.withIndex("by_tenant", (q) => q.eq("tenantId", tid))
				.collect()
		)
			.filter((m) => {
				if (m.status !== args.status) return false;
				if (args.passId && m.passId !== (args.passId as Id<"passes">))
					return false;
				return true;
			})
			.map((m) => m._id);
	},
});

// --- Pass existence check ---

export const passExists = internalQuery({
	args: { passId: v.string() },
	handler: async (ctx, { passId }) => {
		const pass = await ctx.db.get(passId as Id<"passes">);
		return !!pass;
	},
});

// --- Resolve queries (for copilot disambiguation) ---

export const resolveMember = internalQuery({
	args: {
		tenantId: v.string(),
		passId: v.string(),
		memberName: v.string(),
	},
	handler: async (ctx, args) => {
		const pid = args.passId as Id<"passes">;
		const members = await ctx.db
			.query("members")
			.withIndex("by_pass", (q) => q.eq("passId", pid))
			.collect();

		const needle = args.memberName.toLowerCase();
		const matches = members
			.filter((m) => m.name.toLowerCase().includes(needle))
			.map((m) => ({
				memberId: m._id,
				name: m.name,
				email: m.email ?? null,
				phone: m.phone ?? null,
				status: m.status,
			}));

		const capped = matches.slice(0, 10);
		if (matches.length > 10) {
			return {
				results: capped,
				totalMatches: matches.length,
				note: `Showing first 10 of ${matches.length} matches. Ask the user to be more specific.`,
			};
		}
		return { results: capped, totalMatches: matches.length };
	},
});

export const resolveTenant = internalQuery({
	args: { tenantName: v.string() },
	handler: async (ctx, args) => {
		const tenants = await ctx.db.query("tenants").collect();
		const needle = args.tenantName.toLowerCase();
		return tenants
			.filter(
				(t) =>
					t.companyName.toLowerCase().includes(needle) &&
					(t.status ?? "active") !== "archived",
			)
			.map((t) => ({
				tenantId: t._id,
				companyName: t.companyName,
			}));
	},
});

// --- Cross-tenant queries (Vend Admin) ---

export const allTenantsProgress = internalQuery({
	args: {},
	handler: async (ctx) => {
		const allTenants = await ctx.db.query("tenants").collect();
		// Filter out archived tenants (treat undefined status as "active")
		const tenants = allTenants.filter(
			(t) => (t.status ?? "active") !== "archived",
		);

		const results = await Promise.all(
			tenants.map(async (tenant) => {
				const passes = await ctx.db
					.query("passes")
					.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
					.collect();

				const members = await ctx.db
					.query("members")
					.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
					.collect();

				const statusBreakdown = {
					draft: 0,
					invited: 0,
					accepted: 0,
					approved: 0,
					rejected: 0,
				};
				for (const m of members) {
					if (m.status in statusBreakdown) {
						statusBreakdown[m.status as keyof typeof statusBreakdown]++;
					}
				}

				const totalTarget = passes.reduce(
					(sum, p) => sum + p.targetMemberCount,
					0,
				);

				return {
					tenantId: tenant._id,
					companyName: tenant.companyName,
					passCount: passes.length,
					memberCount: members.length,
					totalTarget,
					statusBreakdown,
					completionPct:
						totalTarget > 0
							? Math.round((statusBreakdown.approved / totalTarget) * 100)
							: 0,
				};
			}),
		);

		return results;
	},
});

export const crossTenantBlockers = internalQuery({
	args: {},
	handler: async (ctx) => {
		const allTenants = await ctx.db.query("tenants").collect();
		const tenants = allTenants.filter(
			(t) => (t.status ?? "active") !== "archived",
		);
		const issues: Array<{ companyName: string; blockers: string[] }> = [];

		for (const tenant of tenants) {
			const members = await ctx.db
				.query("members")
				.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
				.collect();

			const blockerList: string[] = [];
			const drafts = members.filter((m) => m.status === "draft").length;
			const invited = members.filter((m) => m.status === "invited").length;
			const accepted = members.filter((m) => m.status === "accepted").length;

			if (drafts > 0)
				blockerList.push(`${drafts} uninvited draft${drafts === 1 ? "" : "s"}`);
			if (invited > 0)
				blockerList.push(
					`${invited} pending acceptance${invited === 1 ? "" : "s"}`,
				);
			if (accepted > 0)
				blockerList.push(
					`${accepted} awaiting approval${accepted === 1 ? "" : "s"}`,
				);

			if (blockerList.length > 0) {
				issues.push({
					companyName: tenant.companyName,
					blockers: blockerList,
				});
			}
		}

		return issues;
	},
});

// --- Rate limiting ---

export const recentCopilotRequestCount = internalQuery({
	args: { tenantId: v.string(), windowMs: v.number() },
	handler: async (ctx, args) => {
		const cutoff = Date.now() - args.windowMs;
		const logs = await ctx.db
			.query("copilotLog")
			.withIndex("by_tenant_time", (q) =>
				q.eq("tenantId", args.tenantId).gte("createdAt", cutoff),
			)
			.collect();
		return logs.length;
	},
});
