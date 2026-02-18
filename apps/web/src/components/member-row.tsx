import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MemberStatus = "draft" | "invited" | "accepted" | "approved" | "rejected";
type InviteMethod = "email" | "phone" | "access_code";

const STATUS_CONFIG: Record<
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

const METHOD_LABELS: Record<InviteMethod, string> = {
	email: "Email",
	phone: "Phone",
	access_code: "Access Code",
};

export interface MemberRowProps {
	name: string;
	email?: string;
	phone?: string;
	status: MemberStatus;
	effectiveMethod: InviteMethod;
	onEdit?: () => void;
	onDelete?: () => void;
}

export function MemberRow({
	name,
	email,
	phone,
	status,
	effectiveMethod,
	onEdit,
	onDelete,
}: MemberRowProps) {
	const statusConfig = STATUS_CONFIG[status];
	const contact = email || phone || "No contact";
	const isDraft = status === "draft";

	return (
		<div className="flex items-center gap-3 border-b px-2 py-2 last:border-b-0">
			<span className="min-w-0 flex-1 truncate font-medium text-sm">
				{name}
			</span>
			<span className="hidden min-w-0 truncate text-muted-foreground text-sm sm:block">
				{contact}
			</span>
			<span className="inline-flex items-center border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-xs text-yellow-700 dark:text-yellow-400">
				{METHOD_LABELS[effectiveMethod]}
			</span>
			<span
				className={cn(
					"inline-flex items-center border px-1.5 py-0.5 text-xs",
					statusConfig.className,
				)}
			>
				{statusConfig.label}
			</span>
			{isDraft && (
				<div className="flex gap-1">
					{onEdit && (
						<Button variant="ghost" size="xs" onClick={onEdit}>
							Edit
						</Button>
					)}
					{onDelete && (
						<Button
							variant="ghost"
							size="xs"
							onClick={onDelete}
							className="text-destructive"
						>
							Delete
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
