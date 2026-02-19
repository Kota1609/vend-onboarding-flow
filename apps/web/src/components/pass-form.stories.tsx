import type { Meta, StoryObj } from "@storybook/react";
import { PassForm } from "./pass-form";

const meta: Meta<typeof PassForm> = {
	title: "Components/PassForm",
	component: PassForm,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PassForm>;

export const CreateNew: Story = {
	args: {
		onSubmit: async (values) => {
			console.log("Submitted:", values);
		},
	},
};

export const EditExisting: Story = {
	args: {
		initialValues: {
			name: "Executive Reserved",
			description: "Reserved spots for C-suite and senior leadership",
			targetMemberCount: 10,
		},
		onSubmit: async (values) => {
			console.log("Submitted:", values);
		},
		submitLabel: "Save Changes",
	},
};

export const WithCancel: Story = {
	args: {
		onSubmit: async (values) => {
			console.log("Submitted:", values);
		},
		onCancel: () => {
			console.log("Cancelled");
		},
	},
};
