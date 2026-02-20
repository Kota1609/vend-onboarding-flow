import type { Meta, StoryObj } from "@storybook/react";
import { ColumnMappingCard } from "./column-mapping-card";

const meta: Meta<typeof ColumnMappingCard> = {
	title: "Components/ColumnMappingCard",
	component: ColumnMappingCard,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Smart column mapping card for CSV/Excel imports. Shows AI-suggested mappings with confidence scores and reasoning.",
			},
		},
	},
};

export default meta;
type Story = StoryObj<typeof ColumnMappingCard>;

export const Default: Story = {
	args: {
		headers: ["Full Name", "E-mail Address", "Mobile Number", "Department"],
		sampleRows: [
			["John Doe", "john@example.com", "+1 555-0100", "Engineering"],
			["Jane Smith", "jane@example.com", "+1 555-0200", "Marketing"],
			["Bob Wilson", "bob@example.com", "", "Sales"],
		],
		aiMappings: [
			{
				sourceColumn: "Full Name",
				targetField: "name",
				confidence: "high",
				reasoning: "Contains person names",
			},
			{
				sourceColumn: "E-mail Address",
				targetField: "email",
				confidence: "high",
				reasoning: "Contains email addresses",
			},
			{
				sourceColumn: "Mobile Number",
				targetField: "phone",
				confidence: "high",
				reasoning: "Contains phone numbers",
			},
			{
				sourceColumn: "Department",
				targetField: "skip",
				confidence: "medium",
				reasoning: "Not a member field",
			},
		],
		isLoading: false,
		onApply: (mappings) => console.log("Applied mappings:", mappings),
		onUseRawHeaders: () => console.log("Using raw headers"),
	},
};

export const ManualMapping: Story = {
	args: {
		headers: ["Col A", "Col B", "Col C"],
		sampleRows: [
			["John Doe", "john@example.com", "+1 555-0100"],
			["Jane Smith", "jane@example.com", "+1 555-0200"],
		],
		aiMappings: null,
		isLoading: false,
		onApply: (mappings) => console.log("Applied mappings:", mappings),
		onUseRawHeaders: () => console.log("Using raw headers"),
	},
};
