import { CopilotPanel } from "@/components/copilot-panel";

/**
 * @deprecated Copilot panel is now rendered globally in the root layout.
 * This component is kept for backward compatibility with Storybook stories.
 */
export function OnboardingAssistant() {
	return <CopilotPanel />;
}
