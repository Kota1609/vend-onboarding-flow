import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InviteRow } from "@/components/invite-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { InviteMethod } from "@/lib/types";

interface StepSendInvitesProps {
	tenantId: Id<"tenants">;
	onNext: () => void;
}

export function StepSendInvites({ tenantId, onNext }: StepSendInvitesProps) {
	const passes = useQuery(api.passes.listByTenant, { tenantId });
	const [selectedPassId, setSelectedPassId] = useState<Id<"passes"> | null>(
		null,
	);
	const [sendingMemberId, setSendingMemberId] = useState<Id<"members"> | null>(
		null,
	);
	const [isBulkSending, setIsBulkSending] = useState(false);

	const members = useQuery(
		api.members.getByPass,
		selectedPassId ? { passId: selectedPassId } : "skip",
	);

	const sendInvite = useMutation(api.members.sendInvite);
	const sendBulkInvites = useMutation(api.members.sendBulkInvites);
	const resendInvite = useMutation(api.members.resendInvite);
	const changeInviteMethod = useMutation(api.members.changeInviteMethod);
	const updateMember = useMutation(api.members.update);

	useEffect(() => {
		if (passes && passes.length > 0 && !selectedPassId) {
			setSelectedPassId(passes[0]._id);
		}
	}, [passes, selectedPassId]);

	const draftMembers = members?.filter((m) => m.status === "draft") ?? [];
	const invitedMembers = members?.filter((m) => m.status === "invited") ?? [];
	const acceptedMembers = members?.filter((m) => m.status === "accepted") ?? [];
	const approvedMembers = members?.filter((m) => m.status === "approved") ?? [];
	const rejectedMembers = members?.filter((m) => m.status === "rejected") ?? [];

	async function handleSendOne(memberId: Id<"members">) {
		setSendingMemberId(memberId);
		try {
			const result = await sendInvite({
				memberId,
			});
			if (result.ok) {
				toast.success("Invite sent.");
			} else {
				toast.error(result.message);
			}
		} finally {
			setSendingMemberId(null);
		}
	}

	async function handleSendAll() {
		if (draftMembers.length === 0) return;
		setIsBulkSending(true);
		try {
			const result = await sendBulkInvites({
				memberIds: draftMembers.map((m) => m._id),
			});
			if (result.ok) {
				const successCount = result.results.filter((r) => r.ok).length;
				const failCount = result.results.filter((r) => !r.ok).length;
				if (failCount > 0) {
					toast.success(`Sent ${successCount} invites (${failCount} failed).`);
				} else {
					toast.success(`Sent ${successCount} invites.`);
				}
			}
		} finally {
			setIsBulkSending(false);
		}
	}

	async function handleResend(memberId: Id<"members">) {
		const result = await resendInvite({
			memberId,
		});
		if (result.ok) {
			toast.success("Invite resent.");
		} else {
			toast.error(result.message);
		}
	}

	async function handleChangeMethod(
		memberId: Id<"members">,
		method: InviteMethod,
		memberStatus: string,
	) {
		if (memberStatus === "invited") {
			const result = await changeInviteMethod({
				memberId,
				method,
			});
			if (result.ok) {
				toast.success("Invite method changed.");
			} else {
				toast.error(result.message);
			}
		} else {
			const result = await updateMember({
				memberId,
				inviteOverrideMethod: method,
			});
			if (result.ok) {
				toast.success("Invite method updated.");
			} else {
				toast.error(result.message);
			}
		}
	}

	if (passes === undefined) {
		return (
			<div className="grid gap-3">
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}

	return (
		<div className="grid gap-6">
			<div>
				<h2 className="font-semibold text-lg">Send Invites</h2>
				<p className="text-muted-foreground text-sm">
					Send invitations to your members via email, phone, or access code.
				</p>
			</div>

			{/* Pass selector pills */}
			<div className="flex flex-wrap gap-2">
				{passes.map((pass) => (
					<Button
						key={pass._id}
						variant={selectedPassId === pass._id ? "default" : "outline"}
						size="sm"
						onClick={() => setSelectedPassId(pass._id)}
					>
						{pass.name} ({pass.statusBreakdown.draft} draft / {pass.memberCount}{" "}
						total)
					</Button>
				))}
			</div>

			{selectedPassId && members && (
				<>
					{/* Status summary card */}
					<Card>
						<CardContent className="flex flex-wrap gap-4 py-3">
							<span className="text-sm">
								<strong>{draftMembers.length}</strong> ready to send
							</span>
							<span className="text-sm">
								<strong>{invitedMembers.length}</strong> invited
							</span>
							<span className="text-sm">
								<strong>{acceptedMembers.length}</strong> accepted
							</span>
							<span className="text-sm">
								<strong>{approvedMembers.length}</strong> approved
							</span>
							<span className="text-sm">
								<strong>{rejectedMembers.length}</strong> rejected
							</span>
						</CardContent>
					</Card>

					{/* Bulk action bar */}
					{draftMembers.length > 0 && (
						<div className="flex items-center justify-between rounded-lg border p-3">
							<span className="text-sm">
								{draftMembers.length} member
								{draftMembers.length !== 1 ? "s" : ""} ready to invite
							</span>
							<Button onClick={handleSendAll} disabled={isBulkSending}>
								{isBulkSending
									? "Sending..."
									: `Send All Invites (${draftMembers.length})`}
							</Button>
						</div>
					)}

					{/* InviteRow list */}
					{members.length > 0 && (
						<div className="overflow-hidden rounded-lg border">
							{members.map((member) => (
								<InviteRow
									key={member._id}
									name={member.name}
									email={member.email}
									phone={member.phone}
									accessCode={member.accessCode}
									status={member.status}
									effectiveMethod={member.effectiveMethod}
									lastInviteAt={member.lastInviteAt}
									onSend={() => handleSendOne(member._id)}
									onResend={() => handleResend(member._id)}
									onChangeMethod={(method) =>
										handleChangeMethod(member._id, method, member.status)
									}
									isSending={sendingMemberId === member._id || isBulkSending}
								/>
							))}
						</div>
					)}

					{/* Empty state */}
					{members.length === 0 && (
						<Card>
							<CardContent className="py-8 text-center">
								<p className="text-muted-foreground">
									No members in this pass. Add members in the previous step.
								</p>
							</CardContent>
						</Card>
					)}
				</>
			)}

			{/* Continue button */}
			<div className="flex justify-end">
				<Button onClick={onNext}>Continue to Monitor & Approve</Button>
			</div>
		</div>
	);
}
