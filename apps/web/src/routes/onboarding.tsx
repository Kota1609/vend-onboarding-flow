import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

function OnboardingPage() {
	return (
		<div className="p-6">
			<h1 className="font-bold text-2xl">Onboarding</h1>
			<p className="mt-1 text-muted-foreground">
				Tenant onboarding wizard. Coming soon.
			</p>
		</div>
	);
}
