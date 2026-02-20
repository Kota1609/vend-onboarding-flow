import type { Meta, StoryObj } from "@storybook/react";
import { OnboardingAssistant } from "./onboarding-assistant";

const meta: Meta<typeof OnboardingAssistant> = {
	title: "Components/OnboardingAssistant",
	component: OnboardingAssistant,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Floating chat panel for tenant admins. Ask questions about onboarding progress, blockers, and member status.",
			},
		},
	},
};

export default meta;
type Story = StoryObj<typeof OnboardingAssistant>;

export const Default: Story = {};

export const Open: Story = {
	parameters: {
		docs: {
			description: {
				story: "The assistant panel in its open state with quick action buttons.",
			},
		},
	},
};

export const Loading: Story = {
	parameters: {
		docs: {
			description: {
				story: "The assistant while waiting for an AI response.",
			},
		},
	},
};
