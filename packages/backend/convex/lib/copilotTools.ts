import { tool } from "ai";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

/** Proposal returned by write tools — stored as intent, not resolved IDs. */
export type Proposal = {
	action: string;
	intent: Record<string, unknown>;
	requiresConfirmation: true;
	summary: string;
};

// --- Shared read tool builders ---

function readTools(ctx: ActionCtx, tenantId: string) {
	return {
		resolvePass: tool({
			description:
				"Look up a pass by name to get its real passId. ALWAYS call this before using a passId in other tools.",
			inputSchema: z.object({
				passName: z
					.string()
					.describe("The pass name to look up (case-insensitive)"),
			}),
			execute: async ({ passName }: { passName: string }) => {
				try {
					const passes = await ctx.runQuery(
						internal.assistantQueries.passList,
						{ tenantId },
					);
					const match = passes.find(
						(p) =>
							p.name.toLowerCase() === passName.toLowerCase() ||
							p.name.toLowerCase().includes(passName.toLowerCase()),
					);
					if (!match) {
						return {
							error: `No pass found matching "${passName}". Available passes: ${passes.map((p) => p.name).join(", ")}`,
						};
					}
					return {
						passId: match.passId,
						name: match.name,
						memberCount: match.memberCount,
						targetMemberCount: match.targetMemberCount,
					};
				} catch (e) {
					return {
						error: e instanceof Error ? e.message : "Query failed",
					};
				}
			},
		}),

		resolveMember: tool({
			description:
				"Look up a member by name in a pass. Returns ALL matches. If multiple, list them and ask the user to clarify — NEVER pick arbitrarily.",
			inputSchema: z.object({
				passId: z.string().describe("The pass to search within"),
				memberName: z
					.string()
					.describe(
						"The member name to look up (case-insensitive partial match)",
					),
			}),
			execute: async (args: { passId: string; memberName: string }) => {
				try {
					return await ctx.runQuery(internal.assistantQueries.resolveMember, {
						tenantId,
						passId: args.passId,
						memberName: args.memberName,
					});
				} catch (e) {
					return {
						error: e instanceof Error ? e.message : "Query failed",
					};
				}
			},
		}),

		getPassProgress: tool({
			description: "Get all passes with member counts and status breakdowns",
			inputSchema: z.object({}),
			execute: async () => {
				try {
					return await ctx.runQuery(internal.assistantQueries.passProgress, {
						tenantId,
					});
				} catch (e) {
					return {
						error: e instanceof Error ? e.message : "Query failed",
					};
				}
			},
		}),

		getBlockers: tool({
			description:
				"Find onboarding blockers: uninvited drafts, unaccepted invites, pending approvals",
			inputSchema: z.object({}),
			execute: async () => {
				try {
					return await ctx.runQuery(internal.assistantQueries.blockers, {
						tenantId,
					});
				} catch (e) {
					return {
						error: e instanceof Error ? e.message : "Query failed",
					};
				}
			},
		}),

		getMembersByStatus: tool({
			description: "List members filtered by status and optional pass",
			inputSchema: z.object({
				status: z.enum([
					"draft",
					"invited",
					"accepted",
					"approved",
					"rejected",
				]),
				passId: z.string().optional(),
			}),
			execute: async (args: {
				status: "draft" | "invited" | "accepted" | "approved" | "rejected";
				passId?: string;
			}) => {
				try {
					return await ctx.runQuery(internal.assistantQueries.membersByStatus, {
						tenantId,
						status: args.status,
						passId: args.passId,
					});
				} catch (e) {
					return {
						error: e instanceof Error ? e.message : "Query failed",
					};
				}
			},
		}),
	};
}

// --- Write tool builders by step ---

