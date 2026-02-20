import {
	ArrowRight,
	ClipboardCheck,
	Mail,
	ShieldCheck,
	Sparkles,
	TicketCheck,
	Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepOverviewProps {
	onStart: () => void;
}

const STEPS = [
	{
		number: 1,
		title: "Define Passes",
		description:
			"Create parking pass types for your facility (e.g. Executive, Standard, Visitor). Set target member counts for each.",
		ai: 'Say "Create a pass called Executive with 50 members" and the AI will set it up for you.',
		icon: TicketCheck,
	},
	{
		number: 2,
		title: "Add Members",
		description:
			"Add people to each pass manually, from a CSV, or by pasting a list. The AI can parse names and emails from any format.",
		ai: 'Paste a list like "John john@acme.com, Jane, Bob" and the AI will parse and add them all.',
		icon: Users,
	},
	{
		number: 3,
		title: "Send Invites",
		description:
			"Send invites to draft members via email, phone, or access code. Resend to anyone who hasn't responded yet.",
		ai: 'Say "Send all invites for Executive" or "Resend to John" and the AI handles it.',
		icon: Mail,
	},
	{
		number: 4,
		title: "Monitor & Approve",
		description:
			"Track who has accepted their invite and approve them for parking access. Reject anyone if needed.",
		ai: 'Say "Approve all accepted members" or "Show approval progress" to manage the final step.',
		icon: ShieldCheck,
	},
];

export function StepOverview({ onStart }: StepOverviewProps) {
	return (
		<div className="mx-auto max-w-3xl">
			{/* Hero */}
			<div className="mb-8 rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 px-8 py-8">
				<h2 className="mb-2 font-bold text-2xl">Welcome to Onboarding</h2>
				<p className="mb-4 max-w-xl text-muted-foreground">
					Set up parking passes, add members, send invites, and approve access —
					all in four guided steps. The AI copilot on the right can handle every
					action for you.
				</p>
				<div className="flex items-center gap-3">
					<Button size="lg" onClick={onStart}>
						Get Started
						<ArrowRight className="ml-2 h-4 w-4" />
					</Button>
					<span className="flex items-center gap-1.5 text-muted-foreground text-sm">
						<Sparkles className="h-4 w-4 text-primary" />
						Or just ask the AI copilot
					</span>
				</div>
			</div>

			{/* How AI helps */}
			<div className="mb-6 flex items-center gap-2">
				<ClipboardCheck className="h-5 w-5 text-primary" />
				<h3 className="font-semibold text-lg">What you'll do at each step</h3>
			</div>

			{/* Step cards */}
			<div className="grid gap-4">
				{STEPS.map((step) => (
					<div
						key={step.number}
						className="group rounded-lg border p-5 transition-colors hover:border-primary/30 hover:bg-muted/30"
					>
						<div className="mb-3 flex items-start gap-4">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<step.icon className="h-5 w-5" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="mb-1 flex items-center gap-2">
									<span className="font-medium text-muted-foreground text-xs">
										Step {step.number}
									</span>
								</div>
								<h4 className="font-semibold">{step.title}</h4>
								<p className="mt-1 text-muted-foreground text-sm">
									{step.description}
								</p>
							</div>
						</div>
						<div className="ml-14 rounded-md border border-primary/15 bg-primary/5 px-3 py-2">
							<p className="flex items-start gap-2 text-sm">
								<Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
								<span className="text-muted-foreground">
									<span className="font-medium text-foreground">AI: </span>
									{step.ai}
								</span>
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
