import { api } from "@onboarding-flow/backend/convex/_generated/api";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useAuth } from "@/lib/auth-context";
import { ModeToggle } from "./mode-toggle";
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

export default function Header() {
	const { role, setRole, tenantId, setTenantId } = useAuth();
	const tenants = useQuery(api.tenants.list);

	return (
		<div>
			<div className="flex flex-row items-center justify-between px-4 py-2">
				<nav className="flex items-center gap-6">
					<Link to="/" className="font-semibold text-sm">
						Vend Park
					</Link>
					<Link
						to="/"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						Dashboard
					</Link>
					{role === "vend_admin" && (
						<>
							<Link
								to="/tenants"
								className="text-muted-foreground text-sm hover:text-foreground"
							>
								Tenants
							</Link>
							<Link
								to="/billing"
								className="text-muted-foreground text-sm hover:text-foreground"
							>
								Billing
							</Link>
						</>
					)}
					{role === "tenant_admin" && tenantId && (
						<Link
							to="/onboarding"
							className="text-muted-foreground text-sm hover:text-foreground"
						>
							Onboarding
						</Link>
					)}
				</nav>
				<div className="flex items-center gap-3">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="outline" size="sm" />}
						>
							{role === "vend_admin" ? "Vend Admin" : "Tenant Admin"}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
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
					<ModeToggle />
				</div>
			</div>
			<hr />
		</div>
	);
}
