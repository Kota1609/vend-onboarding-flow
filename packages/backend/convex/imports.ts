import { v } from "convex/values";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { computeAutoMethod } from "./members";
import { confidence, importSourceType } from "./schema";

// --- Internal mutations (called from AI actions) ---

export const createBatch = internalMutation({
	args: {
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
		sourceType: importSourceType,
		rawText: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const batchId = await ctx.db.insert("importBatches", {
			tenantId: args.tenantId,
			passId: args.passId,
			sourceType: args.sourceType,
			status: "pending_review",
			rawText: args.rawText,
			createdAt: Date.now(),
		});
		return batchId;
	},
});

export const addRows = internalMutation({
	args: {
		batchId: v.id("importBatches"),
		rows: v.array(
			v.object({
				name: v.string(),
				email: v.optional(v.string()),
				phone: v.optional(v.string()),
				confidence: confidence,
				notes: v.optional(v.string()),
				errors: v.array(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const batch = await ctx.db.get(args.batchId);
		if (!batch) throw new Error("Batch not found");

		// Load existing pass members for duplicate detection
		const existingMembers = await ctx.db
			.query("members")
			.withIndex("by_pass", (q) => q.eq("passId", batch.passId))
			.collect();

		for (const row of args.rows) {
			let duplicateOfMemberId: (typeof existingMembers)[0]["_id"] | undefined;
			let duplicateReason: string | undefined;

			if (row.email) {
				const emailLower = row.email.toLowerCase();
				const match = existingMembers.find(
					(m) => m.email && m.email.toLowerCase() === emailLower,
				);
				if (match) {
					duplicateOfMemberId = match._id;
					duplicateReason = `Duplicate email: ${row.email}`;
				}
			}
			if (!duplicateOfMemberId && row.phone) {
				const match = existingMembers.find((m) => m.phone === row.phone);
				if (match) {
					duplicateOfMemberId = match._id;
					duplicateReason = `Duplicate phone: ${row.phone}`;
				}
			}

			const hasErrors = row.errors.length > 0;

			await ctx.db.insert("importRows", {
				batchId: args.batchId,
				name: row.name,
				email: row.email,
				phone: row.phone,
				confidence: row.confidence,
				notes: row.notes,
				errors: row.errors,
				duplicateOfMemberId,
				duplicateReason,
				accepted: !hasErrors,
			});
		}
	},
});

// --- Public queries ---

export const getByBatch = query({
	args: { batchId: v.id("importBatches") },
	handler: async (ctx, { batchId }) => {
		const batch = await ctx.db.get(batchId);
		if (!batch) return null;

		const rows = await ctx.db
			.query("importRows")
			.withIndex("by_batch", (q) => q.eq("batchId", batchId))
			.collect();

		return { batch, rows };
	},
});

// --- Public mutations ---

export const updateRow = mutation({
	args: {
		rowId: v.id("importRows"),
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
		accepted: v.optional(v.boolean()),
	},
	handler: async (ctx, { rowId, ...fields }) => {
		const row = await ctx.db.get(rowId);
		if (!row) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Row not found",
			};
		}

		const updates: Record<string, unknown> = {};
		if (fields.name !== undefined) updates.name = fields.name;
		if (fields.email !== undefined) updates.email = fields.email || undefined;
		if (fields.phone !== undefined) updates.phone = fields.phone || undefined;
		if (fields.accepted !== undefined) updates.accepted = fields.accepted;

		await ctx.db.patch(rowId, updates);
		return { ok: true as const };
	},
});

export const confirmBatch = mutation({
	args: { batchId: v.id("importBatches") },
	handler: async (ctx, { batchId }) => {
		const batch = await ctx.db.get(batchId);
		if (!batch) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Batch not found",
			};
		}
		if (batch.status !== "pending_review") {
			return {
				ok: false as const,
				code: "INVALID_STATUS",
				message: `Batch status is ${batch.status}, expected pending_review`,
			};
		}

		const rows = await ctx.db
			.query("importRows")
			.withIndex("by_batch", (q) => q.eq("batchId", batchId))
			.collect();

		let successCount = 0;
		let failCount = 0;

		for (const row of rows) {
			if (!row.accepted) {
				failCount++;
				continue;
			}

			if (!row.name.trim()) {
				failCount++;
				continue;
			}

			const inviteAutoMethod = computeAutoMethod(row.email, row.phone);

			await ctx.db.insert("members", {
				tenantId: batch.tenantId,
				passId: batch.passId,
				name: row.name.trim(),
				email: row.email || undefined,
				phone: row.phone || undefined,
				status: "draft",
				inviteAutoMethod,
				createdAt: Date.now(),
			});

			successCount++;
		}

		await ctx.db.patch(batchId, { status: "confirmed" });

		return { ok: true as const, successCount, failCount };
	},
});

export const cancelBatch = mutation({
	args: { batchId: v.id("importBatches") },
	handler: async (ctx, { batchId }) => {
		const batch = await ctx.db.get(batchId);
		if (!batch) {
			return {
				ok: false as const,
				code: "NOT_FOUND",
				message: "Batch not found",
			};
		}

		// Delete orphaned rows
		const rows = await ctx.db
			.query("importRows")
			.withIndex("by_batch", (q) => q.eq("batchId", batchId))
			.collect();
		for (const row of rows) {
			await ctx.db.delete(row._id);
		}

		await ctx.db.patch(batchId, { status: "cancelled" });
		return { ok: true as const };
	},
});

// --- Internal queries/mutations for refinement ---

export const getBatchRawText = internalQuery({
	args: { batchId: v.id("importBatches") },
	handler: async (ctx, { batchId }) => {
		const batch = await ctx.db.get(batchId);
		return batch?.rawText ?? null;
	},
});

export const deleteRowsByBatch = internalMutation({
	args: { batchId: v.id("importBatches") },
	handler: async (ctx, { batchId }) => {
		const rows = await ctx.db
			.query("importRows")
			.withIndex("by_batch", (q) => q.eq("batchId", batchId))
			.collect();
		for (const row of rows) {
			await ctx.db.delete(row._id);
		}
	},
});
