import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const memberStatus = v.union(
	v.literal("draft"),
	v.literal("invited"),
	v.literal("accepted"),
	v.literal("approved"),
	v.literal("rejected"),
);

export const inviteMethod = v.union(
	v.literal("email"),
	v.literal("phone"),
	v.literal("access_code"),
);

export const billingType = v.union(
	v.literal("recurring"),
	v.literal("usage_based"),
);

export const importSourceType = v.union(
	v.literal("csv"),
	v.literal("excel"),
	v.literal("pdf"),
	v.literal("text"),
);

export const importBatchStatus = v.union(
	v.literal("pending_review"),
	v.literal("confirmed"),
	v.literal("cancelled"),
);

export const confidence = v.union(
	v.literal("high"),
	v.literal("medium"),
	v.literal("low"),
);

export default defineSchema({
	tenants: defineTable({
		companyName: v.string(),
		createdAt: v.number(),
	}),

	tenantAdmins: defineTable({
		tenantId: v.id("tenants"),
		name: v.string(),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
		createdAt: v.number(),
	}).index("by_tenant", ["tenantId"]),

	passes: defineTable({
		tenantId: v.id("tenants"),
		name: v.string(),
		description: v.string(),
		targetMemberCount: v.number(),
		billingType: v.optional(billingType),
		createdAt: v.number(),
	}).index("by_tenant", ["tenantId"]),

	members: defineTable({
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
		name: v.string(),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
		status: memberStatus,
		inviteAutoMethod: inviteMethod,
		inviteOverrideMethod: v.optional(inviteMethod),
		accessCode: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index("by_pass", ["passId"])
		.index("by_tenant", ["tenantId"])
		.index("by_pass_status", ["passId", "status"]),

	inviteAttempts: defineTable({
		memberId: v.id("members"),
		method: inviteMethod,
		sentAt: v.number(),
		result: v.optional(v.union(v.literal("sent"), v.literal("failed"))),
		error: v.optional(v.string()),
	})
		.index("by_member", ["memberId"])
		.index("by_member_sentAt", ["memberId", "sentAt"]),

	importBatches: defineTable({
		tenantId: v.id("tenants"),
		passId: v.id("passes"),
		sourceType: importSourceType,
		status: importBatchStatus,
		createdAt: v.number(),
	}).index("by_tenant", ["tenantId"]),

	importRows: defineTable({
		batchId: v.id("importBatches"),
		name: v.string(),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
		confidence: confidence,
		notes: v.optional(v.string()),
		errors: v.array(v.string()),
		duplicateOfMemberId: v.optional(v.id("members")),
		duplicateReason: v.optional(v.string()),
		accepted: v.boolean(),
	}).index("by_batch", ["batchId"]),
});
