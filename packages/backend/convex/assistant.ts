"use node";

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { buildTenantAdminTools, buildVendAdminTools } from "./lib/copilotTools";
import {
	COPILOT_SYSTEM_PROMPT,
	STEP_CONTEXT,
	VEND_ADMIN_COPILOT_PROMPT,
} from "./lib/prompts";

function getModel() {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
	const anthropic = createAnthropic({ apiKey });
	return anthropic("claude-sonnet-4-20250514");
}

type ToolCallResult = { toolName: string; result: unknown };
type ToolResultEntry = { toolName: string; output: unknown };

type SendResult =
	| { ok: true; text: string; toolCalls: ToolCallResult[] }
	| { ok: false; code: string; message: string };

export const sendMessage = action({
	args: {
		prompt: v.string(),
		role: v.union(v.literal("tenant_admin"), v.literal("vend_admin")),
		tenantId: v.optional(v.string()),
		currentStep: v.optional(v.number()),
		history: v.optional(
			v.array(v.object({ role: v.string(), content: v.string() })),
		),
	},
	handler: async (ctx, args): Promise<SendResult> => {
		if (!process.env.ANTHROPIC_API_KEY) {
			return {
				ok: false,
				code: "NO_API_KEY",
				message:
					"AI features require an API key. Please configure ANTHROPIC_API_KEY in the Convex dashboard.",
			};
		}

		const startMs = Date.now();
		const isVendAdmin = args.role === "vend_admin";
		const rateLimitKey = args.tenantId ?? "__vend_admin__";

		// --- Rate limiting: max 30 requests/hour ---
		const recentCount = await ctx.runQuery(
			internal.assistantQueries.recentCopilotRequestCount,
			{ tenantId: rateLimitKey, windowMs: 3600_000 },
		);
		if (recentCount >= 30) {
			return {
				ok: false,
				code: "RATE_LIMITED",
				message: "Too many requests. Please wait a few minutes.",
			};
		}

		// --- State injection: pre-query ambient context ---
		let systemPrompt: string;
		if (isVendAdmin) {
			const [allProgress, allBlockers] = await Promise.all([
				ctx.runQuery(internal.assistantQueries.allTenantsProgress, {}),
				ctx.runQuery(internal.assistantQueries.crossTenantBlockers, {}),
			]);
			const stateContext = `
Current platform state (pre-loaded — do NOT re-query unless user asks for more detail):
- All tenants progress: ${JSON.stringify(allProgress)}
- Tenants with blockers: ${JSON.stringify(allBlockers)}`;
			systemPrompt = `${VEND_ADMIN_COPILOT_PROMPT}\n${stateContext}`;
		} else {
			// tenantId is guaranteed set here (isVendAdmin === false)
			const tid = args.tenantId as string;
			const [progress, blockerData] = await Promise.all([
				ctx.runQuery(internal.assistantQueries.passProgress, {
					tenantId: tid,
				}),
				ctx.runQuery(internal.assistantQueries.blockers, {
					tenantId: tid,
				}),
			]);
			const stateContext = `
Current onboarding state (pre-loaded — do NOT re-query unless user asks for more detail):
- Pass progress: ${JSON.stringify(progress)}
- Blockers: ${JSON.stringify(blockerData)}`;
			const stepContext = STEP_CONTEXT[args.currentStep ?? -1] ?? "";
			systemPrompt = `${COPILOT_SYSTEM_PROMPT}\n\n${stepContext}\n${stateContext}`;
		}

		// --- Build messages array with conversation memory ---
		const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
		if (args.history) {
			for (const msg of args.history.slice(-10)) {
				if (msg.role === "user" || msg.role === "assistant") {
					messages.push({ role: msg.role, content: msg.content });
				}
			}
		}
		messages.push({ role: "user", content: args.prompt });

		// --- Tool calling with stepCountIs ---
		const tools = isVendAdmin
			? buildVendAdminTools(ctx)
			: buildTenantAdminTools(ctx, args.tenantId as string, args.currentStep);

		const result = await generateText({
			model: getModel(),
			system: systemPrompt,
			messages,
			tools,
			stopWhen: stepCountIs(5),
		});

		// --- Handle step cap: fallback if text is empty ---
		let text = result.text;
		const toolResults: ToolResultEntry[] = result.steps.flatMap((s) =>
			s.toolResults.map((tr) => ({
				toolName: tr.toolName,
				output: tr.output,
			})),
		);

		// Map to frontend-expected format (toolName + result)
		const toolCalls: ToolCallResult[] = toolResults.map((tr) => ({
			toolName: tr.toolName,
			result: tr.output,
		}));

		if (!text && toolCalls.length > 0) {
			text =
				"I gathered some data but couldn't form a complete answer. Here's what I found — try asking a more specific question.";
		}

		// --- Observability: log to copilotLog table ---
		const durationMs = Date.now() - startMs;
		await ctx.runMutation(internal.copilotLog.logRequest, {
			tenantId: rateLimitKey,
			role: isVendAdmin ? "vend_admin" : "tenant_admin",
			prompt: args.prompt,
			toolNames: toolCalls.map((tc) => tc.toolName),
			responseLength: text.length,
			durationMs,
		});

		return { ok: true, text, toolCalls };
	},
});

