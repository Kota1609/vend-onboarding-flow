import type { Meta, StoryObj } from "@storybook/react";
import { MemberRow } from "./member-row";

const meta: Meta<typeof MemberRow> = {
	title: "Components/MemberRow",
	component: MemberRow,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MemberRow>;

export const DraftWithEmail: Story = {
	args: {
		name: "Jane Doe",
		email: "jane@example.com",
		status: "draft",
		effectiveMethod: "email",
		onEdit: () => {},
		onDelete: () => {},
	},
};

export const DraftWithPhone: Story = {
	args: {
		name: "John Smith",
		phone: "+1 555-0100",
		status: "draft",
		effectiveMethod: "phone",
		onEdit: () => {},
		onDelete: () => {},
	},
};

export const DraftNoContact: Story = {
	args: {
		name: "Alex Unknown",
		status: "draft",
		effectiveMethod: "access_code",
		onEdit: () => {},
		onDelete: () => {},
	},
};

export const Invited: Story = {
	args: {
		name: "Jane Doe",
		email: "jane@example.com",
		status: "invited",
		effectiveMethod: "email",
	},
};

export const Accepted: Story = {
	args: {
		name: "John Smith",
		phone: "+1 555-0100",
		status: "accepted",
		effectiveMethod: "phone",
	},
};

export const Approved: Story = {
	args: {
		name: "Alice Johnson",
		email: "alice@example.com",
		status: "approved",
		effectiveMethod: "email",
	},
};

export const Rejected: Story = {
	args: {
		name: "Bob Williams",
		email: "bob@example.com",
		status: "rejected",
		effectiveMethod: "email",
	},
};

export const AllStatuses: Story = {
	render: () => (
		<div className="border">
			<MemberRow
				name="Draft Member"
				email="draft@example.com"
				status="draft"
				effectiveMethod="email"
				onEdit={() => {}}
				onDelete={() => {}}
			/>
			<MemberRow
				name="Invited Member"
				phone="+1 555-0100"
				status="invited"
				effectiveMethod="phone"
			/>
			<MemberRow
				name="Accepted Member"
				email="accepted@example.com"
				status="accepted"
				effectiveMethod="email"
			/>
			<MemberRow
				name="Approved Member"
				email="approved@example.com"
				status="approved"
				effectiveMethod="email"
			/>
			<MemberRow
				name="Rejected Member"
				status="rejected"
				effectiveMethod="access_code"
			/>
		</div>
	),
};
