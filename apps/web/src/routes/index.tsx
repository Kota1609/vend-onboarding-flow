import { createFileRoute } from "@tanstack/react-router";
import { TenantAdminDashboard } from "@/components/tenant-admin-dashboard";
import { VendAdminDashboard } from "@/components/vend-admin-dashboard";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	const { role, tenantId } = useAuth();

	if (role === "vend_admin") {
		return <VendAdminDashboard />;
	}

	if (role === "tenant_admin" && tenantId) {
		return <TenantAdminDashboard tenantId={tenantId} />;
	}

	return (
		<div className="mx-auto max-w-5xl p-6">
			<p className="text-muted-foreground">
				Select a tenant from the sidebar to view your dashboard.
			</p>
		</div>
	);
}
