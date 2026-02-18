import type { Meta, StoryObj } from "@storybook/react";
import { OnboardingStatusBadge } from "./onboarding-status-badge";

const meta: Meta<typeof OnboardingStatusBadge> = {
	title: "Components/OnboardingStatusBadge",
	component: OnboardingStatusBadge,
	tags: ["autodocs"],
	argTypes: {
		status: {
			control: "select",
			options: ["not_started", "in_progress", "complete"],
		},
	},
};

export default meta;
type Story = StoryObj<typeof OnboardingStatusBadge>;

export const NotStarted: Story = {
	args: { status: "not_started" },
};

export const InProgress: Story = {
	args: { status: "in_progress" },
};

export const Complete: Story = {
	args: { status: "complete" },
};

export const AllVariants: Story = {
	render: () => (
		<div className="flex gap-3">
			<OnboardingStatusBadge status="not_started" />
			<OnboardingStatusBadge status="in_progress" />
			<OnboardingStatusBadge status="complete" />
		</div>
	),
};
