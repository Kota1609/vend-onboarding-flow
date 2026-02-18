import type { Meta, StoryObj } from "@storybook/react";
import { PassCard } from "./pass-card";

const meta: Meta<typeof PassCard> = {
	title: "Components/PassCard",
	component: PassCard,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PassCard>;

export const Default: Story = {
	args: {
		name: "Executive Reserved",
		description: "Reserved spots for C-suite and senior leadership",
		targetMemberCount: 5,
		memberCount: 4,
		statusBreakdown: {
			draft: 1,
			invited: 1,
			accepted: 1,
			approved: 1,
			rejected: 0,
		},
		onEdit: () => {},
		onDelete: () => {},
	},
};

export const Empty: Story = {
	args: {
		name: "General Employee",
		description: "Standard employee parking access",
		targetMemberCount: 10,
		memberCount: 0,
		statusBreakdown: {
			draft: 0,
			invited: 0,
			accepted: 0,
			approved: 0,
			rejected: 0,
		},
		onEdit: () => {},
		onDelete: () => {},
	},
};

export const Complete: Story = {
	args: {
		name: "Executive Reserved",
		description: "Reserved spots for C-suite and senior leadership",
		targetMemberCount: 5,
		memberCount: 5,
		statusBreakdown: {
			draft: 0,
			invited: 0,
			accepted: 0,
			approved: 5,
			rejected: 0,
		},
		onEdit: () => {},
	},
};

export const HasMembers: Story = {
	name: "Has Members (Delete Disabled)",
	args: {
		name: "General Employee",
		description: "Standard employee parking access",
		targetMemberCount: 10,
		memberCount: 6,
		statusBreakdown: {
			draft: 1,
			invited: 2,
			accepted: 1,
			approved: 2,
			rejected: 0,
		},
		onEdit: () => {},
		onDelete: () => {},
	},
};
