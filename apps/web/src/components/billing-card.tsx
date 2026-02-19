import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface BillingCardProps {
	name: string;
	description: string;
	targetMemberCount: number;
	memberCount: number;
	currentBillingType?: "recurring" | "usage_based";
	onSetBillingType: (type: "recurring" | "usage_based") => void;
	isLoading?: boolean;
}

export function BillingCard({
	name,
	description,
	targetMemberCount,
	memberCount,
	currentBillingType,
	onSetBillingType,
	isLoading,
}: BillingCardProps) {
	const isConfigured = currentBillingType !== undefined;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle>{name}</CardTitle>
						<CardDescription className="mt-0.5">{description}</CardDescription>
					</div>
					{isConfigured ? (
						<span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-green-700 text-xs dark:text-green-400">
							Configured
						</span>
					) : (
						<span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground text-xs">
							Not Configured
						</span>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3">
					<p className="text-muted-foreground text-xs">
						{memberCount}/{targetMemberCount} members
					</p>

					<div className="grid gap-1.5">
						<span className="font-medium text-xs">Billing Type</span>
						<div className="flex gap-1">
							<Button
								variant={
									currentBillingType === "recurring" ? "default" : "ghost"
								}
								size="xs"
							disabled={isLoading || currentBillingType === "recurring"}
							onClick={() => onSetBillingType("recurring")}
						>
							Recurring
						</Button>
						<Button
							variant={
								currentBillingType === "usage_based" ? "default" : "ghost"
							}
							size="xs"
							disabled={isLoading || currentBillingType === "usage_based"}
							onClick={() => onSetBillingType("usage_based")}
							>
								Usage-based
							</Button>
						</div>
					</div>

					<p className="text-muted-foreground text-xs">
						{currentBillingType === "recurring"
							? "Billed as a recurring subscription"
							: currentBillingType === "usage_based"
								? "Billed based on actual usage"
								: "Select a billing type above"}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
