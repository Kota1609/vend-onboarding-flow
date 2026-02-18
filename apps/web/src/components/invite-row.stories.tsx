import type { Meta, StoryObj } from "@storybook/react";
import { InviteRow } from "./invite-row";

const meta: Meta<typeof InviteRow> = {
	title: "Components/InviteRow",
	component: InviteRow,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof InviteRow>;

export const DraftReadyToSend: Story = {
	args: {
		name: "Jane Doe",
		email: "jane@example.com",
		status: "draft",
		effectiveMethod: "email",
		onSend: () => {},
		onChangeMethod: () => {},
	},
};

export const DraftSending: Story = {
	args: {
		name: "Jane Doe",
		email: "jane@example.com",
		status: "draft",
		effectiveMethod: "email",
		onSend: () => {},
		onChangeMethod: () => {},
		isSending: true,
	},
};

export const DraftAccessCode: Story = {
	args: {
		name: "Alex Unknown",
		status: "draft",
		effectiveMethod: "access_code",
		onSend: () => {},
		onChangeMethod: () => {},
	},
};

export const InvitedWithEmail: Story = {
	args: {
		name: "Jane Doe",
		email: "jane@example.com",
		status: "invited",
		effectiveMethod: "email",
		lastInviteAt: Date.now() - 120_000,
		onResend: () => {},
		onChangeMethod: () => {},
	},
};

export const InvitedWithPhone: Story = {
	args: {
		name: "John Smith",
		phone: "+1 555-0100",
		status: "invited",
		effectiveMethod: "phone",
		lastInviteAt: Date.now() - 3_600_000,
		onResend: () => {},
		onChangeMethod: () => {},
	},
};

export const InvitedWithAccessCode: Story = {
	args: {
		name: "Alex Unknown",
		status: "invited",
		effectiveMethod: "access_code",
		accessCode: "ABCD1234",
		lastInviteAt: Date.now() - 86_400_000,
		onResend: () => {},
		onChangeMethod: () => {},
	},
};

export const InvitedAccessCodeWithQR: Story = {
	args: {
		name: "QR Test Member",
		status: "invited",
		effectiveMethod: "access_code",
		accessCode: "WXYZ5678",
		lastInviteAt: Date.now() - 300_000,
		onResend: () => {},
		onChangeMethod: () => {},
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
			<InviteRow
				name="Draft Member"
				email="draft@example.com"
				status="draft"
				effectiveMethod="email"
				onSend={() => {}}
				onChangeMethod={() => {}}
			/>
			<InviteRow
				name="Sending Member"
				email="sending@example.com"
				status="draft"
				effectiveMethod="email"
				onSend={() => {}}
				onChangeMethod={() => {}}
				isSending
			/>
			<InviteRow
				name="Invited via Email"
				email="invited@example.com"
				status="invited"
				effectiveMethod="email"
				lastInviteAt={Date.now() - 120_000}
				onResend={() => {}}
				onChangeMethod={() => {}}
			/>
			<InviteRow
				name="Invited via Code"
				status="invited"
				effectiveMethod="access_code"
				accessCode="TESTCODE"
				lastInviteAt={Date.now() - 3_600_000}
				onResend={() => {}}
				onChangeMethod={() => {}}
			/>
			<InviteRow
				name="Accepted Member"
				email="accepted@example.com"
				status="accepted"
				effectiveMethod="email"
			/>
			<InviteRow
				name="Approved Member"
				email="approved@example.com"
				status="approved"
				effectiveMethod="email"
			/>
			<InviteRow
				name="Rejected Member"
				email="rejected@example.com"
				status="rejected"
				effectiveMethod="email"
			/>
		</div>
	),
};
