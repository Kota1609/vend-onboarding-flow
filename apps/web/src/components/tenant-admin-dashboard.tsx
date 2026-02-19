import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { PipelineFlow } from "@/components/pipeline-flow";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TenantAdminDashboard({
	tenantId,
}: {
	tenantId: Id<"tenants">;
}) {
	const passes = useQuery(api.passes.listByTenant, { tenantId });

	if (passes === undefined) {
		return (
			<div className="mx-auto max-w-5xl p-6">
				<div className="mb-8">
					<h1 className="font-bold text-2xl">Dashboard</h1>
					<p className="mt-1 text-muted-foreground">
						Your onboarding overview.
					</p>
				</div>
				<div className="mb-8 grid gap-4 sm:grid-cols-3">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
				<div className="grid gap-3">
					<Skeleton className="h-28 w-full" />
					<Skeleton className="h-28 w-full" />
				</div>
			</div>
		);
	}

	if (passes.length === 0) {
		return (
			<div className="mx-auto max-w-5xl p-6">
				<div className="mb-8">
					<h1 className="font-bold text-2xl">Dashboard</h1>
					<p className="mt-1 text-muted-foreground">
						Your onboarding overview.
					</p>
				</div>
				<Card>
					<CardContent className="py-8 text-center">
						<p className="text-muted-foreground">
							No passes yet.{" "}
							<Link
								to="/onboarding"
								search={{ step: 0 }}
								className="underline hover:text-foreground"
							>
								Go to Onboarding
							</Link>{" "}
							to create your first pass.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const totalMembers = passes.reduce((s, p) => s + p.memberCount, 0);
	const totalApproved = passes.reduce(
		(s, p) => s + p.statusBreakdown.approved,
		0,
	);
	const totalTarget = passes.reduce((s, p) => s + p.targetMemberCount, 0);
	const approvalPercent =
		totalTarget > 0 ? Math.round((totalApproved / totalTarget) * 100) : 0;

	const totalDraft = passes.reduce((s, p) => s + p.statusBreakdown.draft, 0);
	const totalInvited = passes.reduce(
		(s, p) => s + p.statusBreakdown.invited,
		0,
	);
	const totalAccepted = passes.reduce(
		(s, p) => s + p.statusBreakdown.accepted,
		0,
	);
	const totalRejected = passes.reduce(
		(s, p) => s + p.statusBreakdown.rejected,
		0,
	);
	const passesNeedingMembers = passes.filter((p) => p.memberCount === 0).length;

	const pendingActions: {
		label: string;
		to: string;
		search: { step: number };
	}[] = [];
	if (totalAccepted > 0) {
		pendingActions.push({
			label: `${totalAccepted} member${totalAccepted === 1 ? "" : "s"} need your approval`,
			to: "/onboarding",
			search: { step: 3 },
		});
	}
	if (totalDraft > 0) {
		pendingActions.push({
			label: `${totalDraft} invite${totalDraft === 1 ? "" : "s"} ready to send`,
			to: "/onboarding",
			search: { step: 2 },
		});
	}
	if (passesNeedingMembers > 0) {
		pendingActions.push({
			label: `${passesNeedingMembers} pass${passesNeedingMembers === 1 ? "" : "es"} need members`,
			to: "/onboarding",
			search: { step: 1 },
		});
	}

	return (
		<div className="mx-auto max-w-5xl p-6">
			<div className="mb-8">
				<h1 className="font-bold text-2xl">Dashboard</h1>
				<p className="mt-1 text-muted-foreground">Your onboarding overview.</p>
			</div>

			<div className="mb-8 grid gap-4 sm:grid-cols-3">
				<StatCard label="Passes" value={passes.length} />
				<StatCard label="Total Members" value={totalMembers} />
				<StatCard
					label="Approval Progress"
					value={`${approvalPercent}%`}
					detail={`${totalApproved}/${totalTarget} approved`}
				/>
			</div>

			{/* Pending Actions */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle>What to do next</CardTitle>
				</CardHeader>
				<CardContent>
					{pendingActions.length > 0 ? (
						<ul className="grid gap-2">
							{pendingActions.map((item) => (
								<li key={item.label}>
									<Link
										to={item.to}
										search={item.search}
										className="text-sm underline hover:text-foreground"
									>
										{item.label}
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p className="text-green-600 text-sm dark:text-green-400">
							All caught up!
						</p>
					)}
				</CardContent>
			</Card>

			{/* Member Pipeline */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle>Member Pipeline</CardTitle>
				</CardHeader>
				<CardContent>
					<PipelineFlow
						draft={totalDraft}
						invited={totalInvited}
						accepted={totalAccepted}
						approved={totalApproved}
						rejected={totalRejected}
					/>
				</CardContent>
			</Card>

			{/* Pass Progress */}
			<h2 className="mb-4 font-semibold text-lg">Pass Progress</h2>
			<div className="grid gap-3">
				{passes.map((pass) => {
					const progressPercent =
						pass.targetMemberCount > 0
							? Math.min(
									100,
									Math.round(
										(pass.statusBreakdown.approved / pass.targetMemberCount) *
											100,
									),
								)
							: 0;

					return (
						<Card key={pass._id}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle>{pass.name}</CardTitle>
									<span
										className={cn(
											"inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-xs",
											progressPercent === 100
												? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
												: "border-border bg-muted text-muted-foreground",
										)}
									>
										{pass.statusBreakdown.approved}/{pass.targetMemberCount}
									</span>
								</div>
							</CardHeader>
							<CardContent>
								<div className="grid gap-3">
									<div>
										<div className="mb-1 flex items-baseline justify-between text-xs">
											<span className="text-muted-foreground">
												{pass.statusBreakdown.approved}/{pass.targetMemberCount}{" "}
												approved
											</span>
											<span className="font-medium">{progressPercent}%</span>
										</div>
										<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
											<div
												className={cn(
													"h-full transition-all",
													progressPercent === 100
														? "bg-green-500"
														: "bg-primary",
												)}
												style={{ width: `${progressPercent}%` }}
											/>
										</div>
									</div>
									<div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
										<span>{pass.memberCount} total</span>
										{pass.statusBreakdown.draft > 0 && (
											<span>{pass.statusBreakdown.draft} draft</span>
										)}
										{pass.statusBreakdown.invited > 0 && (
											<span>{pass.statusBreakdown.invited} invited</span>
										)}
										{pass.statusBreakdown.accepted > 0 && (
											<span>
												{pass.statusBreakdown.accepted} pending approval
											</span>
										)}
										{pass.statusBreakdown.rejected > 0 && (
											<span>{pass.statusBreakdown.rejected} rejected</span>
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
