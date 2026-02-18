import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { PassCard } from "@/components/pass-card";
import { PassForm } from "@/components/pass-form";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

const STEPS = [
	{ label: "Define Passes", description: "Create pass types" },
	{ label: "Add Members", description: "Add people to passes" },
	{ label: "Send Invites", description: "Invite members" },
	{ label: "Monitor & Approve", description: "Track progress" },
] as const;

function OnboardingPage() {
	const { role, tenantId } = useAuth();
	const [currentStep, setCurrentStep] = useState(0);

	if (role !== "tenant_admin" || !tenantId) {
		return (
			<div className="p-6">
				<p className="text-muted-foreground">
					Switch to a Tenant Admin role to access onboarding.
				</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl p-6">
			<div className="mb-8">
				<h1 className="font-bold text-2xl">Onboarding</h1>
				<p className="mt-1 text-muted-foreground">
					Set up parking passes and onboard your members.
				</p>
			</div>

			{/* Step indicator */}
			<StepIndicator currentStep={currentStep} />

			{/* Step content */}
			<div className="mt-8">
				{currentStep === 0 && (
					<StepDefinePasses
						tenantId={tenantId}
						onNext={() => setCurrentStep(1)}
					/>
				)}
				{currentStep === 1 && (
					<StepPlaceholder
						title="Add Members"
						description="Coming in the next commit."
					/>
				)}
				{currentStep === 2 && (
					<StepPlaceholder
						title="Send Invites"
						description="Coming in a future commit."
					/>
				)}
				{currentStep === 3 && (
					<StepPlaceholder
						title="Monitor & Approve"
						description="Coming in a future commit."
					/>
				)}
			</div>

			{/* Navigation */}
			<div className="mt-8 flex justify-between">
				<Button
					variant="outline"
					onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
					disabled={currentStep === 0}
				>
					Back
				</Button>
				<Button
					onClick={() =>
						setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))
					}
					disabled={currentStep === STEPS.length - 1}
				>
					Next
				</Button>
			</div>
		</div>
	);
}

function StepIndicator({ currentStep }: { currentStep: number }) {
	return (
		<div className="flex gap-1">
			{STEPS.map((step, i) => (
				<div key={step.label} className="flex flex-1 flex-col">
					<div className="mb-2 flex items-center gap-2">
						<div
							className={cn(
								"flex h-6 w-6 shrink-0 items-center justify-center font-medium text-xs",
								i === currentStep
									? "bg-primary text-primary-foreground"
									: i < currentStep
										? "bg-primary/20 text-primary"
										: "bg-muted text-muted-foreground",
							)}
						>
							{i + 1}
						</div>
						{i < STEPS.length - 1 && (
							<div
								className={cn(
									"h-px flex-1",
									i < currentStep ? "bg-primary/40" : "bg-border",
								)}
							/>
						)}
					</div>
					<span
						className={cn(
							"text-xs",
							i === currentStep
								? "font-medium text-foreground"
								: "text-muted-foreground",
						)}
					>
						{step.label}
					</span>
				</div>
			))}
		</div>
	);
}

function StepDefinePasses({
	tenantId,
	onNext,
}: {
	tenantId: string;
	onNext: () => void;
}) {
	const passes = useQuery(api.passes.listByTenant, {
		tenantId: tenantId as Id<"tenants">,
	});
	const createPass = useMutation(api.passes.create);
	const updatePass = useMutation(api.passes.update);
	const removePass = useMutation(api.passes.remove);

	const [showForm, setShowForm] = useState(false);
	const [editingPassId, setEditingPassId] = useState<string | null>(null);

	const hasAtLeastOnePass = passes && passes.length > 0;

	async function handleCreate(values: {
		name: string;
		description: string;
		targetMemberCount: number;
	}) {
		await createPass({
			tenantId: tenantId as Id<"tenants">,
			...values,
		});
		toast.success(`Pass "${values.name}" created.`);
		setShowForm(false);
	}

	async function handleUpdate(
		passId: string,
		values: {
			name: string;
			description: string;
			targetMemberCount: number;
		},
	) {
		await updatePass({
			passId: passId as Id<"passes">,
			...values,
		});
		toast.success("Pass updated.");
		setEditingPassId(null);
	}

	async function handleDelete(passId: string) {
		const result = await removePass({
			passId: passId as Id<"passes">,
		});
		if (result.ok) {
			toast.success("Pass deleted.");
		} else {
			toast.error(result.message);
		}
	}

	if (passes === undefined) {
		return (
			<div className="grid gap-3">
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}

	return (
		<div className="grid gap-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-lg">Define Passes</h2>
					<p className="text-muted-foreground text-sm">
						Create parking pass types for your company.
					</p>
				</div>
				{!showForm && (
					<Button onClick={() => setShowForm(true)}>Add Pass</Button>
				)}
			</div>

			{showForm && (
				<Card>
					<CardHeader>
						<CardTitle>New Pass</CardTitle>
						<CardDescription>
							Define a pass type with a target member count.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<PassForm
							onSubmit={handleCreate}
							onCancel={() => setShowForm(false)}
						/>
					</CardContent>
				</Card>
			)}

			{passes.length === 0 && !showForm && (
				<Card>
					<CardContent className="py-8 text-center">
						<p className="text-muted-foreground">
							No passes yet. Create your first pass to get started.
						</p>
					</CardContent>
				</Card>
			)}

			{passes.map((pass) =>
				editingPassId === pass._id ? (
					<Card key={pass._id}>
						<CardHeader>
							<CardTitle>Edit Pass</CardTitle>
						</CardHeader>
						<CardContent>
							<PassForm
								initialValues={{
									name: pass.name,
									description: pass.description,
									targetMemberCount: pass.targetMemberCount,
								}}
								onSubmit={(values) => handleUpdate(pass._id, values)}
								onCancel={() => setEditingPassId(null)}
								submitLabel="Save Changes"
							/>
						</CardContent>
					</Card>
				) : (
					<PassCard
						key={pass._id}
						name={pass.name}
						description={pass.description}
						targetMemberCount={pass.targetMemberCount}
						memberCount={pass.memberCount}
						statusBreakdown={pass.statusBreakdown}
						onEdit={() => setEditingPassId(pass._id)}
						onDelete={() => handleDelete(pass._id)}
					/>
				),
			)}

			{hasAtLeastOnePass && (
				<div className="flex justify-end">
					<Button onClick={onNext}>Continue to Add Members</Button>
				</div>
			)}
		</div>
	);
}

function StepPlaceholder({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<Card>
			<CardContent className="py-8 text-center">
				<h2 className="font-semibold text-lg">{title}</h2>
				<p className="mt-1 text-muted-foreground">{description}</p>
			</CardContent>
		</Card>
	);
}
