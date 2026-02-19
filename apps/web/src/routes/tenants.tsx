import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@onboarding-flow/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useForm } from "react-hook-form";
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
import {
	type TenantInviteInput,
	type TenantInviteValues,
	tenantInviteSchema,
} from "@/lib/schemas";

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

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<TenantInviteInput, unknown, TenantInviteValues>({
		resolver: zodResolver(tenantInviteSchema),
		defaultValues: {
			companyName: "",
			adminName: "",
			adminEmail: "",
			adminPhone: "",
		},
	});

	async function onValid(values: TenantInviteValues) {
		try {
			await createTenant(values);
			toast.success(`Invited ${values.companyName} successfully.`);
			reset();
		} catch {
			toast.error("Failed to create tenant.");
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
				<form
					onSubmit={handleSubmit(onValid)}
					className="grid gap-4 sm:grid-cols-2"
				>
					<div className="grid gap-1.5">
						<Label htmlFor="companyName">Company Name *</Label>
						<Input
							id="companyName"
							placeholder="Acme Corp"
							{...register("companyName")}
						/>
						{errors.companyName && (
							<p className="text-destructive text-xs">
								{errors.companyName.message}
							</p>
						)}
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="adminName">Admin Name *</Label>
						<Input
							id="adminName"
							placeholder="Sarah Chen"
							{...register("adminName")}
						/>
						{errors.adminName && (
							<p className="text-destructive text-xs">
								{errors.adminName.message}
							</p>
						)}
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="adminEmail">Admin Email</Label>
						<Input
							id="adminEmail"
							type="email"
							placeholder="sarah@acme.com"
							{...register("adminEmail")}
						/>
						{errors.adminEmail && (
							<p className="text-destructive text-xs">
								{errors.adminEmail.message}
							</p>
						)}
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="adminPhone">Admin Phone</Label>
						<Input
							id="adminPhone"
							type="tel"
							placeholder="+1-555-0101"
							{...register("adminPhone")}
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
						navigate({ to: "/onboarding", search: { step: 0 } });
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
