import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { BillingCard } from "@/components/billing-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing")({
	component: BillingPage,
});

function BillingPage() {
	const { role } = useAuth();

	if (role !== "vend_admin") {
		return (
			<div className="p-6">
				<p className="text-muted-foreground">
					Only Vend Admins can access this page.
				</p>
			</div>
		);
	}

	return <BillingContent />;
}

function BillingContent() {
	const tenants = useQuery(api.tenants.list);
	const [selectedTenantId, setSelectedTenantId] =
		useState<Id<"tenants"> | null>(null);

	const activeTenantId =
		selectedTenantId ?? (tenants && tenants.length > 0 ? tenants[0]._id : null);

	if (tenants === undefined) {
		return (
			<div className="mx-auto max-w-4xl p-6">
				<div className="mb-8">
					<h1 className="font-bold text-2xl">Billing</h1>
					<p className="mt-1 text-muted-foreground">
						Configure billing type per pass.
					</p>
				</div>
				<div className="grid gap-3">
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-32 w-full" />
				</div>
			</div>
		);
	}

	if (tenants.length === 0) {
		return (
			<div className="mx-auto max-w-4xl p-6">
				<div className="mb-8">
					<h1 className="font-bold text-2xl">Billing</h1>
					<p className="mt-1 text-muted-foreground">
						Configure billing type per pass.
					</p>
				</div>
				<Card>
					<CardContent className="py-8 text-center">
						<p className="text-muted-foreground">
							No tenants yet. Invite tenants from the Tenants page first.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl p-6">
			<div className="mb-8">
				<h1 className="font-bold text-2xl">Billing</h1>
				<p className="mt-1 text-muted-foreground">
					Configure billing type per pass.
				</p>
			</div>

			<div className="mb-6 flex flex-wrap gap-2">
				{tenants.map((t) => (
					<button
						key={t._id}
						type="button"
						onClick={() => setSelectedTenantId(t._id)}
						className={cn(
							"rounded-full border px-3 py-1 text-xs transition-colors",
							activeTenantId === t._id
								? "border-primary bg-primary text-primary-foreground"
								: "border-border bg-muted text-muted-foreground hover:text-foreground",
						)}
					>
						{t.companyName}
					</button>
				))}
			</div>

			{activeTenantId && <TenantBillingSection tenantId={activeTenantId} />}
		</div>
	);
}

function TenantBillingSection({ tenantId }: { tenantId: Id<"tenants"> }) {
	const passes = useQuery(api.passes.listByTenant, { tenantId });
	const updatePass = useMutation(api.passes.update);
	const [loadingPassId, setLoadingPassId] = useState<Id<"passes"> | null>(null);

	if (passes === undefined) {
		return (
			<div className="grid gap-3">
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}

	if (passes.length === 0) {
		return (
			<Card>
				<CardContent className="py-8 text-center">
					<p className="text-muted-foreground">
						This tenant has no passes yet. Passes are created by the Tenant
						Admin in the onboarding wizard.
					</p>
				</CardContent>
			</Card>
		);
	}

	const configuredCount = passes.filter(
		(p) => p.billingType !== undefined,
	).length;
	const totalCount = passes.length;

	async function handleSetBillingType(
		passId: Id<"passes">,
		billingType: "recurring" | "usage_based",
	) {
		setLoadingPassId(passId);
		try {
			const result = await updatePass({ passId, billingType });
			if (result.ok) {
				toast.success(
					`Billing set to ${billingType === "recurring" ? "Recurring" : "Usage-based"}.`,
				);
			} else {
				toast.error(result.message);
			}
		} catch {
			toast.error("Failed to update billing type.");
		} finally {
			setLoadingPassId(null);
		}
	}

	return (
		<div className="grid gap-4">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">Billing Configuration</CardTitle>
						{configuredCount === totalCount && totalCount > 0 && (
							<span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-green-700 text-xs dark:text-green-400">
								All Configured
							</span>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						<span className="font-medium text-foreground">
							{configuredCount}
						</span>{" "}
						of <span className="font-medium text-foreground">{totalCount}</span>{" "}
						passes configured
					</p>
				</CardContent>
			</Card>

			{passes.map((pass) => (
				<BillingCard
					key={pass._id}
					name={pass.name}
					description={pass.description}
					targetMemberCount={pass.targetMemberCount}
					memberCount={pass.memberCount}
					currentBillingType={
						pass.billingType as "recurring" | "usage_based" | undefined
					}
					onSetBillingType={(type) => handleSetBillingType(pass._id, type)}
					isLoading={loadingPassId === pass._id}
				/>
			))}
		</div>
	);
}
