import type { Meta, StoryObj } from "@storybook/react";
import { BillingCard } from "./billing-card";

const meta: Meta<typeof BillingCard> = {
	title: "Components/BillingCard",
	component: BillingCard,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof BillingCard>;

export const NotConfigured: Story = {
	args: {
		name: "Executive Reserved",
		description: "Reserved spots for C-suite and senior leadership",
		targetMemberCount: 5,
		memberCount: 3,
		currentBillingType: undefined,
		onSetBillingType: () => {},
	},
};

export const Recurring: Story = {
	args: {
		name: "Executive Reserved",
		description: "Reserved spots for C-suite and senior leadership",
		targetMemberCount: 5,
		memberCount: 3,
		currentBillingType: "recurring",
		onSetBillingType: () => {},
	},
};

export const UsageBased: Story = {
	args: {
		name: "General Employee",
		description: "Standard employee parking access",
		targetMemberCount: 50,
		memberCount: 42,
		currentBillingType: "usage_based",
		onSetBillingType: () => {},
	},
};

export const Loading: Story = {
	args: {
		name: "Executive Reserved",
		description: "Reserved spots for C-suite and senior leadership",
		targetMemberCount: 5,
		memberCount: 3,
		currentBillingType: undefined,
		onSetBillingType: () => {},
		isLoading: true,
	},
};

export const AllVariants: Story = {
	render: () => (
		<div className="grid gap-4">
			<BillingCard
				name="Executive Reserved"
				description="Reserved spots for C-suite"
				targetMemberCount={5}
				memberCount={3}
				onSetBillingType={() => {}}
			/>
			<BillingCard
				name="General Employee"
				description="Standard parking access"
				targetMemberCount={50}
				memberCount={42}
				currentBillingType="recurring"
				onSetBillingType={() => {}}
			/>
			<BillingCard
				name="Visitor Passes"
				description="Temporary visitor access"
				targetMemberCount={20}
				memberCount={8}
				currentBillingType="usage_based"
				onSetBillingType={() => {}}
			/>
		</div>
	),
};
