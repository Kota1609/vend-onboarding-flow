import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { inviteMethod } from "./schema";

// --- Transition validation ---

type MemberStatus = "draft" | "invited" | "accepted" | "approved" | "rejected";

const VALID_TRANSITIONS: Record<MemberStatus, MemberStatus[]> = {
	draft: ["invited"],
	invited: ["accepted"],
	accepted: ["approved", "rejected"],
	approved: [],
	rejected: [],
};

function assertTransition(from: MemberStatus, to: MemberStatus): void {
	if (!VALID_TRANSITIONS[from].includes(to)) {
		throw new Error(`Invalid status transition: ${from} -> ${to}`);
	}
}

// --- Access code generation ---

const BASE32_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

function generateAccessCode(): string {
	let code = "";
	for (let i = 0; i < 8; i++) {
		code += BASE32_CHARS[Math.floor(Math.random() * BASE32_CHARS.length)];
	}
	return code;
}

// --- Auto method helper ---

function computeAutoMethod(
	email?: string,
	phone?: string,
): "email" | "phone" | "access_code" {
	if (email) return "email";
	if (phone) return "phone";
	return "access_code";
}

// --- CRUD mutations ---

export const create = mutation({
	args: {
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
		name: v.string(),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const pass = await ctx.db.get(args.passId);
		if (!pass || pass.tenantId !== args.tenantId) {
			return {
				ok: false as const,
				code: "INVALID_PASS",
				message: "Pass not found or does not belong to this tenant",
			};
		}

		const inviteAutoMethod = computeAutoMethod(args.email, args.phone);

		const memberId = await ctx.db.insert("members", {
			tenantId: args.tenantId,
			passId: args.passId,
			name: args.name,
			email: args.email || undefined,
			phone: args.phone || undefined,
			status: "draft",
			inviteAutoMethod,
			createdAt: Date.now(),
		});

		return { ok: true as const, memberId };
	},
});

export const update = mutation({
	args: {
		memberId: v.id("members"),
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
		inviteOverrideMethod: v.optional(inviteMethod),
	},
	handler: async (ctx, { memberId, ...fields }) => {
		const member = await ctx.db.get(memberId);
		if (!member) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Member not found",
			};
		}
		if (member.status !== "draft") {
			return {
				ok: false as const,
				code: "INVALID_STATUS",
				message: `Cannot edit: status is ${member.status}, expected draft`,
			};
		}

		const updates: Record<string, string | undefined> = {};
		if (fields.name !== undefined) updates.name = fields.name;
		if (fields.email !== undefined) updates.email = fields.email || undefined;
		if (fields.phone !== undefined) updates.phone = fields.phone || undefined;
		if (fields.inviteOverrideMethod !== undefined)
			updates.inviteOverrideMethod = fields.inviteOverrideMethod;

		// Recompute auto method if contact info changed
		if (fields.email !== undefined || fields.phone !== undefined) {
			const newEmail =
				fields.email !== undefined ? fields.email || undefined : member.email;
			const newPhone =
				fields.phone !== undefined ? fields.phone || undefined : member.phone;
			updates.inviteAutoMethod = computeAutoMethod(newEmail, newPhone);
		}

		await ctx.db.patch(memberId, updates);
		return { ok: true as const, memberId };
	},
});

export const remove = mutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Member not found",
			};
		}
		if (member.status !== "draft") {
			return {
				ok: false as const,
				code: "INVALID_STATUS",
				message: `Cannot delete: status is ${member.status}, expected draft`,
			};
		}

		await ctx.db.delete(memberId);
		return { ok: true as const };
	},
});

