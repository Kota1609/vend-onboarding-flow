import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { createContext, useCallback, useContext, useState } from "react";

export type Role = "vend_admin" | "tenant_admin";

interface AuthState {
	role: Role;
	tenantId: Id<"tenants"> | null;
	setRole: (role: Role) => void;
	setTenantId: (id: Id<"tenants"> | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

function loadRole(): Role {
	const stored = localStorage.getItem("auth-role");
	if (stored === "tenant_admin" || stored === "vend_admin") return stored;
	return "vend_admin";
}

function loadTenantId(): Id<"tenants"> | null {
	return (localStorage.getItem("auth-tenantId") as Id<"tenants">) || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [role, setRoleState] = useState<Role>(loadRole);
	const [tenantId, setTenantIdState] = useState<Id<"tenants"> | null>(
		loadTenantId,
	);

	const setRole = useCallback((r: Role) => {
		setRoleState(r);
		localStorage.setItem("auth-role", r);
	}, []);

	const setTenantId = useCallback((id: Id<"tenants"> | null) => {
		setTenantIdState(id);
		if (id) {
			localStorage.setItem("auth-tenantId", id);
		} else {
			localStorage.removeItem("auth-tenantId");
		}
	}, []);

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
