import { mutation } from "./_generated/server";

/**
 * Dev-only seed mutation. Populates 1 tenant, 1 admin, 2 passes, ~8 members
 * across all lifecycle statuses. Call from Convex dashboard to bootstrap demo data.
 */
export const run = mutation({
	handler: async (ctx) => {
		// Check if already seeded
		const existing = await ctx.db.query("tenants").first();
		if (existing) {
			return {
				ok: false as const,
				code: "ALREADY_SEEDED",
				message: "Seed data already exists",
			};
		}

		const now = Date.now();

		// Tenant
		const tenantId = await ctx.db.insert("tenants", {
			companyName: "Acme Corp",
			createdAt: now,
		});

		// Tenant Admin
		await ctx.db.insert("tenantAdmins", {
			tenantId,
			name: "Sarah Chen",
			email: "sarah.chen@acmecorp.com",
			phone: "+1-555-0101",
			createdAt: now,
		});

		// Passes
		const execPassId = await ctx.db.insert("passes", {
			tenantId,
			name: "Executive Reserved",
			description: "Reserved spots for C-suite and senior leadership",
			targetMemberCount: 5,
			createdAt: now,
		});

		const generalPassId = await ctx.db.insert("passes", {
			tenantId,
			name: "General Employee",
			description: "Standard employee parking access",
			targetMemberCount: 10,
			createdAt: now,
		});

		// Helper to compute auto method
		const autoMethod = (email?: string, phone?: string) => {
			if (email) return "email" as const;
			if (phone) return "phone" as const;
			return "access_code" as const;
		};

		// Executive pass members (5 members, mixed statuses)
		const execMembers = [
			{
				name: "James Morton",
				email: "james.morton@acmecorp.com",
				status: "approved" as const,
			},
			{
				name: "Lisa Park",
				email: "lisa.park@acmecorp.com",
				status: "accepted" as const,
			},
			{
				name: "Robert Kim",
				email: "robert.kim@acmecorp.com",
				status: "invited" as const,
			},
			{ name: "Diana Wells", phone: "+1-555-0202", status: "invited" as const },
			{ name: "Marcus Johnson", status: "draft" as const },
		];

		for (const m of execMembers) {
			const method = autoMethod(m.email, m.phone);
			const memberId = await ctx.db.insert("members", {
				tenantId,
				passId: execPassId,
				name: m.name,
				email: m.email,
				phone: m.phone,
				status: m.status,
				inviteAutoMethod: method,
				accessCode: method === "access_code" ? "A3BK7M2X" : undefined,
				createdAt: now,
			});

			// Add invite attempts for non-draft members
			if (m.status !== "draft") {
				await ctx.db.insert("inviteAttempts", {
					memberId,
					method,
					sentAt: now - 3 * 24 * 60 * 60 * 1000, // 3 days ago
					result: "sent",
				});
			}
		}

		// General pass members (5 members, mixed statuses)
		const generalMembers = [
			{
				name: "Amy Torres",
				email: "amy.torres@acmecorp.com",
				status: "approved" as const,
			},
			{
				name: "Kevin Patel",
				email: "kevin.patel@acmecorp.com",
				status: "approved" as const,
			},
			{
				name: "Nina Gomez",
				email: "nina.gomez@acmecorp.com",
				status: "accepted" as const,
			},
			{ name: "Tom Bradley", phone: "+1-555-0303", status: "invited" as const },
			{
				name: "Rachel Nguyen",
				email: "rachel.nguyen@acmecorp.com",
				status: "rejected" as const,
			},
			{
				name: "Chris Walker",
				email: "chris.walker@acmecorp.com",
				status: "draft" as const,
			},
		];

		for (const m of generalMembers) {
			const method = autoMethod(m.email, m.phone);
			const memberId = await ctx.db.insert("members", {
				tenantId,
				passId: generalPassId,
				name: m.name,
				email: m.email,
				phone: m.phone,
				status: m.status,
				inviteAutoMethod: method,
				createdAt: now,
			});

			if (m.status !== "draft") {
				await ctx.db.insert("inviteAttempts", {
					memberId,
					method,
					sentAt: now - 5 * 24 * 60 * 60 * 1000, // 5 days ago
					result: "sent",
				});
			}

			// Rejected member got a second invite attempt before rejection
			if (m.status === "rejected") {
				await ctx.db.insert("inviteAttempts", {
					memberId,
					method,
					sentAt: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago
					result: "sent",
				});
			}
		}

		return { ok: true as const, tenantId };
	},
});