function passWriteTools(tenantId: string) {
	return {
		proposeCreatePass: tool({
			description:
				"Propose creating a new parking pass. Returns a proposal for user confirmation.",
			inputSchema: z.object({
				name: z.string().min(1),
				description: z.string().min(1),
				targetMemberCount: z.number().int().positive(),
			}),
			execute: async (args: {
				name: string;
				description: string;
				targetMemberCount: number;
			}): Promise<Proposal> => ({
				action: "createPass",
				intent: {
					tenantId,
					name: args.name,
					description: args.description,
					targetMemberCount: args.targetMemberCount,
				},
				requiresConfirmation: true,
				summary: `Create pass "${args.name}" with target ${args.targetMemberCount} members`,
			}),
		}),

		proposeEditPass: tool({
			description:
				"Propose editing a pass (name, description, or target count). Use resolvePass first to get passId.",
			inputSchema: z.object({
				passId: z.string(),
				name: z.string().optional(),
				description: z.string().optional(),
				targetMemberCount: z.number().int().positive().optional(),
			}),
			execute: async (args: {
				passId: string;
				name?: string;
				description?: string;
				targetMemberCount?: number;
			}): Promise<Proposal> => {
				const changes: string[] = [];
				if (args.name !== undefined) changes.push(`name to "${args.name}"`);
				if (args.description !== undefined) changes.push("description");
				if (args.targetMemberCount !== undefined)
					changes.push(`target to ${args.targetMemberCount}`);
				return {
					action: "editPass",
					intent: {
						passId: args.passId,
						name: args.name,
						description: args.description,
						targetMemberCount: args.targetMemberCount,
					},
					requiresConfirmation: true,
					summary: `Update pass: ${changes.join(", ")}`,
				};
			},
		}),

		proposeDeletePass: tool({
			description:
				"Propose deleting a pass. Use resolvePass first. Pass must have zero members.",
			inputSchema: z.object({
				passId: z.string(),
			}),
			execute: async (args: { passId: string }): Promise<Proposal> => ({
				action: "deletePass",
				intent: { passId: args.passId },
				requiresConfirmation: true,
				summary: "Delete this pass (must have no members)",
			}),
		}),
	};
}

function memberWriteTools(tenantId: string) {
	return {
		proposeAddMember: tool({
			description:
				"Propose adding a single member to a pass. Use resolvePass first.",
			inputSchema: z.object({
				passId: z.string(),
				name: z.string().min(1).describe("Human name, NOT an email"),
				email: z.string().optional(),
				phone: z.string().optional(),
			}),
			execute: async (args: {
				passId: string;
				name: string;
				email?: string;
				phone?: string;
			}): Promise<Proposal> => ({
				action: "addMember",
				intent: {
					tenantId,
					passId: args.passId,
					name: args.name,
					email: args.email,
					phone: args.phone,
				},
				requiresConfirmation: true,
				summary: `Add "${args.name}" to pass${args.email ? ` (${args.email})` : ""}`,
			}),
		}),

		proposeAddBulkMembers: tool({
			description: `Propose adding multiple members. Parse user input carefully.
Example: "Add John john@acme.com, Jane, Bob bob@test.com"
-> members: [{ name: "John", email: "john@acme.com" }, { name: "Jane" }, { name: "Bob", email: "bob@test.com" }]
Proposal summary MUST list each parsed member for user verification.`,
			inputSchema: z.object({
				passId: z.string(),
				members: z.array(
					z.object({
						name: z.string().describe("Human name, NOT an email"),
						email: z.string().optional(),
						phone: z.string().optional(),
					}),
				),
			}),
			execute: async (args: {
				passId: string;
				members: Array<{ name: string; email?: string; phone?: string }>;
			}): Promise<Proposal> => {
				const memberList = args.members
					.map(
						(m) =>
							`${m.name}${m.email ? ` (${m.email})` : ""}${m.phone ? ` [${m.phone}]` : ""}`,
					)
					.join(", ");
				return {
					action: "addBulkMembers",
					intent: {
						tenantId,
						passId: args.passId,
						members: args.members,
					},
					requiresConfirmation: true,
					summary: `Add ${args.members.length} members: ${memberList}`,
				};
			},
		}),

		proposeDeleteMember: tool({
			description:
				"Propose deleting a single member. Use resolveMember first. Only draft or rejected members can be deleted.",
			inputSchema: z.object({
				memberId: z.string(),
			}),
			execute: async (args: { memberId: string }): Promise<Proposal> => ({
				action: "deleteMember",
				intent: { memberId: args.memberId },
				requiresConfirmation: true,
				summary: "Delete this member",
			}),
		}),
		proposeDeleteBulkMembers: tool({
			description:
				"Propose deleting multiple members at once. ALWAYS use this instead of proposeDeleteMember when deleting more than one member. Use resolveMember for each first. Only draft or rejected members will be deleted; others are skipped.",
			inputSchema: z.object({
				memberIds: z
					.array(z.string())
					.describe("Array of member IDs to delete"),
				memberNames: z
					.array(z.string())
					.describe("Corresponding member names for the summary"),
			}),
			execute: async (args: {
				memberIds: string[];
				memberNames: string[];
			}): Promise<Proposal> => ({
				action: "deleteBulkMembers",
				intent: { memberIds: args.memberIds },
				requiresConfirmation: true,
				summary: `Delete ${args.memberIds.length} members: ${args.memberNames.join(", ")}`,
			}),
		}),
	};
}

