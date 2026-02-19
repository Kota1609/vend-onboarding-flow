import type { Meta, StoryObj } from "@storybook/react";
import { MemberForm } from "./member-form";

const meta: Meta<typeof MemberForm> = {
	title: "Components/MemberForm",
	component: MemberForm,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MemberForm>;

export const Empty: Story = {
	args: {
		onSubmit: async (values) => {
			console.log("Submitted:", values);
		},
	},
};

export const WithInitialValues: Story = {
	args: {
		initialValues: {
			name: "Jane Doe",
			email: "jane@example.com",
			phone: "+1 555-0100",
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
