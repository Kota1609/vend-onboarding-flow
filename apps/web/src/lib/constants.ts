import type { InviteMethod, MemberStatus } from "./types";

export const STATUS_CONFIG: Record<
	MemberStatus,
	{ label: string; className: string }
> = {
	draft: {
		label: "Draft",
		className: "bg-muted text-muted-foreground border-border",
	},
	invited: {
		label: "Invited",
		className:
			"bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
	},
	accepted: {
		label: "Accepted",
		className:
			"bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
	},
	approved: {
		label: "Approved",
		className:
			"bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
	},
	rejected: {
		label: "Rejected",
		className: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
	},
};

export const METHOD_LABELS: Record<InviteMethod, string> = {
	email: "Email",
	phone: "Phone",
	access_code: "Access Code",
};

export function formatRelativeTime(timestamp: number): string {
	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
