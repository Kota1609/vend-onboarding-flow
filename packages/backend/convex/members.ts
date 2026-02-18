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

// --- Mutations ---

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