export const createBulk = mutation({
	args: {
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
		rows: v.array(
			v.object({
				name: v.string(),
				email: v.optional(v.string()),
				phone: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const pass = await ctx.db.get(args.passId);
		if (!pass || pass.tenantId !== args.tenantId) {
			return {
				ok: false as const,
				code: "INVALID_PASS",
				message: "Pass not found or does not belong to this tenant",
			};
		}

		// Load existing members for de-duplication
		const existing = await ctx.db
			.query("members")
			.withIndex("by_pass", (q) => q.eq("passId", args.passId))
			.collect();

		const results: Array<{
			index: number;
			ok: boolean;
			memberId?: string;
			error?: string;
			duplicate?: { duplicateOf: string; reason: "email" | "phone" };
		}> = [];
		let successCount = 0;
		let failCount = 0;

		for (let i = 0; i < args.rows.length; i++) {
			const row = args.rows[i];

			if (!row.name.trim()) {
				results.push({ index: i, ok: false, error: "Name is required" });
				failCount++;
				continue;
			}

			// Check for duplicates against existing members
			let duplicate:
				| { duplicateOf: string; reason: "email" | "phone" }
				| undefined;
			if (row.email) {
				const emailLower = row.email.toLowerCase();
				const match = existing.find(
					(m) => m.email && m.email.toLowerCase() === emailLower,
				);
				if (match) {
					duplicate = { duplicateOf: match._id, reason: "email" };
				}
			}
			if (!duplicate && row.phone) {
				const match = existing.find((m) => m.phone === row.phone);
				if (match) {
					duplicate = { duplicateOf: match._id, reason: "phone" };
				}
			}

			const inviteAutoMethod = computeAutoMethod(row.email, row.phone);

			const memberId = await ctx.db.insert("members", {
				tenantId: args.tenantId,
				passId: args.passId,
				name: row.name.trim(),
				email: row.email || undefined,
				phone: row.phone || undefined,
				status: "draft",
				inviteAutoMethod,
				createdAt: Date.now(),
			});

			results.push({
				index: i,
				ok: true,
				memberId,
				...(duplicate ? { duplicate } : {}),
			});
			successCount++;
		}

		return { ok: true as const, results, successCount, failCount };
	},
});

// --- Lifecycle mutations ---

export const sendInvite = mutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Member not found",
			};
		}

		assertTransition(member.status as MemberStatus, "invited");

		const effectiveMethod =
			member.inviteOverrideMethod ?? member.inviteAutoMethod;

		// Generate access code if needed and not already set
		let accessCode = member.accessCode;
		if (effectiveMethod === "access_code" && !accessCode) {
			// Generate unique access code with collision check
			let attempts = 0;
			do {
				accessCode = generateAccessCode();
				const existing = await ctx.db
					.query("members")
					.filter((q) => q.eq(q.field("accessCode"), accessCode))
					.first();
				if (!existing) break;
				attempts++;
			} while (attempts < 10);

			if (attempts >= 10) {
				return {
					ok: false as const,
					code: "CODE_GENERATION_FAILED",
					message: "Failed to generate unique access code",
				};
			}
		}

		await ctx.db.patch(memberId, {
			status: "invited",
			accessCode,
		});

		await ctx.db.insert("inviteAttempts", {
			memberId,
			method: effectiveMethod,
			sentAt: Date.now(),
			result: "sent",
		});

		return { ok: true as const, memberId };
	},
});

export const sendBulkInvites = mutation({
	args: { memberIds: v.array(v.id("members")) },
	handler: async (ctx, { memberIds }) => {
		const results: Array<{ memberId: string; ok: boolean; error?: string }> =
			[];

		for (const memberId of memberIds) {
			const member = await ctx.db.get(memberId);
			if (!member) {
				results.push({ memberId, ok: false, error: "Not found" });
				continue;
			}

			if (member.status !== "draft") {
				results.push({
					memberId,
					ok: false,
					error: `Cannot invite: status is ${member.status}`,
				});
				continue;
			}

			const effectiveMethod =
				member.inviteOverrideMethod ?? member.inviteAutoMethod;

			let accessCode = member.accessCode;
			if (effectiveMethod === "access_code" && !accessCode) {
				let attempts = 0;
				do {
					accessCode = generateAccessCode();
					const existing = await ctx.db
						.query("members")
						.filter((q) => q.eq(q.field("accessCode"), accessCode))
						.first();
					if (!existing) break;
					attempts++;
				} while (attempts < 10);

				if (attempts >= 10) {
					results.push({
						memberId,
						ok: false,
						error: "Failed to generate unique access code",
					});
					continue;
				}
			}

			await ctx.db.patch(memberId, {
				status: "invited",
				accessCode,
			});

			await ctx.db.insert("inviteAttempts", {
				memberId,
				method: effectiveMethod,
				sentAt: Date.now(),
				result: "sent",
			});

			results.push({ memberId, ok: true });
		}

		return { ok: true as const, results };
	},
});

