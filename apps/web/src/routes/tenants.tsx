import { api } from "@onboarding-flow/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { OnboardingStatusBadge } from "@/components/onboarding-status-badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/tenants")({
	component: TenantsPage,
});

function TenantsPage() {
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

	return (
		<div className="mx-auto max-w-4xl p-6">
			<div className="mb-8">
				<h1 className="font-bold text-2xl">Tenants</h1>
				<p className="mt-1 text-muted-foreground">
					Invite and manage tenant onboarding.
				</p>
			</div>
			<div className="grid gap-8">
				<TenantInviteForm />
				<TenantList />
			</div>
		</div>
	);
}

function TenantInviteForm() {
	const createTenant = useMutation(api.tenants.create);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsSubmitting(true);

		const form = e.currentTarget;
		const formData = new FormData(form);

		const companyName = formData.get("companyName") as string;
		const adminName = formData.get("adminName") as string;
		const adminEmail = (formData.get("adminEmail") as string) || undefined;
		const adminPhone = (formData.get("adminPhone") as string) || undefined;

		if (!companyName || !adminName) {
			toast.error("Company name and admin name are required.");
			setIsSubmitting(false);
			return;
		}

		try {
			await createTenant({ companyName, adminName, adminEmail, adminPhone });
			toast.success(`Invited ${companyName} successfully.`);
			form.reset();
		} catch {
			toast.error("Failed to create tenant.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Invite Tenant</CardTitle>
				<CardDescription>
					Create a new tenant and send a mock invite to their admin.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-1.5">
						<Label htmlFor="companyName">Company Name *</Label>
						<Input
							id="companyName"
							name="companyName"
							placeholder="Acme Corp"
							required
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="adminName">Admin Name *</Label>
						<Input
							id="adminName"
							name="adminName"
							placeholder="Sarah Chen"
							required
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="adminEmail">Admin Email</Label>
						<Input
							id="adminEmail"
							name="adminEmail"
							type="email"
							placeholder="sarah@acme.com"
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="adminPhone">Admin Phone</Label>
						<Input
							id="adminPhone"
							name="adminPhone"
							type="tel"
							placeholder="+1-555-0101"
						/>
					</div>
					<div className="sm:col-span-2">
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Inviting..." : "Send Invite"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function TenantList() {
	const tenants = useQuery(api.tenants.list);
	const { setRole, setTenantId } = useAuth();
	const navigate = useNavigate();

	if (tenants === undefined) {
		return (
			<div className="grid gap-3">
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-20 w-full" />
			</div>
		);
	}

	if (tenants.length === 0) {
		return (
			<Card>
				<CardContent className="py-8 text-center">
					<p className="text-muted-foreground">
						No tenants yet. Invite one above.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid gap-3">
			{tenants.map((tenant) => (
				<Card
					key={tenant._id}
					className="cursor-pointer transition-colors hover:bg-muted/50"
					onClick={() => {
						setRole("tenant_admin");
						setTenantId(tenant._id);
						navigate({ to: "/onboarding" });
					}}
				>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>{tenant.companyName}</CardTitle>
								{tenant.admin && (
									<CardDescription className="mt-0.5">
										{tenant.admin.name}
										{tenant.admin.email && ` — ${tenant.admin.email}`}
									</CardDescription>
								)}
							</div>
							<OnboardingStatusBadge status={tenant.onboardingStatus} />
						</div>
					</CardHeader>
					<CardContent>
						<div className="flex gap-6 text-muted-foreground text-xs">
							<span>
								{tenant.passCount} {tenant.passCount === 1 ? "pass" : "passes"}
							</span>
							<span>
								{tenant.approvedMembers}/{tenant.totalTarget} approved
							</span>
							<span>{tenant.totalMembers} total members</span>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
