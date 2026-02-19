import type {
	billingType,
	inviteMethod,
	memberStatus,
} from "@onboarding-flow/backend/convex/schema";
import type { Infer } from "convex/values";

export type MemberStatus = Infer<typeof memberStatus>;
export type InviteMethod = Infer<typeof inviteMethod>;
export type BillingType = Infer<typeof billingType>;
