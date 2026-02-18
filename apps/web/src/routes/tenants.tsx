import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tenants")({
	component: TenantsPage,
});

function TenantsPage() {
	return (
		<div className="p-6">
			<h1 className="font-bold text-2xl">Tenants</h1>
			<p className="mt-1 text-muted-foreground">
				Manage tenant onboarding. Coming soon.
			</p>
		</div>
	);
}
