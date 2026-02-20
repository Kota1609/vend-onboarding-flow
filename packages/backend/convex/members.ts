import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
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

export function computeAutoMethod(
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

// --- Internal mutations (called from copilot executeProposal) ---

export const sendBulkInvitesInternal = internalMutation({
	args: { memberIds: v.array(v.id("members")) },
	handler: async (ctx, { memberIds }) => {
		let succeeded = 0;
		let skipped = 0;

		for (const memberId of memberIds) {
			const member = await ctx.db.get(memberId);
			if (!member || member.status !== "draft") {
				skipped++;
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
					skipped++;
					continue;
				}
			}

			await ctx.db.patch(memberId, { status: "invited", accessCode });
			await ctx.db.insert("inviteAttempts", {
				memberId,
				method: effectiveMethod,
				sentAt: Date.now(),
				result: "sent",
			});
			succeeded++;
		}

		return { succeeded, skipped };
	},
});

export const approveInternal = internalMutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member || member.status !== "accepted") return;
		await ctx.db.patch(memberId, { status: "approved" });
	},
});

// --- Copilot internal mutations (Phase 2) ---

export const createInternal = internalMutation({
	args: {
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
		name: v.string(),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
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

export const createBulkInternal = internalMutation({
	args: {
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
		members: v.array(
			v.object({
				name: v.string(),
				email: v.optional(v.string()),
				phone: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		// All-or-nothing: validate ALL upfront
		const errors: Array<{ index: number; message: string }> = [];

		// Load existing members for duplicate check
		const existing = await ctx.db
			.query("members")
			.withIndex("by_pass", (q) => q.eq("passId", args.passId))
			.collect();
		const existingEmails = new Set(
			existing
				.filter((m) => m.email)
				.map((m) => m.email!.toLowerCase()),
		);

		const batchEmails = new Set<string>();

		for (let i = 0; i < args.members.length; i++) {
			const m = args.members[i];
			if (!m.name.trim()) {
				errors.push({ index: i, message: "Name is required" });
			}
			if (m.email) {
				const emailLower = m.email.toLowerCase();
				if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) {
					errors.push({ index: i, message: `Invalid email: ${m.email}` });
				} else if (existingEmails.has(emailLower)) {
					errors.push({
						index: i,
						message: `Duplicate email in pass: ${m.email}`,
					});
				} else if (batchEmails.has(emailLower)) {
					errors.push({
						index: i,
						message: `Duplicate email in batch: ${m.email}`,
					});
				} else {
					batchEmails.add(emailLower);
				}
			}
		}

		if (errors.length > 0) {
			return { ok: false as const, errors };
		}

		// All valid — insert all
		for (const m of args.members) {
			const inviteAutoMethod = computeAutoMethod(m.email, m.phone);
			await ctx.db.insert("members", {
				tenantId: args.tenantId,
				passId: args.passId,
				name: m.name.trim(),
				email: m.email || undefined,
				phone: m.phone || undefined,
				status: "draft",
				inviteAutoMethod,
				createdAt: Date.now(),
			});
		}

		return { ok: true as const, created: args.members.length };
	},
});

export const removeInternal = internalMutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) return { ok: false as const, message: "Member not found" };
		if (member.status !== "draft" && member.status !== "rejected") {
			return {
				ok: false as const,
				message: `Cannot delete: status is ${member.status}. Only draft or rejected members can be deleted.`,
			};
		}
		await ctx.db.delete(memberId);
		return { ok: true as const };
	},
});

export const removeBulkInternal = internalMutation({
	args: { memberIds: v.array(v.id("members")) },
	handler: async (ctx, { memberIds }) => {
		let deleted = 0;
		const skipped: Array<{ name: string; status: string }> = [];
		for (const id of memberIds) {
			const member = await ctx.db.get(id);
			if (!member) continue;
			if (member.status === "draft" || member.status === "rejected") {
				await ctx.db.delete(id);
				deleted++;
			} else {
				skipped.push({ name: member.name, status: member.status });
			}
		}
		return { ok: true as const, deleted, skipped };
	},
});

export const sendInviteInternal = internalMutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) return { ok: false as const, message: "Member not found" };
		if (member.status !== "draft") {
			return {
				ok: false as const,
				message: `Cannot invite: status is ${member.status}, expected draft`,
			};
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
				return {
					ok: false as const,
					message: "Failed to generate unique access code",
				};
			}
		}

		await ctx.db.patch(memberId, { status: "invited", accessCode });
		await ctx.db.insert("inviteAttempts", {
			memberId,
			method: effectiveMethod,
			sentAt: Date.now(),
			result: "sent",
		});

		return { ok: true as const };
	},
});

export const resendInternal = internalMutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) return { ok: false as const, message: "Member not found" };
		if (member.status !== "invited") {
			return {
				ok: false as const,
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

		return { ok: true as const };
	},
});

export const changeMethodInternal = internalMutation({
	args: {
		memberId: v.id("members"),
		method: inviteMethod,
	},
	handler: async (ctx, { memberId, method }) => {
		const member = await ctx.db.get(memberId);
		if (!member) return { ok: false as const, message: "Member not found" };
		if (member.status !== "invited") {
			return {
				ok: false as const,
				message: `Cannot change method: status is ${member.status}, expected invited`,
			};
		}

		let accessCode = member.accessCode;
		if (method === "access_code" && !accessCode) {
			accessCode = generateAccessCode();
		}

		await ctx.db.patch(memberId, {
			inviteOverrideMethod: method,
			accessCode,
		});

		await ctx.db.insert("inviteAttempts", {
			memberId,
			method,
			sentAt: Date.now(),
			result: "sent",
		});

		return { ok: true as const };
	},
});

export const acceptBulkInternal = internalMutation({
	args: {
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
	},
	handler: async (ctx, args) => {
		const members = await ctx.db
			.query("members")
			.withIndex("by_pass_status", (q) =>
				q.eq("passId", args.passId).eq("status", "invited"),
			)
			.collect();

		let accepted = 0;
		let skipped = 0;

		for (const member of members) {
			if (member.tenantId !== args.tenantId) {
				skipped++;
				continue;
			}
			await ctx.db.patch(member._id, { status: "accepted" });
			accepted++;
		}

		return { accepted, skipped };
	},
});

export const rejectInternal = internalMutation({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		const member = await ctx.db.get(memberId);
		if (!member) return { ok: false as const, message: "Member not found" };
		if (member.status !== "accepted") {
			return {
				ok: false as const,
				message: `Cannot reject: status is ${member.status}, expected accepted`,
			};
		}
		await ctx.db.patch(memberId, { status: "rejected" });
		return { ok: true as const };
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
