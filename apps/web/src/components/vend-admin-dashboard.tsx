import { api } from "@onboarding-flow/backend/convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { OnboardingStatusBadge } from "@/components/onboarding-status-badge";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export function VendAdminDashboard() {
	const tenants = useQuery(api.tenants.list);
	const navigate = useNavigate();
	const { setRole, setTenantId } = useAuth();

	if (tenants === undefined) {
		return (
			<div className="mx-auto max-w-5xl p-6">
				<div className="mb-8">
					<h1 className="font-bold text-2xl">Dashboard</h1>
					<p className="mt-1 text-muted-foreground">
						Platform overview across all tenants.
					</p>
				</div>
				<div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Skeleton className="h-24 w-full" />
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

	if (tenants.length === 0) {
		return (
			<div className="mx-auto max-w-5xl p-6">
				<div className="mb-8">
					<h1 className="font-bold text-2xl">Dashboard</h1>
					<p className="mt-1 text-muted-foreground">
						Platform overview across all tenants.
					</p>
				</div>
				<Card>
					<CardContent className="py-8 text-center">
						<p className="text-muted-foreground">
							No tenants yet. Invite tenants from the Tenants page to get
							started.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const totalTenants = tenants.length;
	const completeCount = tenants.filter(
		(t) => t.onboardingStatus === "complete",
	).length;
	const inProgressCount = tenants.filter(
		(t) => t.onboardingStatus === "in_progress",
	).length;
	const notStartedCount = tenants.filter(
		(t) => t.onboardingStatus === "not_started",
	).length;
	const totalMembers = tenants.reduce((s, t) => s + t.totalMembers, 0);
	const totalApproved = tenants.reduce((s, t) => s + t.approvedMembers, 0);
	const totalTarget = tenants.reduce((s, t) => s + t.totalTarget, 0);
	const approvalRate =
		totalTarget > 0 ? Math.round((totalApproved / totalTarget) * 100) : 0;

	type Tenant = NonNullable<typeof tenants>[number];

	function handleTenantAction(
		tenant: Tenant,
		action: "onboarding" | "billing",
	) {
		if (action === "billing") {
			navigate({ to: "/billing" });
		} else {
			setRole("tenant_admin");
			setTenantId(tenant._id);
			navigate({ to: "/onboarding" });
		}
	}

	function getQuickAction(tenant: Tenant) {
		if (tenant.onboardingStatus === "not_started") {
			return {
				label: "Start Onboarding",
				action: () => handleTenantAction(tenant, "onboarding"),
			};
		}
		if (tenant.onboardingStatus === "in_progress") {
			if (tenant.acceptedMembers > 0) {
				return {
					label: `Review ${tenant.acceptedMembers} Approval${tenant.acceptedMembers === 1 ? "" : "s"}`,
					action: () => handleTenantAction(tenant, "onboarding"),
				};
			}
			return {
				label: "Continue Onboarding",
				action: () => handleTenantAction(tenant, "onboarding"),
			};
		}
		if (
			tenant.onboardingStatus === "complete" &&
			tenant.billingConfigured < tenant.passCount
		) {
			return {
				label: "Configure Billing",
				action: () => handleTenantAction(tenant, "billing"),
			};
		}
		return null;
	}

	return (
		<div className="mx-auto max-w-5xl p-6">
			<div className="mb-8">
				<h1 className="font-bold text-2xl">Dashboard</h1>
				<p className="mt-1 text-muted-foreground">
					Platform overview across all tenants.
				</p>
			</div>

			<div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard label="Total Tenants" value={totalTenants} />
				<StatCard
					label="Onboarding Status"
					value={`${completeCount} complete`}
					detail={`${inProgressCount} in progress, ${notStartedCount} not started`}
				/>
				<StatCard
					label="Total Members"
					value={totalMembers}
					detail="across all tenants"
				/>
				<StatCard
					label="Approval Rate"
					value={`${approvalRate}%`}
					detail={
						totalTarget > 0
							? `${totalApproved}/${totalTarget} approved`
							: "Set target counts to track progress"
					}
				/>
			</div>

			<h2 className="mb-4 font-semibold text-lg">Tenant Progress</h2>
			<div className="grid gap-3">
				{tenants.map((tenant) => {
					const progressPercent =
						tenant.totalTarget > 0
							? Math.min(
									100,
									Math.round(
										(tenant.approvedMembers / tenant.totalTarget) * 100,
									),
								)
							: 0;
					const quickAction = getQuickAction(tenant);

					return (
						<Card key={tenant._id}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle>{tenant.companyName}</CardTitle>
									<OnboardingStatusBadge status={tenant.onboardingStatus} />
								</div>
							</CardHeader>
							<CardContent>
								<div className="grid gap-3">
									{/* Progress bar */}
									<div>
										<div className="mb-1 flex items-baseline justify-between text-xs">
											<span className="text-muted-foreground">
												{tenant.approvedMembers}/{tenant.totalTarget} approved
											</span>
											<span className="font-medium">{progressPercent}%</span>
										</div>
										<div className="h-1.5 w-full overflow-hidden bg-muted">
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

									{/* Stats */}
									<div className="flex gap-6 text-muted-foreground text-xs">
										<span>
											{tenant.passCount}{" "}
											{tenant.passCount === 1 ? "pass" : "passes"}
										</span>
										<span>{tenant.totalMembers} total members</span>
									</div>

									{/* Blockers */}
									{tenant.blockers.length > 0 && (
										<p className="text-red-600 text-xs dark:text-red-400">
											{"⚠ "}
											{tenant.blockers.join(", ")}
										</p>
									)}

									{/* Quick action */}
									{quickAction && (
										<div>
											<Button
												size="sm"
												variant="outline"
												onClick={quickAction.action}
											>
												{quickAction.label}
											</Button>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
