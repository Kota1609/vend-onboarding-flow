import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
	StepAddMembers,
	StepDefinePasses,
	StepIndicator,
	StepMonitorApprove,
	StepSendInvites,
} from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const onboardingSearchSchema = z.object({
	step: z.number().int().min(0).max(3).catch(0),
});

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
	validateSearch: (search) => onboardingSearchSchema.parse(search),
});

const STEPS = [
	{ label: "Define Passes", description: "Create pass types" },
	{ label: "Add Members", description: "Add people to passes" },
	{ label: "Send Invites", description: "Invite members" },
	{ label: "Monitor & Approve", description: "Track progress" },
] as const;

function OnboardingPage() {
	const { role, tenantId } = useAuth();
	const { step: currentStep } = Route.useSearch();
	const navigate = useNavigate();

	function goToStep(step: number) {
		navigate({ to: "/onboarding", search: { step } });
	}

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

			<StepIndicator currentStep={currentStep} steps={STEPS} />

			<div className="mt-8">
				{currentStep === 0 && (
					<StepDefinePasses tenantId={tenantId} onNext={() => goToStep(1)} />
				)}
				{currentStep === 1 && (
					<StepAddMembers tenantId={tenantId} onNext={() => goToStep(2)} />
				)}
				{currentStep === 2 && (
					<StepSendInvites tenantId={tenantId} onNext={() => goToStep(3)} />
				)}
				{currentStep === 3 && <StepMonitorApprove tenantId={tenantId} />}
			</div>

			<div className="mt-8 flex justify-between">
				<Button
					variant="outline"
					onClick={() => goToStep(Math.max(0, currentStep - 1))}
					disabled={currentStep === 0}
				>
					Back
				</Button>
				<Button
					onClick={() => goToStep(Math.min(STEPS.length - 1, currentStep + 1))}
					disabled={currentStep === STEPS.length - 1}
				>
					Next
				</Button>
			</div>
		</div>
	);
}
