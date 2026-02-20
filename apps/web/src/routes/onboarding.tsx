import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
	StepAddMembers,
	StepDefinePasses,
	StepIndicator,
	StepMonitorApprove,
	StepOverview,
	StepSendInvites,
} from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const onboardingSearchSchema = z.object({
	step: z.number().int().min(0).max(4).catch(0),
});

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
	validateSearch: (search) => onboardingSearchSchema.parse(search),
});

const WIZARD_STEPS = [
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

	// Step 0 is the overview landing page — no step indicator
	if (currentStep === 0) {
		return (
			<div className="p-6">
				<StepOverview onStart={() => goToStep(1)} />
			</div>
		);
	}

	// Steps 1-4 map to wizard steps 0-3
	const wizardStep = currentStep - 1;

	return (
		<div className="p-6">
			<div className="mb-8 flex items-start justify-between">
				<div>
					<h1 className="font-bold text-2xl">Onboarding</h1>
					<p className="mt-1 text-muted-foreground">
						Set up parking passes and onboard your members.
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => goToStep(Math.max(0, currentStep - 1))}
					>
						{currentStep === 1 ? "Overview" : "Back"}
					</Button>
					{currentStep < 4 && (
						<Button
							onClick={() => goToStep(Math.min(4, currentStep + 1))}
						>
							Next
						</Button>
					)}
				</div>
			</div>

			<StepIndicator
				currentStep={wizardStep}
				steps={WIZARD_STEPS}
				onStepClick={(i) => goToStep(i + 1)}
			/>

			<div className="mt-8">
				{wizardStep === 0 && (
					<StepDefinePasses tenantId={tenantId} onNext={() => goToStep(2)} />
				)}
				{wizardStep === 1 && (
					<StepAddMembers tenantId={tenantId} onNext={() => goToStep(3)} />
				)}
				{wizardStep === 2 && (
					<StepSendInvites tenantId={tenantId} onNext={() => goToStep(4)} />
				)}
				{wizardStep === 3 && <StepMonitorApprove tenantId={tenantId} />}
			</div>
		</div>
	);
}
