import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatusBreakdown {
	draft: number;
	invited: number;
	accepted: number;
	approved: number;
	rejected: number;
}

const BILLING_LABELS: Record<string, string> = {
	recurring: "Recurring",
	usage_based: "Usage-based",
};

export interface PassCardProps {
	name: string;
	description: string;
	targetMemberCount: number;
	memberCount: number;
	statusBreakdown: StatusBreakdown;
	billingType?: "recurring" | "usage_based";
	onEdit?: () => void;
	onDelete?: () => void;
}

export function PassCard({
	name,
	description,
	targetMemberCount,
	memberCount,
	statusBreakdown,
	billingType,
	onEdit,
	onDelete,
}: PassCardProps) {
	const progressPercent =
		targetMemberCount > 0
			? Math.min(
					100,
					Math.round((statusBreakdown.approved / targetMemberCount) * 100),
				)
			: 0;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle>{name}</CardTitle>
						<CardDescription className="mt-0.5">{description}</CardDescription>
					</div>
					<div className="flex gap-1">
						{onEdit && (
							<Button variant="ghost" size="xs" onClick={onEdit}>
								Edit
							</Button>
						)}
						{onDelete && memberCount === 0 && (
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
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3">
					{/* Progress bar */}
					<div>
						<div className="mb-1 flex items-baseline justify-between text-xs">
							<span className="text-muted-foreground">
								{statusBreakdown.approved}/{targetMemberCount} approved
							</span>
							<span className="font-medium">{progressPercent}%</span>
						</div>
						<div className="h-1.5 w-full overflow-hidden bg-muted">
							<div
								className={cn(
									"h-full transition-all",
									progressPercent === 100 ? "bg-green-500" : "bg-primary",
								)}
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
					</div>

					{/* Status breakdown */}
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
						<span>{memberCount} total</span>
						{statusBreakdown.draft > 0 && (
							<span>{statusBreakdown.draft} draft</span>
						)}
						{statusBreakdown.invited > 0 && (
							<span>{statusBreakdown.invited} invited</span>
						)}
						{statusBreakdown.accepted > 0 && (
							<span>{statusBreakdown.accepted} pending approval</span>
						)}
						{statusBreakdown.rejected > 0 && (
							<span>{statusBreakdown.rejected} rejected</span>
						)}
						{billingType && (
							<span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-700 dark:text-blue-400">
								{BILLING_LABELS[billingType]}
							</span>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
