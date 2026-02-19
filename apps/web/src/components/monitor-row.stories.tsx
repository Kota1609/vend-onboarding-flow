import type { Meta, StoryObj } from "@storybook/react";
import { MonitorRow } from "./monitor-row";

const meta: Meta<typeof MonitorRow> = {
	title: "Components/MonitorRow",
	component: MonitorRow,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MonitorRow>;

export const DraftReadOnly: Story = {
	args: {
		name: "Unfinished Member",
		email: "unfinished@example.com",
		status: "draft",
		effectiveMethod: "email",
	},
};

export const InvitedWithResend: Story = {
	args: {
		name: "Jane Doe",
		email: "jane@example.com",
		status: "invited",
		effectiveMethod: "email",
		lastInviteAt: Date.now() - 120_000,
		onResend: () => {},
		onChangeMethod: () => {},
		onSimulateAccept: () => {},
	},
};

export const InvitedWithAccessCodeQR: Story = {
	args: {
		name: "QR Test Member",
		status: "invited",
		effectiveMethod: "access_code",
		accessCode: "WXYZ5678",
		lastInviteAt: Date.now() - 300_000,
		onResend: () => {},
		onChangeMethod: () => {},
		onSimulateAccept: () => {},
	},
};

export const InvitedSimulateAccept: Story = {
	args: {
		name: "John Smith",
		phone: "+1 555-0100",
		status: "invited",
		effectiveMethod: "phone",
		lastInviteAt: Date.now() - 3_600_000,
		onResend: () => {},
		onChangeMethod: () => {},
		onSimulateAccept: () => {},
	},
};

export const AcceptedPendingApproval: Story = {
	args: {
		name: "Alice Johnson",
		email: "alice@example.com",
		status: "accepted",
		effectiveMethod: "email",
		onApprove: () => {},
		onReject: () => {},
	},
};

export const AcceptedLoading: Story = {
	args: {
		name: "Alice Johnson",
		email: "alice@example.com",
		status: "accepted",
		effectiveMethod: "email",
		onApprove: () => {},
		onReject: () => {},
		isLoading: true,
	},
};

export const Approved: Story = {
	args: {
		name: "Bob Williams",
		email: "bob@example.com",
		status: "approved",
		effectiveMethod: "email",
	},
};

export const Rejected: Story = {
	args: {
		name: "Charlie Brown",
		email: "charlie@example.com",
		status: "rejected",
		effectiveMethod: "email",
	},
};

export const AllStatuses: Story = {
	render: () => (
		<div className="border">
			<MonitorRow
				name="Draft Member"
				email="draft@example.com"
				status="draft"
				effectiveMethod="email"
			/>
			<MonitorRow
				name="Invited via Email"
				email="invited@example.com"
				status="invited"
				effectiveMethod="email"
				lastInviteAt={Date.now() - 120_000}
				onResend={() => {}}
				onChangeMethod={() => {}}
				onSimulateAccept={() => {}}
			/>
			<MonitorRow
				name="Invited via Code"
				status="invited"
				effectiveMethod="access_code"
				accessCode="TESTCODE"
				lastInviteAt={Date.now() - 3_600_000}
				onResend={() => {}}
				onChangeMethod={() => {}}
				onSimulateAccept={() => {}}
			/>
			<MonitorRow
				name="Accepted Member"
				email="accepted@example.com"
				status="accepted"
				effectiveMethod="email"
				onApprove={() => {}}
				onReject={() => {}}
			/>
			<MonitorRow
				name="Approved Member"
				email="approved@example.com"
				status="approved"
				effectiveMethod="email"
			/>
			<MonitorRow
				name="Rejected Member"
				email="rejected@example.com"
				status="rejected"
				effectiveMethod="email"
			/>
		</div>
	),
};

export const BulkApprovalContext: Story = {
	render: () => (
		<div className="border">
			<MonitorRow
				name="Alice Johnson"
				email="alice@example.com"
				status="accepted"
				effectiveMethod="email"
				onApprove={() => {}}
				onReject={() => {}}
			/>
			<MonitorRow
				name="Bob Williams"
				phone="+1 555-0200"
				status="accepted"
				effectiveMethod="phone"
				onApprove={() => {}}
				onReject={() => {}}
			/>
			<MonitorRow
				name="Charlie Brown"
				email="charlie@example.com"
				status="accepted"
				effectiveMethod="email"
				onApprove={() => {}}
				onReject={() => {}}
			/>
			<MonitorRow
				name="Diana Prince"
				status="accepted"
				effectiveMethod="access_code"
				onApprove={() => {}}
				onReject={() => {}}
			/>
		</div>
	),
};
