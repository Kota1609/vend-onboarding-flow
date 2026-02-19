import { cn } from "@/lib/utils";

interface Step {
	readonly label: string;
	readonly description: string;
}

interface StepIndicatorProps {
	currentStep: number;
	steps: readonly Step[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
	return (
		<div className="flex gap-1">
			{steps.map((step, i) => (
				<div key={step.label} className="flex flex-1 flex-col">
					<div className="mb-2 flex items-center gap-2">
						<div
							className={cn(
								"flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-medium text-xs",
								i === currentStep
									? "bg-primary text-primary-foreground"
									: i < currentStep
										? "bg-primary/20 text-primary"
										: "bg-muted text-muted-foreground",
							)}
						>
							{i + 1}
						</div>
						{i < steps.length - 1 && (
							<div
								className={cn(
									"h-px flex-1",
									i < currentStep ? "bg-primary/40" : "bg-border",
								)}
							/>
						)}
					</div>
					<span
						className={cn(
							"text-xs",
							i === currentStep
								? "font-medium text-foreground"
								: "text-muted-foreground",
						)}
					>
						{step.label}
					</span>
				</div>
			))}
		</div>
	);
}
