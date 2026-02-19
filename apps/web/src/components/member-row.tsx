import { Button } from "@/components/ui/button";
import { METHOD_LABELS, STATUS_CONFIG } from "@/lib/constants";
import type { InviteMethod, MemberStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

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
			<span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
				{METHOD_LABELS[effectiveMethod]}
			</span>
			<span
				className={cn(
					"inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs",
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