function inviteWriteTools(ctx: ActionCtx, tenantId: string) {
	return {
		proposeSendInvites: tool({
			description:
				"Propose sending invites to all draft members in a pass. Use resolvePass first.",
			inputSchema: z.object({ passId: z.string() }),
			execute: async ({ passId }: { passId: string }): Promise<Proposal> => {
				try {
					const count = await ctx.runQuery(
						internal.assistantQueries.countByStatus,
						{ tenantId, passId, status: "draft" },
					);
					return {
						action: "sendBulkInvites",
						intent: { tenantId, passId, status: "draft" },
						requiresConfirmation: true,
						summary: `Send invites to all current draft members (${count})`,
					};
				} catch {
					return {
						action: "sendBulkInvites",
						intent: { tenantId, passId, status: "draft" },
						requiresConfirmation: true,
						summary: "Send invites to all draft members in this pass",
					};
				}
			},
		}),

		proposeSendSingleInvite: tool({
			description:
				"Propose sending an invite to a single member. Use resolveMember first. Member must be draft.",
			inputSchema: z.object({ memberId: z.string() }),
			execute: async (args: { memberId: string }): Promise<Proposal> => ({
				action: "sendSingleInvite",
				intent: { memberId: args.memberId },
				requiresConfirmation: true,
				summary: "Send invite to this member",
			}),
		}),

		proposeResendInvite: tool({
			description:
				"Propose resending an invite to a member. Use resolveMember first. Member must be invited.",
			inputSchema: z.object({ memberId: z.string() }),
			execute: async (args: { memberId: string }): Promise<Proposal> => ({
				action: "resendInvite",
				intent: { memberId: args.memberId },
				requiresConfirmation: true,
				summary: "Resend invite to this member",
			}),
		}),

		proposeChangeMethod: tool({
			description:
				"Propose changing a member's invite method. Use resolveMember first. Member must be invited.",
			inputSchema: z.object({
				memberId: z.string(),
				method: z.enum(["email", "phone", "access_code"]),
			}),
			execute: async (args: {
				memberId: string;
				method: string;
			}): Promise<Proposal> => ({
				action: "changeMethod",
				intent: { memberId: args.memberId, method: args.method },
				requiresConfirmation: true,
				summary: `Change invite method to ${args.method}`,
			}),
		}),
	};
}

