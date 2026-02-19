import type { Meta, StoryObj } from "@storybook/react";
import { StatCard } from "./stat-card";

const meta: Meta<typeof StatCard> = {
	title: "Components/StatCard",
	component: StatCard,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
	args: {
		label: "Total Members",
		value: 42,
	},
};

export const WithDetail: Story = {
	args: {
		label: "Approved Members",
		value: 28,
		detail: "67% of target",
	},
};

export const Percentage: Story = {
	args: {
		label: "Completion Rate",
		value: "85%",
		detail: "Across all passes",
	},
};

export const AllVariants: Story = {
	render: () => (
		<div className="grid gap-4 sm:grid-cols-3">
			<StatCard label="Total Members" value={42} />
			<StatCard label="Approved" value={28} detail="67% of target" />
			<StatCard label="Completion" value="85%" detail="Across all passes" />
		</div>
	),
};
