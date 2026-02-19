import { cn } from "@/lib/utils";

export type OnboardingStatus = "not_started" | "in_progress" | "complete";

const statusConfig: Record<
	OnboardingStatus,
	{ label: string; className: string }
> = {
	not_started: {
		label: "Not Started",
		className: "bg-muted text-muted-foreground border-border",
	},
	in_progress: {
		label: "In Progress",
		className:
			"bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
	},
	complete: {
		label: "Complete",
		className:
			"bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
	},
};

interface OnboardingStatusBadgeProps {
	status: OnboardingStatus;
	className?: string;
}

export function OnboardingStatusBadge({
	status,
	className,
}: OnboardingStatusBadgeProps) {
	const config = statusConfig[status];

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-xs",
				config.className,
				className,
			)}
		>
			{config.label}
		</span>
	);
}
