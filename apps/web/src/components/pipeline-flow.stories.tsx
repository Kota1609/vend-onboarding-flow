import type { Meta, StoryObj } from "@storybook/react";
import { PipelineFlow } from "./pipeline-flow";

const meta: Meta<typeof PipelineFlow> = {
	title: "Components/PipelineFlow",
	component: PipelineFlow,
	tags: ["autodocs"],
	decorators: [
		(Story) => (
			<div style={{ width: "100%", maxWidth: 800 }}>
				<Story />
			</div>
		),
	],
};

export default meta;
type Story = StoryObj<typeof PipelineFlow>;

export const Default: Story = {
	args: {
		draft: 5,
		invited: 12,
		accepted: 8,
		approved: 20,
		rejected: 3,
	},
};

export const Empty: Story = {
	args: {
		draft: 0,
		invited: 0,
		accepted: 0,
		approved: 0,
		rejected: 0,
	},
};

export const AllApproved: Story = {
	args: {
		draft: 0,
		invited: 0,
		accepted: 0,
		approved: 50,
		rejected: 0,
	},
};

export const WithRejections: Story = {
	args: {
		draft: 2,
		invited: 5,
		accepted: 3,
		approved: 15,
		rejected: 10,
	},
};