function approveWriteTools(ctx: ActionCtx, tenantId: string) {
	return {
		proposeApproveSingle: tool({
			description:
				"Propose approving a single member. Use resolveMember first. Member must be accepted.",
			inputSchema: z.object({ memberId: z.string() }),
			execute: async (args: { memberId: string }): Promise<Proposal> => ({
				action: "approveSingle",
				intent: { memberId: args.memberId },
				requiresConfirmation: true,
				summary: "Approve this member",
			}),
		}),

		proposeApproveAll: tool({
			description:
				"Propose approving all accepted members in a pass. Use resolvePass first.",
			inputSchema: z.object({ passId: z.string() }),
			execute: async ({ passId }: { passId: string }): Promise<Proposal> => {
				try {
					const count = await ctx.runQuery(
						internal.assistantQueries.countByStatus,
						{ tenantId, passId, status: "accepted" },
					);
					return {
						action: "approveAll",
						intent: { tenantId, passId, status: "accepted" },
						requiresConfirmation: true,
						summary: `Approve all current accepted members (${count})`,
					};
				} catch {
					return {
						action: "approveAll",
						intent: { tenantId, passId, status: "accepted" },
						requiresConfirmation: true,
						summary: "Approve all accepted members in this pass",
					};
				}
			},
		}),

		proposeRejectMember: tool({
			description:
				"Propose rejecting a member. Use resolveMember first. Member must be accepted.",
			inputSchema: z.object({ memberId: z.string() }),
			execute: async (args: { memberId: string }): Promise<Proposal> => ({
				action: "rejectMember",
				intent: { memberId: args.memberId },
				requiresConfirmation: true,
				summary: "Reject this member",
			}),
		}),
	};
}

// --- Step-filtered write tools for Tenant Admin ---

function tenantAdminWriteTools(
	ctx: ActionCtx,
	tenantId: string,
	currentStep?: number,
) {
	switch (currentStep) {
		case 0:
			return passWriteTools(tenantId);
		case 1:
			return memberWriteTools(tenantId);
		case 2:
			return inviteWriteTools(ctx, tenantId);
		case 3:
			return approveWriteTools(ctx, tenantId);
		default:
			// Outside wizard: 4 most common write tools
			return {
				proposeCreatePass: passWriteTools(tenantId).proposeCreatePass,
				proposeAddMember: memberWriteTools(tenantId).proposeAddMember,
				proposeSendInvites: inviteWriteTools(ctx, tenantId).proposeSendInvites,
				proposeApproveAll: approveWriteTools(ctx, tenantId).proposeApproveAll,
			};
	}
}

/**
 * Builds AI SDK v6 tool definitions for the Tenant Admin copilot.
 * 5 read tools (always) + step-filtered write tools = max 8-9 tools.
 */
export function buildTenantAdminTools(
	ctx: ActionCtx,
	tenantId: string,
	currentStep?: number,
) {
	return {
		...readTools(ctx, tenantId),
		...tenantAdminWriteTools(ctx, tenantId, currentStep),
	};
}

/**
 * Builds AI SDK v6 tool definitions for the Vend Admin copilot.
 * 4 read tools + 5 write tools = 9 tools.
 */
