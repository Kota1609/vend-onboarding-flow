import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import "../index.css";

// biome-ignore lint/complexity/noBannedTypes: TanStack Router requires this pattern
export type RouterAppContext = {};

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	errorComponent: ({ error, reset }) => (
		<div className="p-6">
			<h1 className="mb-2 font-bold text-xl">Navigation Error</h1>
			<p className="mb-4 text-muted-foreground text-sm">{error.message}</p>
			<Button onClick={reset}>Try Again</Button>
		</div>
	),
	head: () => ({
		meta: [
			{
				title: "onboarding-flow",
			},
			{
				name: "description",
				content: "onboarding-flow is a web application",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<div className="grid h-svh grid-cols-[auto_1fr]">
					<AppSidebar />
					<main className="overflow-auto">
						<ErrorBoundary>
							<Outlet />
						</ErrorBoundary>
					</main>
				</div>
				<Toaster />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
		</>
	);
}
