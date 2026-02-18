import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { createContext, useContext, useState } from "react";

export type Role = "vend_admin" | "tenant_admin";

interface AuthState {
	role: Role;
	tenantId: Id<"tenants"> | null;
	setRole: (role: Role) => void;
	setTenantId: (id: Id<"tenants"> | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [role, setRole] = useState<Role>("vend_admin");
	const [tenantId, setTenantId] = useState<Id<"tenants"> | null>(null);

	return (
		<AuthContext.Provider value={{ role, tenantId, setRole, setTenantId }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthState {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return ctx;
}
