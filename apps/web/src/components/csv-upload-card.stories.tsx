import type { Meta, StoryObj } from "@storybook/react";
import { CsvUploadCard } from "./csv-upload-card";

const meta: Meta<typeof CsvUploadCard> = {
	title: "Components/CsvUploadCard",
	component: CsvUploadCard,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof CsvUploadCard>;

export const Idle: Story = {
	args: {
		existingMembers: [],
		onConfirm: async (rows) => {
			console.log("Confirmed rows:", rows);
		},
		onCancel: () => {
			console.log("Cancelled");
		},
	},
};

export const WithExistingMembers: Story = {
	args: {
		existingMembers: [
			{ _id: "1", name: "Jane Doe", email: "jane@example.com" },
			{ _id: "2", name: "John Smith", phone: "+1 555-0100" },
		],
		onConfirm: async (rows) => {
			console.log("Confirmed rows:", rows);
		},
		onCancel: () => {
			console.log("Cancelled");
		},
	},
};
