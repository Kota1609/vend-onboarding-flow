import { api } from "@onboarding-flow/backend/convex/_generated/api";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	Building2,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	LayoutDashboard,
	ListChecks,
	Moon,
	ParkingSquare,
	Sun,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function AppSidebar() {
	const { role, setRole, tenantId, setTenantId } = useAuth();
	const tenants = useQuery(api.tenants.list);
	const { theme, setTheme } = useTheme();
	const navigate = useNavigate();
	const [collapsed, setCollapsed] = useState(
		() => localStorage.getItem("sidebar-collapsed") === "true",
	);

	function toggleCollapsed() {
		const next = !collapsed;
		setCollapsed(next);
		localStorage.setItem("sidebar-collapsed", String(next));
	}

	const currentTenantName = tenants?.find(
		(t) => t._id === tenantId,
	)?.companyName;

	return (
		<aside
			className={`flex h-svh flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ${collapsed ? "w-12" : "w-56"}`}
		>
			{/* Logo + collapse/expand toggle */}
			<div className="flex items-center justify-between px-2 py-4">
				<div
					className={`flex items-center gap-2 ${collapsed ? "px-0" : "px-2"}`}
				>
					<ParkingSquare className="size-5 shrink-0 text-sidebar-primary" />
					{!collapsed && (
						<span className="font-semibold text-sidebar-primary text-sm">
							Vend Park
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={toggleCollapsed}
					className="rounded p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
					title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					{collapsed ? (
						<ChevronRight className="size-4" />
					) : (
						<ChevronLeft className="size-4" />
					)}
				</button>
			</div>

			{/* Navigation */}
			<nav className="flex flex-1 flex-col gap-1 px-1.5">
				<Link
					to="/"
					activeOptions={{ exact: true }}
					activeProps={{
						className: "bg-sidebar-accent text-sidebar-accent-foreground",
					}}
					className={`flex items-center gap-2 py-2 text-sidebar-foreground text-sm transition-colors hover:bg-sidebar-accent/50 ${collapsed ? "justify-center px-0" : "px-3"}`}
					title="Dashboard"
				>
					<LayoutDashboard className="size-4 shrink-0" />
					{!collapsed && "Dashboard"}
				</Link>

				{role === "vend_admin" && (
					<>
						<Link
							to="/tenants"
							activeProps={{
								className: "bg-sidebar-accent text-sidebar-accent-foreground",
							}}
							className={`flex items-center gap-2 py-2 text-sidebar-foreground text-sm transition-colors hover:bg-sidebar-accent/50 ${collapsed ? "justify-center px-0" : "px-3"}`}
							title="Tenants"
						>
							<Building2 className="size-4 shrink-0" />
							{!collapsed && "Tenants"}
						</Link>
						<Link
							to="/billing"
							activeProps={{
								className: "bg-sidebar-accent text-sidebar-accent-foreground",
							}}
							className={`flex items-center gap-2 py-2 text-sidebar-foreground text-sm transition-colors hover:bg-sidebar-accent/50 ${collapsed ? "justify-center px-0" : "px-3"}`}
							title="Billing"
						>
							<CreditCard className="size-4 shrink-0" />
							{!collapsed && "Billing"}
						</Link>
					</>
				)}

				{role === "tenant_admin" && tenantId && (
					<Link
						to="/onboarding"
						search={{ step: 0 }}
						activeProps={{
							className: "bg-sidebar-accent text-sidebar-accent-foreground",
						}}
						className={`flex items-center gap-2 py-2 text-sidebar-foreground text-sm transition-colors hover:bg-sidebar-accent/50 ${collapsed ? "justify-center px-0" : "px-3"}`}
						title="Onboarding"
					>
						<ListChecks className="size-4 shrink-0" />
						{!collapsed && "Onboarding"}
					</Link>
				)}
			</nav>

			{/* Bottom section */}
			<div className="mt-auto border-sidebar-border border-t px-1.5 py-3">
				{/* Role & tenant identity */}
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<button
								type="button"
								className={`w-full rounded-md transition-colors hover:bg-sidebar-accent ${collapsed ? "px-1 py-2" : "px-3 py-2.5"}`}
							/>
						}
					>
						{collapsed ? (
							<div
								className={`mx-auto flex size-7 items-center justify-center rounded-md font-bold text-xs ${role === "vend_admin" ? "bg-sidebar-primary/15 text-sidebar-primary" : "bg-blue-500/15 text-blue-600 dark:text-blue-400"}`}
							>
								{role === "vend_admin"
									? "V"
									: (currentTenantName?.[0] ?? "T")}
							</div>
						) : (
							<div className="flex items-center gap-2.5">
								<div
									className={`flex size-8 shrink-0 items-center justify-center rounded-md font-bold text-sm ${role === "vend_admin" ? "bg-sidebar-primary/15 text-sidebar-primary" : "bg-blue-500/15 text-blue-600 dark:text-blue-400"}`}
								>
									{role === "vend_admin"
										? "V"
										: (currentTenantName?.[0] ?? "T")}
								</div>
								<div className="min-w-0 text-left">
									<p className="truncate font-semibold text-sidebar-foreground text-sm leading-tight">
										{role === "vend_admin"
											? "Vend Admin"
											: (currentTenantName ?? "Tenant")}
									</p>
									<p className="text-sidebar-foreground/50 text-xs leading-tight">
										{role === "vend_admin"
											? "Platform"
											: "Tenant Admin"}
									</p>
								</div>
							</div>
						)}
					</DropdownMenuTrigger>
					<DropdownMenuContent side="right" align="end">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Switch Role</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setRole("vend_admin");
									setTenantId(null);
									navigate({ to: "/" });
								}}
							>
								Vend Admin
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuLabel>Tenant Admin</DropdownMenuLabel>
							{tenants?.map((t) => (
								<DropdownMenuItem
									key={t._id}
									onClick={() => {
										setRole("tenant_admin");
										setTenantId(t._id);
										navigate({ to: "/" });
									}}
								>
									{t.companyName}
								</DropdownMenuItem>
							))}
							{tenants?.length === 0 && (
								<DropdownMenuItem disabled>No tenants yet</DropdownMenuItem>
							)}
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Dark mode toggle */}
				<Button
					variant="ghost"
					size="sm"
					className={`mt-1 w-full gap-2 text-sidebar-foreground ${collapsed ? "justify-center px-0" : "justify-start"}`}
					onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
					title="Toggle theme"
				>
					<Sun className="size-4 shrink-0 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
					<Moon className="absolute size-4 shrink-0 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
					{!collapsed && <span className="text-sm">Toggle theme</span>}
				</Button>
			</div>
		</aside>
	);
}
