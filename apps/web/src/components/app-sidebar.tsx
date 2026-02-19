import { api } from "@onboarding-flow/backend/convex/_generated/api";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	Building2,
	CreditCard,
	LayoutDashboard,
	ListChecks,
	Moon,
	ParkingSquare,
	Sun,
} from "lucide-react";
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

	const currentTenantName = tenants?.find(
		(t) => t._id === tenantId,
	)?.companyName;

	return (
		<aside className="flex h-svh w-56 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground">
			{/* Logo */}
			<div className="flex items-center gap-2 px-4 py-4">
				<ParkingSquare className="size-5 text-sidebar-primary" />
				<span className="font-semibold text-sidebar-primary text-sm">
					Vend Park
				</span>
			</div>

			{/* Navigation */}
			<nav className="flex flex-1 flex-col gap-1 px-2">
				<Link
					to="/"
					activeOptions={{ exact: true }}
					activeProps={{
						className: "bg-sidebar-accent text-sidebar-accent-foreground",
					}}
					className="flex items-center gap-2 px-3 py-2 text-sidebar-foreground text-sm transition-colors hover:bg-sidebar-accent/50"
				>
					<LayoutDashboard className="size-4" />
					Dashboard
				</Link>

				{role === "vend_admin" && (
					<>
						<Link
							to="/tenants"
							activeProps={{
								className: "bg-sidebar-accent text-sidebar-accent-foreground",
							}}
							className="flex items-center gap-2 px-3 py-2 text-sidebar-foreground text-sm transition-colors hover:bg-sidebar-accent/50"
						>
							<Building2 className="size-4" />
							Tenants
						</Link>
						<Link
							to="/billing"
							activeProps={{
								className: "bg-sidebar-accent text-sidebar-accent-foreground",
							}}
							className="flex items-center gap-2 px-3 py-2 text-sidebar-foreground text-sm transition-colors hover:bg-sidebar-accent/50"
						>
							<CreditCard className="size-4" />
							Billing
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
						className="flex items-center gap-2 px-3 py-2 text-sidebar-foreground text-sm transition-colors hover:bg-sidebar-accent/50"
					>
						<ListChecks className="size-4" />
						Onboarding
					</Link>
				)}
			</nav>

			{/* Bottom section */}
			<div className="mt-auto border-sidebar-border border-t px-2 py-3">
				{/* Role switcher */}
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="ghost"
								size="sm"
								className="w-full justify-start text-sidebar-foreground"
							/>
						}
					>
						{role === "vend_admin" ? "Vend Admin" : "Tenant Admin"}
					</DropdownMenuTrigger>
					<DropdownMenuContent side="right" align="end">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Switch Role</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									setRole("vend_admin");
									setTenantId(null);
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

				{/* Tenant indicator */}
				{role === "tenant_admin" && currentTenantName && (
					<p className="truncate px-3 py-1 text-sidebar-foreground/60 text-xs">
						{currentTenantName}
					</p>
				)}

				{/* Dark mode toggle */}
				<Button
					variant="ghost"
					size="sm"
					className="w-full justify-start gap-2 text-sidebar-foreground"
					onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
				>
					<Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
					<Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
					<span className="text-sm">Toggle theme</span>
				</Button>
			</div>
		</aside>
	);
}
