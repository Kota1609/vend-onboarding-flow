import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MonitorRow } from "@/components/monitor-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { InviteMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StepMonitorApproveProps {
	tenantId: Id<"tenants">;
}

export function StepMonitorApprove({ tenantId }: StepMonitorApproveProps) {
	const passes = useQuery(api.passes.listByTenant, { tenantId });
	const [selectedPassId, setSelectedPassId] = useState<Id<"passes"> | null>(
		null,
	);
	const [loadingMemberId, setLoadingMemberId] = useState<Id<"members"> | null>(
		null,
	);
	const [isBulkApproving, setIsBulkApproving] = useState(false);

	const members = useQuery(
		api.members.getByPass,
		selectedPassId ? { passId: selectedPassId } : "skip",
	);

	const acceptInvite = useMutation(api.members.acceptInvite);
	const approveInvite = useMutation(api.members.approveInvite);
	const rejectInvite = useMutation(api.members.rejectInvite);
	const resendInvite = useMutation(api.members.resendInvite);
	const changeInviteMethod = useMutation(api.members.changeInviteMethod);

	useEffect(() => {
		if (passes && passes.length > 0 && !selectedPassId) {
			setSelectedPassId(passes[0]._id);
		}
	}, [passes, selectedPassId]);

	const acceptedMembers = members?.filter((m) => m.status === "accepted") ?? [];

	const selectedPass = passes?.find((p) => p._id === selectedPassId);

	const allPassesComplete =
		passes &&
		passes.length > 0 &&
		passes.every((p) => p.statusBreakdown.approved >= p.targetMemberCount);

	async function handleSimulateAccept(memberId: Id<"members">) {
		setLoadingMemberId(memberId);
		try {
			const result = await acceptInvite({
				memberId,
			});
			if (result.ok) {
				toast.success("Member accepted (simulated).");
			} else {
				toast.error(result.message);
			}
		} catch {
			toast.error("Failed to simulate accept.");
		} finally {
			setLoadingMemberId(null);
		}
	}

	async function handleApprove(memberId: Id<"members">) {
		setLoadingMemberId(memberId);
		try {
			const result = await approveInvite({
				memberId,
			});
			if (result.ok) {
				toast.success("Member approved.");
			} else {
				toast.error(result.message);
			}
		} catch {
			toast.error("Failed to approve member.");
		} finally {
			setLoadingMemberId(null);
		}
	}

	async function handleReject(memberId: Id<"members">) {
		setLoadingMemberId(memberId);
		try {
			const result = await rejectInvite({
				memberId,
			});
			if (result.ok) {
				toast.success("Member rejected.");
			} else {
				toast.error(result.message);
			}
		} catch {
			toast.error("Failed to reject member.");
		} finally {
			setLoadingMemberId(null);
		}
	}

	async function handleApproveAll() {
		if (acceptedMembers.length === 0) return;
		setIsBulkApproving(true);
		try {
			let successCount = 0;
			let failCount = 0;
			for (const member of acceptedMembers) {
				try {
					const result = await approveInvite({
						memberId: member._id,
					});
					if (result.ok) {
						successCount++;
					} else {
						failCount++;
					}
				} catch {
					failCount++;
				}
			}
			if (failCount === 0) {
				toast.success(`Approved ${successCount} members.`);
			} else if (successCount > 0) {
				toast.success(
					`Approved ${successCount} members (${failCount} failed).`,
				);
			} else {
				toast.error("Failed to approve members.");
			}
		} finally {
			setIsBulkApproving(false);
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
	) {
		const result = await changeInviteMethod({
			memberId,
			method,
		});
		if (result.ok) {
			toast.success("Invite method changed.");
		} else {
			toast.error(result.message);
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
				<h2 className="font-semibold text-lg">Monitor & Approve</h2>
				<p className="text-muted-foreground text-sm">
					Track invite progress, simulate member acceptance, and approve or
					reject members.
				</p>
			</div>

			{/* Completion alert */}
			{allPassesComplete && (
				<Card className="border-green-500/30 bg-green-500/5">
					<CardContent className="py-4">
						<p className="font-medium text-green-700 text-sm dark:text-green-400">
							Onboarding Complete — all passes have reached their target member
							count.
						</p>
					</CardContent>
				</Card>
			)}

			{/* Pass selector pills */}
			<div className="flex flex-wrap gap-2">
				{passes.map((pass) => (
					<Button
						key={pass._id}
						variant={selectedPassId === pass._id ? "default" : "outline"}
						size="sm"
						onClick={() => setSelectedPassId(pass._id)}
					>
						{pass.name} ({pass.statusBreakdown.approved}/
						{pass.targetMemberCount})
					</Button>
				))}
			</div>

			{selectedPassId && selectedPass && members && (
				<>
					{/* Progress card */}
					<Card>
						<CardContent className="grid gap-3 py-3">
							{(() => {
								const approved = selectedPass.statusBreakdown.approved;
								const target = selectedPass.targetMemberCount;
								const percent =
									target > 0
										? Math.min(100, Math.round((approved / target) * 100))
										: 0;
								const bd = selectedPass.statusBreakdown;
								return (
									<>
										<div>
											<div className="mb-1 flex items-baseline justify-between text-xs">
												<span className="text-muted-foreground">
													{approved}/{target} approved
												</span>
												<span className="font-medium">{percent}%</span>
											</div>
											<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
												<div
													className={cn(
														"h-full transition-all",
														percent === 100 ? "bg-green-500" : "bg-primary",
													)}
													style={{
														width: `${percent}%`,
													}}
												/>
											</div>
										</div>
										<div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
											{bd.draft > 0 && <span>{bd.draft} draft</span>}
											{bd.invited > 0 && <span>{bd.invited} invited</span>}
											{bd.accepted > 0 && (
												<span>{bd.accepted} pending approval</span>
											)}
											{bd.approved > 0 && <span>{bd.approved} approved</span>}
											{bd.rejected > 0 && <span>{bd.rejected} rejected</span>}
										</div>
									</>
								);
							})()}
						</CardContent>
					</Card>

					{/* Bulk action bar */}
					{acceptedMembers.length > 0 && (
						<div className="flex items-center justify-between rounded-lg border p-3">
							<span className="text-sm">
								{acceptedMembers.length} member
								{acceptedMembers.length !== 1 ? "s" : ""} awaiting approval
							</span>
							<Button onClick={handleApproveAll} disabled={isBulkApproving}>
								{isBulkApproving
									? "Approving..."
									: `Approve All (${acceptedMembers.length})`}
							</Button>
						</div>
					)}

					{/* MonitorRow list */}
					{members.length > 0 && (
						<div className="overflow-hidden rounded-lg border">
							{members.map((member) => (
								<MonitorRow
									key={member._id}
									name={member.name}
									email={member.email}
									phone={member.phone}
									accessCode={member.accessCode}
									status={member.status}
									effectiveMethod={member.effectiveMethod}
									lastInviteAt={member.lastInviteAt}
									onSimulateAccept={() => handleSimulateAccept(member._id)}
									onApprove={() => handleApprove(member._id)}
									onReject={() => handleReject(member._id)}
									onResend={() => handleResend(member._id)}
									onChangeMethod={(method) =>
										handleChangeMethod(member._id, method)
									}
									isLoading={loadingMemberId === member._id || isBulkApproving}
								/>
							))}
						</div>
					)}

					{/* Empty state */}
					{members.length === 0 && (
						<Card>
							<CardContent className="py-8 text-center">
								<p className="text-muted-foreground">
									No members in this pass. Add members in a previous step.
								</p>
							</CardContent>
						</Card>
					)}
				</>
			)}
		</div>
	);
}