export function buildVendAdminTools(ctx: ActionCtx) {
	return {
		getAllTenantsProgress: tool({
			description:
				"Get all tenants with their pass counts, member counts, status breakdowns, and completion percentage",
			inputSchema: z.object({}),
			execute: async () => {
				try {
					return await ctx.runQuery(
						internal.assistantQueries.allTenantsProgress,
						{},
					);
				} catch (e) {
					return {
						error: e instanceof Error ? e.message : "Query failed",
					};
				}
			},
		}),

		getCrossTenantBlockers: tool({
			description:
				"Find tenants with onboarding blockers: uninvited drafts, pending acceptances, awaiting approvals",
			inputSchema: z.object({}),
			execute: async () => {
				try {
					return await ctx.runQuery(
						internal.assistantQueries.crossTenantBlockers,
						{},
					);
				} catch (e) {
					return {
						error: e instanceof Error ? e.message : "Query failed",
					};
				}
			},
		}),

		getTenantDetail: tool({
			description: "Get detailed pass/member progress for a specific tenant",
			inputSchema: z.object({
				tenantId: z.string().describe("The tenant ID to get details for"),
			}),
			execute: async (args: { tenantId: string }) => {
				try {
					const [progress, blockerData] = await Promise.all([
						ctx.runQuery(internal.assistantQueries.passProgress, {
							tenantId: args.tenantId,
						}),
						ctx.runQuery(internal.assistantQueries.blockers, {
							tenantId: args.tenantId,
						}),
					]);
					return { progress, blockers: blockerData };
				} catch (e) {
					return {
						error: e instanceof Error ? e.message : "Query failed",
					};
				}
			},
		}),

		resolveTenant: tool({
			description:
				"Look up a tenant by name. Returns ALL matches. Use before tenant-specific operations.",
			inputSchema: z.object({
				tenantName: z
					.string()
					.describe("The tenant name to look up (case-insensitive)"),
			}),
			execute: async (args: { tenantName: string }) => {
				try {
					return await ctx.runQuery(internal.assistantQueries.resolveTenant, {
						tenantName: args.tenantName,
					});
				} catch (e) {
					return {
						error: e instanceof Error ? e.message : "Query failed",
					};
				}
			},
		}),

		// --- Vend Admin write tools ---

		proposeCreateTenant: tool({
			description:
				"Propose creating a new tenant with an admin. Creates tenant + admin atomically.",
			inputSchema: z.object({
				companyName: z.string().min(1),
				adminName: z.string().min(1),
				adminEmail: z.string().optional(),
				adminPhone: z.string().optional(),
			}),
			execute: async (args: {
				companyName: string;
				adminName: string;
				adminEmail?: string;
				adminPhone?: string;
			}): Promise<Proposal> => ({
				action: "createTenant",
				intent: {
					companyName: args.companyName,
					adminName: args.adminName,
					adminEmail: args.adminEmail,
					adminPhone: args.adminPhone,
				},
				requiresConfirmation: true,
				summary: `Create tenant "${args.companyName}" with admin ${args.adminName}`,
			}),
		}),

		proposeSetBilling: tool({
			description:
				"Propose setting billing type on a pass. Use getTenantDetail to find passId.",
			inputSchema: z.object({
				passId: z.string(),
				billingType: z.enum(["recurring", "usage_based"]),
			}),
			execute: async (args: {
				passId: string;
				billingType: string;
			}): Promise<Proposal> => ({
				action: "setBilling",
				intent: { passId: args.passId, billingType: args.billingType },
				requiresConfirmation: true,
				summary: `Set billing to ${args.billingType}`,
			}),
		}),

		proposeMockAcceptAll: tool({
			description:
				"DEMO ONLY: Propose transitioning all invited members to accepted in a pass.",
			inputSchema: z.object({
				tenantId: z.string(),
				passId: z.string(),
			}),
			execute: async (args: {
				tenantId: string;
				passId: string;
			}): Promise<Proposal> => ({
				action: "mockAcceptAll",
				intent: { tenantId: args.tenantId, passId: args.passId },
				requiresConfirmation: true,
				summary: "Mock accept all invited members (demo only)",
			}),
		}),

		proposeArchiveTenant: tool({
			description:
				"Propose archiving a tenant. Soft-deactivates the tenant. Use resolveTenant first.",
			inputSchema: z.object({
				tenantId: z.string(),
			}),
			execute: async (args: { tenantId: string }): Promise<Proposal> => ({
				action: "archiveTenant",
				intent: { tenantId: args.tenantId },
				requiresConfirmation: true,
				summary: "Archive this tenant (soft-deactivate)",
			}),
		}),

		proposeResetTenant: tool({
			description:
				"Propose resetting a tenant. Archives ALL passes, members, and invite history. Data is deactivated but NOT permanently deleted. Use resolveTenant first.",
			inputSchema: z.object({
				tenantId: z.string(),
			}),
			execute: async (args: { tenantId: string }): Promise<Proposal> => ({
				action: "resetTenant",
				intent: { tenantId: args.tenantId },
				requiresConfirmation: true,
				summary:
					"Reset this tenant — archive all passes, members, and invite history (NOT permanent delete)",
			}),
		}),
	};
}