export const resendInvite = mutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Member not found",
			};
		}

		if (member.status !== "invited") {
			return {
				ok: false as const,
				code: "INVALID_STATUS",
				message: `Cannot resend: status is ${member.status}, expected invited`,
			};
		}

		const effectiveMethod =
			member.inviteOverrideMethod ?? member.inviteAutoMethod;

		await ctx.db.insert("inviteAttempts", {
			memberId,
			method: effectiveMethod,
			sentAt: Date.now(),
			result: "sent",
		});

		return { ok: true as const, memberId };
	},
});

export const changeInviteMethod = mutation({
	args: {
		memberId: v.id("members"),
		method: inviteMethod,
	},
	handler: async (ctx, { memberId, method }) => {
		const member = await ctx.db.get(memberId);
		if (!member) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Member not found",
			};
		}

		if (member.status !== "invited") {
			return {
				ok: false as const,
				code: "INVALID_STATUS",
				message: `Cannot change method: status is ${member.status}, expected invited`,
			};
		}

		// Generate access code if switching to access_code and none exists
		let accessCode = member.accessCode;
		if (method === "access_code" && !accessCode) {
			accessCode = generateAccessCode();
		}

		await ctx.db.patch(memberId, {
			inviteOverrideMethod: method,
			accessCode,
		});

		// Log the method change + resend
		await ctx.db.insert("inviteAttempts", {
			memberId,
			method,
			sentAt: Date.now(),
			result: "sent",
		});

		return { ok: true as const, memberId };
	},
});

export const acceptInvite = mutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Member not found",
			};
		}

		assertTransition(member.status as MemberStatus, "accepted");

		await ctx.db.patch(memberId, { status: "accepted" });

		return { ok: true as const, memberId };
	},
});

export const approveInvite = mutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Member not found",
			};
		}

		assertTransition(member.status as MemberStatus, "approved");

		await ctx.db.patch(memberId, { status: "approved" });

		return { ok: true as const, memberId };
	},
});

export const rejectInvite = mutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Member not found",
			};
		}

		assertTransition(member.status as MemberStatus, "rejected");

		await ctx.db.patch(memberId, { status: "rejected" });

		return { ok: true as const, memberId };
	},
});

// --- Queries ---

export const getByPass = query({
	args: { passId: v.id("passes") },
	handler: async (ctx, { passId }) => {
		const members = await ctx.db
			.query("members")
			.withIndex("by_pass", (q) => q.eq("passId", passId))
			.collect();

		// Enrich with last invite attempt
		const enriched = await Promise.all(
			members.map(async (member) => {
				const lastAttempt = await ctx.db
					.query("inviteAttempts")
					.withIndex("by_member_sentAt", (q) => q.eq("memberId", member._id))
					.order("desc")
					.first();

				return {
					...member,
					effectiveMethod:
						member.inviteOverrideMethod ?? member.inviteAutoMethod,
					lastInviteAt: lastAttempt?.sentAt ?? null,
				};
			}),
		);

		return enriched;
	},
});

export const getInviteHistory = query({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		return await ctx.db
			.query("inviteAttempts")
			.withIndex("by_member_sentAt", (q) => q.eq("memberId", memberId))
			.order("desc")
			.collect();
	},
});