// --- Backend proposal execution (not frontend switch) ---

type ExecuteResult =
	| { ok: true; message: string }
	| { ok: false; message: string };

// Role gating: action → allowed roles
const TENANT_ADMIN_ACTIONS = [
	"createPass",
	"editPass",
	"deletePass",
	"addMember",
	"addBulkMembers",
	"deleteMember",
	"deleteBulkMembers",
	"sendBulkInvites",
	"sendSingleInvite",
	"resendInvite",
	"changeMethod",
	"approveSingle",
	"approveAll",
	"rejectMember",
];

const VEND_ADMIN_ACTIONS = [
	"createTenant",
	"setBilling",
	"mockAcceptAll",
	"archiveTenant",
	"resetTenant",
];

export const executeProposal = action({
	args: {
		proposalAction: v.string(),
		role: v.union(v.literal("tenant_admin"), v.literal("vend_admin")),
		intent: v.object({
			tenantId: v.optional(v.string()),
			name: v.optional(v.string()),
			description: v.optional(v.string()),
			targetMemberCount: v.optional(v.number()),
			passId: v.optional(v.string()),
			status: v.optional(v.string()),
			memberId: v.optional(v.string()),
			email: v.optional(v.string()),
			phone: v.optional(v.string()),
			method: v.optional(v.string()),
			billingType: v.optional(v.string()),
			companyName: v.optional(v.string()),
			adminName: v.optional(v.string()),
			adminEmail: v.optional(v.string()),
			adminPhone: v.optional(v.string()),
			members: v.optional(
				v.array(
					v.object({
						name: v.string(),
						email: v.optional(v.string()),
						phone: v.optional(v.string()),
					}),
				),
			),
			memberIds: v.optional(v.array(v.string())),
		}),
	},
	handler: async (ctx, args): Promise<ExecuteResult> => {
		const { proposalAction, intent } = args;

		// --- Role gating ---
		if (
			TENANT_ADMIN_ACTIONS.includes(proposalAction) &&
			args.role !== "tenant_admin"
		) {
			return {
				ok: false,
				message: "This action is only available to tenant admins.",
			};
		}
		if (
			VEND_ADMIN_ACTIONS.includes(proposalAction) &&
			args.role !== "vend_admin"
		) {
			return {
				ok: false,
				message: "This action is only available to Vend admins.",
			};
		}

		// --- Helper: validate passId exists ---
		async function validatePass(passId: string): Promise<string | null> {
			const exists = await ctx.runQuery(internal.assistantQueries.passExists, {
				passId,
			});
			if (!exists)
				return "This pass no longer exists. It may have been deleted.";
			return null;
		}

		// =====================
		// TENANT ADMIN ACTIONS
		// =====================

		// --- Create Pass ---
		if (proposalAction === "createPass") {
			if (!intent.tenantId || !intent.name || !intent.description) {
				return {
					ok: false,
					message: "Missing required fields for pass creation.",
				};
			}
			await ctx.runMutation(internal.passes.createInternal, {
				tenantId: intent.tenantId as Id<"tenants">,
				name: intent.name,
				description: intent.description,
				targetMemberCount: intent.targetMemberCount ?? 10,
			});
			return { ok: true, message: `Created pass "${intent.name}"` };
		}

		// --- Edit Pass ---
		if (proposalAction === "editPass") {
			if (!intent.passId) {
				return { ok: false, message: "Missing passId for editing pass." };
			}
			const passErr = await validatePass(intent.passId);
			if (passErr) return { ok: false, message: passErr };

			const result = await ctx.runMutation(internal.passes.updateInternal, {
				passId: intent.passId as Id<"passes">,
				name: intent.name,
				description: intent.description,
				targetMemberCount: intent.targetMemberCount,
			});
			if (!result.ok) return { ok: false, message: result.message };
			return { ok: true, message: "Pass updated" };
		}

		// --- Delete Pass ---
		if (proposalAction === "deletePass") {
			if (!intent.passId) {
				return { ok: false, message: "Missing passId for deleting pass." };
			}
			const passErr = await validatePass(intent.passId);
			if (passErr) return { ok: false, message: passErr };

			const result = await ctx.runMutation(internal.passes.removeInternal, {
				passId: intent.passId as Id<"passes">,
			});
			if (!result.ok) return { ok: false, message: result.message };
			return { ok: true, message: "Pass deleted" };
		}

		// --- Add Member ---
		if (proposalAction === "addMember") {
			if (!intent.tenantId || !intent.passId || !intent.name) {
				return {
					ok: false,
					message: "Missing required fields for adding member.",
				};
			}
			const passErr = await validatePass(intent.passId);
			if (passErr) return { ok: false, message: passErr };

			await ctx.runMutation(internal.members.createInternal, {
				tenantId: intent.tenantId as Id<"tenants">,
				passId: intent.passId as Id<"passes">,
				name: intent.name,
				email: intent.email,
				phone: intent.phone,
			});
			return { ok: true, message: `Added "${intent.name}"` };
		}

		// --- Add Bulk Members ---
		if (proposalAction === "addBulkMembers") {
			if (!intent.tenantId || !intent.passId || !intent.members) {
				return {
					ok: false,
					message: "Missing required fields for bulk member creation.",
				};
			}
			const passErr = await validatePass(intent.passId);
			if (passErr) return { ok: false, message: passErr };

			const result = await ctx.runMutation(
				internal.members.createBulkInternal,
				{
					tenantId: intent.tenantId as Id<"tenants">,
					passId: intent.passId as Id<"passes">,
					members: intent.members,
				},
			);
			if (!result.ok) {
				const errorList = result.errors
					.map(
						(e: { index: number; message: string }) =>
							`Row ${e.index + 1}: ${e.message}`,
					)
					.join("; ");
				return {
					ok: false,
					message: `Validation failed — no members were added. ${errorList}`,
				};
			}
			return { ok: true, message: `Added ${result.created} members` };
		}

		// --- Delete Member ---
		if (proposalAction === "deleteMember") {
			if (!intent.memberId) {
				return { ok: false, message: "Missing memberId for deletion." };
			}
			const result = await ctx.runMutation(internal.members.removeInternal, {
				memberId: intent.memberId as Id<"members">,
			});
			if (!result.ok) return { ok: false, message: result.message };
			return { ok: true, message: "Member deleted" };
		}

		// --- Delete Bulk Members ---
		if (proposalAction === "deleteBulkMembers") {
			if (!intent.memberIds || intent.memberIds.length === 0) {
				return {
					ok: false,
					message: "Missing member IDs for bulk deletion.",
				};
			}
			const result = await ctx.runMutation(
				internal.members.removeBulkInternal,
				{
					memberIds: intent.memberIds.map((id) => id as Id<"members">),
				},
			);
			const msg = `Deleted ${result.deleted} members`;
			if (result.skipped.length > 0) {
				const skippedNames = result.skipped
					.map((s) => `${s.name} (${s.status})`)
					.join(", ");
				return {
					ok: true,
					message: `${msg}. Skipped ${result.skipped.length}: ${skippedNames}`,
				};
			}
			return { ok: true, message: msg };
		}

		// --- Send Bulk Invites ---
		if (proposalAction === "sendBulkInvites") {
			if (!intent.tenantId || !intent.passId) {
				return {
					ok: false,
					message: "Missing pass information for sending invites.",
				};
			}
			const passErr = await validatePass(intent.passId);
			if (passErr) return { ok: false, message: passErr };

			const memberIds = await ctx.runQuery(
				internal.assistantQueries.memberIdsByStatus,
				{
					tenantId: intent.tenantId,
					passId: intent.passId,
					status: "draft",
				},
			);
			if (memberIds.length === 0) {
				return {
					ok: false,
					message:
						"No draft members found — they may have already been invited.",
				};
			}
			const result = await ctx.runMutation(
				internal.members.sendBulkInvitesInternal,
				{ memberIds },
			);
			return {
				ok: true,
				message: `Sent ${result.succeeded} invites${result.skipped > 0 ? ` (${result.skipped} skipped)` : ""}`,
			};
		}

		// --- Send Single Invite ---
		if (proposalAction === "sendSingleInvite") {
			if (!intent.memberId) {
				return { ok: false, message: "Missing memberId for sending invite." };
			}
			const result = await ctx.runMutation(
				internal.members.sendInviteInternal,
				{ memberId: intent.memberId as Id<"members"> },
			);
			if (!result.ok) return { ok: false, message: result.message };
			return { ok: true, message: "Invite sent" };
		}

		// --- Resend Invite ---
		if (proposalAction === "resendInvite") {
			if (!intent.memberId) {
				return { ok: false, message: "Missing memberId for resending invite." };
			}
			const result = await ctx.runMutation(internal.members.resendInternal, {
				memberId: intent.memberId as Id<"members">,
			});
			if (!result.ok) return { ok: false, message: result.message };
			return { ok: true, message: "Invite resent" };
		}

		// --- Change Invite Method ---
		if (proposalAction === "changeMethod") {
			if (!intent.memberId || !intent.method) {
				return {
					ok: false,
					message: "Missing memberId or method for changing invite method.",
				};
			}
			const result = await ctx.runMutation(
				internal.members.changeMethodInternal,
				{
					memberId: intent.memberId as Id<"members">,
					method: intent.method as "email" | "phone" | "access_code",
				},
			);
			if (!result.ok) return { ok: false, message: result.message };
			return {
				ok: true,
				message: `Invite method changed to ${intent.method}`,
			};
		}

		// --- Approve Single ---
		if (proposalAction === "approveSingle") {
			if (!intent.memberId) {
				return { ok: false, message: "Missing memberId for approval." };
			}
			await ctx.runMutation(internal.members.approveInternal, {
				memberId: intent.memberId as Id<"members">,
			});
			return { ok: true, message: "Member approved" };
		}

		// --- Approve All ---
		if (proposalAction === "approveAll") {
			if (!intent.tenantId || !intent.passId) {
				return {
					ok: false,
					message: "Missing pass information for approving members.",
				};
			}
			const passErr = await validatePass(intent.passId);
			if (passErr) return { ok: false, message: passErr };

			const memberIds = await ctx.runQuery(
				internal.assistantQueries.memberIdsByStatus,
				{
					tenantId: intent.tenantId,
					passId: intent.passId,
					status: "accepted",
				},
			);
			if (memberIds.length === 0) {
				return {
					ok: false,
					message:
						"No accepted members found — they may have already been approved.",
				};
			}
			for (const id of memberIds) {
				await ctx.runMutation(internal.members.approveInternal, {
					memberId: id,
				});
			}
			return {
				ok: true,
				message: `Approved ${memberIds.length} members`,
			};
		}

		// --- Reject Member ---
		if (proposalAction === "rejectMember") {
			if (!intent.memberId) {
				return { ok: false, message: "Missing memberId for rejection." };
			}
			const result = await ctx.runMutation(internal.members.rejectInternal, {
				memberId: intent.memberId as Id<"members">,
			});
			if (!result.ok) return { ok: false, message: result.message };
			return { ok: true, message: "Member rejected" };
		}

		// =====================
		// VEND ADMIN ACTIONS
		// =====================

		// --- Create Tenant ---
		if (proposalAction === "createTenant") {
			if (!intent.companyName || !intent.adminName) {
				return {
					ok: false,
					message: "Missing company name or admin name for tenant creation.",
				};
			}
			await ctx.runMutation(internal.tenants.createInternal, {
				companyName: intent.companyName,
				adminName: intent.adminName,
				adminEmail: intent.adminEmail,
				adminPhone: intent.adminPhone,
			});
			return {
				ok: true,
				message: `Created tenant "${intent.companyName}" with admin ${intent.adminName}`,
			};
		}

		// --- Set Billing ---
		if (proposalAction === "setBilling") {
			if (!intent.passId || !intent.billingType) {
				return {
					ok: false,
					message: "Missing passId or billing type.",
				};
			}
			const passErr = await validatePass(intent.passId);
			if (passErr) return { ok: false, message: passErr };

			const result = await ctx.runMutation(internal.passes.updateInternal, {
				passId: intent.passId as Id<"passes">,
				billingType: intent.billingType as "recurring" | "usage_based",
			});
			if (!result.ok) return { ok: false, message: result.message };
			return {
				ok: true,
				message: `Billing set to ${intent.billingType}`,
			};
		}

		// --- Mock Accept All (Demo) ---
		if (proposalAction === "mockAcceptAll") {
			if (!intent.tenantId || !intent.passId) {
				return {
					ok: false,
					message: "Missing tenant or pass for mock accept.",
				};
			}
			const passErr = await validatePass(intent.passId);
			if (passErr) return { ok: false, message: passErr };

			const result = await ctx.runMutation(
				internal.members.acceptBulkInternal,
				{
					tenantId: intent.tenantId as Id<"tenants">,
					passId: intent.passId as Id<"passes">,
				},
			);
			return {
				ok: true,
				message: `Mock accepted ${result.accepted} members${result.skipped > 0 ? ` (${result.skipped} skipped)` : ""}`,
			};
		}

		// --- Archive Tenant ---
		if (proposalAction === "archiveTenant") {
			if (!intent.tenantId) {
				return { ok: false, message: "Missing tenantId for archiving." };
			}
			const result = await ctx.runMutation(internal.tenants.archiveInternal, {
				tenantId: intent.tenantId as Id<"tenants">,
			});
			if (!result.ok) return { ok: false, message: result.message };
			const msg = result.warning
				? `Tenant archived. ${result.warning}`
				: "Tenant archived";
			return { ok: true, message: msg };
		}

		// --- Reset Tenant ---
		if (proposalAction === "resetTenant") {
			if (!intent.tenantId) {
				return { ok: false, message: "Missing tenantId for reset." };
			}
			const result = await ctx.runMutation(internal.tenants.resetInternal, {
				tenantId: intent.tenantId as Id<"tenants">,
			});
			if (!result.ok) return { ok: false, message: result.message };
			return {
				ok: true,
				message: `Tenant reset — archived ${result.passesArchived} passes, ${result.membersArchived} members, deleted ${result.invitesDeleted} invite records`,
			};
		}

		return { ok: false, message: `Unknown action: ${proposalAction}` };
	},
});
