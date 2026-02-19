import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CsvUploadCard } from "@/components/csv-upload-card";
import { InviteRow } from "@/components/invite-row";
import { MemberForm } from "@/components/member-form";
import { MemberRow } from "@/components/member-row";
import { MonitorRow } from "@/components/monitor-row";
import { PassCard } from "@/components/pass-card";
import { PassForm } from "@/components/pass-form";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

const STEPS = [
	{ label: "Define Passes", description: "Create pass types" },
	{ label: "Add Members", description: "Add people to passes" },
	{ label: "Send Invites", description: "Invite members" },
	{ label: "Monitor & Approve", description: "Track progress" },
] as const;

function OnboardingPage() {
	const { role, tenantId } = useAuth();
	const [currentStep, setCurrentStep] = useState(0);

	if (role !== "tenant_admin" || !tenantId) {
		return (
			<div className="p-6">
				<p className="text-muted-foreground">
					Switch to a Tenant Admin role to access onboarding.
				</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl p-6">
			<div className="mb-8">
				<h1 className="font-bold text-2xl">Onboarding</h1>
				<p className="mt-1 text-muted-foreground">
					Set up parking passes and onboard your members.
				</p>
			</div>

			{/* Step indicator */}
			<StepIndicator currentStep={currentStep} />

			{/* Step content */}
			<div className="mt-8">
				{currentStep === 0 && (
					<StepDefinePasses
						tenantId={tenantId}
						onNext={() => setCurrentStep(1)}
					/>
				)}
				{currentStep === 1 && (
					<StepAddMembers
						tenantId={tenantId}
						onNext={() => setCurrentStep(2)}
					/>
				)}
				{currentStep === 2 && (
					<StepSendInvites
						tenantId={tenantId}
						onNext={() => setCurrentStep(3)}
					/>
				)}
				{currentStep === 3 && <StepMonitorApprove tenantId={tenantId} />}
			</div>

			{/* Navigation */}
			<div className="mt-8 flex justify-between">
				<Button
					variant="outline"
					onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
					disabled={currentStep === 0}
				>
					Back
				</Button>
				<Button
					onClick={() =>
						setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))
					}
					disabled={currentStep === STEPS.length - 1}
				>
					Next
				</Button>
			</div>
		</div>
	);
}

function StepIndicator({ currentStep }: { currentStep: number }) {
	return (
		<div className="flex gap-1">
			{STEPS.map((step, i) => (
				<div key={step.label} className="flex flex-1 flex-col">
					<div className="mb-2 flex items-center gap-2">
						<div
							className={cn(
								"flex h-6 w-6 shrink-0 items-center justify-center font-medium text-xs",
								i === currentStep
									? "bg-primary text-primary-foreground"
									: i < currentStep
										? "bg-primary/20 text-primary"
										: "bg-muted text-muted-foreground",
							)}
						>
							{i + 1}
						</div>
						{i < STEPS.length - 1 && (
							<div
								className={cn(
									"h-px flex-1",
									i < currentStep ? "bg-primary/40" : "bg-border",
								)}
							/>
						)}
					</div>
					<span
						className={cn(
							"text-xs",
							i === currentStep
								? "font-medium text-foreground"
								: "text-muted-foreground",
						)}
					>
						{step.label}
					</span>
				</div>
			))}
		</div>
	);
}

function StepDefinePasses({
	tenantId,
	onNext,
}: {
	tenantId: string;
	onNext: () => void;
}) {
	const passes = useQuery(api.passes.listByTenant, {
		tenantId: tenantId as Id<"tenants">,
	});
	const createPass = useMutation(api.passes.create);
	const updatePass = useMutation(api.passes.update);
	const removePass = useMutation(api.passes.remove);

	const [showForm, setShowForm] = useState(false);
	const [editingPassId, setEditingPassId] = useState<string | null>(null);

	const hasAtLeastOnePass = passes && passes.length > 0;

	async function handleCreate(values: {
		name: string;
		description: string;
		targetMemberCount: number;
	}) {
		await createPass({
			tenantId: tenantId as Id<"tenants">,
			...values,
		});
		toast.success(`Pass "${values.name}" created.`);
		setShowForm(false);
	}

	async function handleUpdate(
		passId: string,
		values: {
			name: string;
			description: string;
			targetMemberCount: number;
		},
	) {
		await updatePass({
			passId: passId as Id<"passes">,
			...values,
		});
		toast.success("Pass updated.");
		setEditingPassId(null);
	}

	async function handleDelete(passId: string) {
		const result = await removePass({
			passId: passId as Id<"passes">,
		});
		if (result.ok) {
			toast.success("Pass deleted.");
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
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-lg">Define Passes</h2>
					<p className="text-muted-foreground text-sm">
						Create parking pass types for your company.
					</p>
				</div>
				{!showForm && (
					<Button onClick={() => setShowForm(true)}>Add Pass</Button>
				)}
			</div>

			{showForm && (
				<Card>
					<CardHeader>
						<CardTitle>New Pass</CardTitle>
						<CardDescription>
							Define a pass type with a target member count.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<PassForm
							onSubmit={handleCreate}
							onCancel={() => setShowForm(false)}
						/>
					</CardContent>
				</Card>
			)}

			{passes.length === 0 && !showForm && (
				<Card>
					<CardContent className="py-8 text-center">
						<p className="text-muted-foreground">
							No passes yet. Create your first pass to get started.
						</p>
					</CardContent>
				</Card>
			)}

			{passes.map((pass) =>
				editingPassId === pass._id ? (
					<Card key={pass._id}>
						<CardHeader>
							<CardTitle>Edit Pass</CardTitle>
						</CardHeader>
						<CardContent>
							<PassForm
								initialValues={{
									name: pass.name,
									description: pass.description,
									targetMemberCount: pass.targetMemberCount,
								}}
								onSubmit={(values) => handleUpdate(pass._id, values)}
								onCancel={() => setEditingPassId(null)}
								submitLabel="Save Changes"
							/>
						</CardContent>
					</Card>
				) : (
					<PassCard
						key={pass._id}
						name={pass.name}
						description={pass.description}
						targetMemberCount={pass.targetMemberCount}
						memberCount={pass.memberCount}
						statusBreakdown={pass.statusBreakdown}
						onEdit={() => setEditingPassId(pass._id)}
						onDelete={() => handleDelete(pass._id)}
					/>
				),
			)}

			{hasAtLeastOnePass && (
				<div className="flex justify-end">
					<Button onClick={onNext}>Continue to Add Members</Button>
				</div>
			)}
		</div>
	);
}

function StepAddMembers({
	tenantId,
	onNext,
}: {
	tenantId: string;
	onNext: () => void;
}) {
	const passes = useQuery(api.passes.listByTenant, {
		tenantId: tenantId as Id<"tenants">,
	});
	const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [showCsv, setShowCsv] = useState(false);
	const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

	const members = useQuery(
		api.members.getByPass,
		selectedPassId ? { passId: selectedPassId as Id<"passes"> } : "skip",
	);

	const createMember = useMutation(api.members.create);
	const updateMember = useMutation(api.members.update);
	const removeMember = useMutation(api.members.remove);
	const createBulk = useMutation(api.members.createBulk);

	// Auto-select first pass
	useEffect(() => {
		if (passes && passes.length > 0 && !selectedPassId) {
			setSelectedPassId(passes[0]._id);
		}
	}, [passes, selectedPassId]);

	const totalMemberCount =
		passes?.reduce((sum, p) => sum + p.memberCount, 0) ?? 0;

	async function handleCreate(values: {
		name: string;
		email?: string;
		phone?: string;
	}) {
		if (!selectedPassId) return;
		const result = await createMember({
			tenantId: tenantId as Id<"tenants">,
			passId: selectedPassId as Id<"passes">,
			...values,
		});
		if (result.ok) {
			toast.success(`Member "${values.name}" added.`);
			setShowForm(false);
		} else {
			toast.error(result.message);
		}
	}

	async function handleUpdate(
		memberId: string,
		values: { name: string; email?: string; phone?: string },
	) {
		const result = await updateMember({
			memberId: memberId as Id<"members">,
			...values,
		});
		if (result.ok) {
			toast.success("Member updated.");
			setEditingMemberId(null);
		} else {
			toast.error(result.message);
		}
	}

	async function handleDelete(memberId: string) {
		const result = await removeMember({
			memberId: memberId as Id<"members">,
		});
		if (result.ok) {
			toast.success("Member deleted.");
		} else {
			toast.error(result.message);
		}
	}

	async function handleBulkImport(
		rows: Array<{ name: string; email?: string; phone?: string }>,
	) {
		if (!selectedPassId) return;
		const result = await createBulk({
			tenantId: tenantId as Id<"tenants">,
			passId: selectedPassId as Id<"passes">,
			rows,
		});
		if (result.ok) {
			toast.success(
				`Imported ${result.successCount} members${result.failCount > 0 ? ` (${result.failCount} failed)` : ""}.`,
			);
			setShowCsv(false);
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
				<h2 className="font-semibold text-lg">Add Members</h2>
				<p className="text-muted-foreground text-sm">
					Add people to your passes manually or via CSV upload.
				</p>
			</div>

			{/* Pass selector pills */}
			<div className="flex flex-wrap gap-2">
				{passes.map((pass) => (
					<Button
						key={pass._id}
						variant={selectedPassId === pass._id ? "default" : "outline"}
						size="sm"
						onClick={() => {
							setSelectedPassId(pass._id);
							setShowForm(false);
							setShowCsv(false);
							setEditingMemberId(null);
						}}
					>
						{pass.name} ({pass.memberCount})
					</Button>
				))}
			</div>

			{selectedPassId && (
				<>
					{/* Action buttons */}
					{!showForm && !showCsv && (
						<div className="flex gap-2">
							<Button onClick={() => setShowForm(true)}>Add Member</Button>
							<Button variant="outline" onClick={() => setShowCsv(true)}>
								Upload CSV
							</Button>
						</div>
					)}

					{/* Inline add form */}
					{showForm && (
						<Card>
							<CardHeader>
								<CardTitle>New Member</CardTitle>
								<CardDescription>Add a member to this pass.</CardDescription>
							</CardHeader>
							<CardContent>
								<MemberForm
									onSubmit={handleCreate}
									onCancel={() => setShowForm(false)}
								/>
							</CardContent>
						</Card>
					)}

					{/* CSV upload card */}
					{showCsv && (
						<CsvUploadCard
							existingMembers={members ?? []}
							onConfirm={handleBulkImport}
							onCancel={() => setShowCsv(false)}
						/>
					)}

					{/* Member list */}
					{members && members.length > 0 && (
						<div className="border">
							{members.map((member) =>
								editingMemberId === member._id ? (
									<div
										key={member._id}
										className="border-b p-3 last:border-b-0"
									>
										<MemberForm
											initialValues={{
												name: member.name,
												email: member.email,
												phone: member.phone,
											}}
											onSubmit={(values) => handleUpdate(member._id, values)}
											onCancel={() => setEditingMemberId(null)}
											submitLabel="Save Changes"
										/>
									</div>
								) : (
									<MemberRow
										key={member._id}
										name={member.name}
										email={member.email}
										phone={member.phone}
										status={
											member.status as
												| "draft"
												| "invited"
												| "accepted"
												| "approved"
												| "rejected"
										}
										effectiveMethod={
											member.effectiveMethod as
												| "email"
												| "phone"
												| "access_code"
										}
										onEdit={() => setEditingMemberId(member._id)}
										onDelete={() => handleDelete(member._id)}
									/>
								),
							)}
						</div>
					)}

					{/* Empty state */}
					{members && members.length === 0 && !showForm && !showCsv && (
						<Card>
							<CardContent className="py-8 text-center">
								<p className="text-muted-foreground">
									No members yet. Add members manually or upload a CSV.
								</p>
							</CardContent>
						</Card>
					)}
				</>
			)}

			{/* Continue button */}
			{totalMemberCount > 0 && (
				<div className="flex justify-end">
					<Button onClick={onNext}>Continue to Send Invites</Button>
				</div>
			)}
		</div>
	);
}

function StepSendInvites({
	tenantId,
	onNext,
}: {
	tenantId: string;
	onNext: () => void;
}) {
	const passes = useQuery(api.passes.listByTenant, {
		tenantId: tenantId as Id<"tenants">,
	});
	const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
	const [sendingMemberId, setSendingMemberId] = useState<string | null>(null);
	const [isBulkSending, setIsBulkSending] = useState(false);

	const members = useQuery(
		api.members.getByPass,
		selectedPassId ? { passId: selectedPassId as Id<"passes"> } : "skip",
	);

	const sendInvite = useMutation(api.members.sendInvite);
	const sendBulkInvites = useMutation(api.members.sendBulkInvites);
	const resendInvite = useMutation(api.members.resendInvite);
	const changeInviteMethod = useMutation(api.members.changeInviteMethod);
	const updateMember = useMutation(api.members.update);

	// Auto-select first pass
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

	async function handleSendOne(memberId: string) {
		setSendingMemberId(memberId);
		try {
			const result = await sendInvite({
				memberId: memberId as Id<"members">,
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
				memberIds: draftMembers.map((m) => m._id as Id<"members">),
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

	async function handleResend(memberId: string) {
		const result = await resendInvite({
			memberId: memberId as Id<"members">,
		});
		if (result.ok) {
			toast.success("Invite resent.");
		} else {
			toast.error(result.message);
		}
	}

	async function handleChangeMethod(
		memberId: string,
		method: "email" | "phone" | "access_code",
		memberStatus: string,
	) {
		if (memberStatus === "invited") {
			const result = await changeInviteMethod({
				memberId: memberId as Id<"members">,
				method,
			});
			if (result.ok) {
				toast.success("Invite method changed.");
			} else {
				toast.error(result.message);
			}
		} else {
			// draft — use update with inviteOverrideMethod
			const result = await updateMember({
				memberId: memberId as Id<"members">,
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
						<div className="flex items-center justify-between border p-3">
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
						<div className="border">
							{members.map((member) => (
								<InviteRow
									key={member._id}
									name={member.name}
									email={member.email}
									phone={member.phone}
									accessCode={member.accessCode}
									status={
										member.status as
											| "draft"
											| "invited"
											| "accepted"
											| "approved"
											| "rejected"
									}
									effectiveMethod={
										member.effectiveMethod as "email" | "phone" | "access_code"
									}
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

			{/* Continue button — always visible, no gate */}
			<div className="flex justify-end">
				<Button onClick={onNext}>Continue to Monitor & Approve</Button>
			</div>
		</div>
	);
}

function StepMonitorApprove({ tenantId }: { tenantId: string }) {
	const passes = useQuery(api.passes.listByTenant, {
		tenantId: tenantId as Id<"tenants">,
	});
	const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
	const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
	const [isBulkApproving, setIsBulkApproving] = useState(false);

	const members = useQuery(
		api.members.getByPass,
		selectedPassId ? { passId: selectedPassId as Id<"passes"> } : "skip",
	);

	const acceptInvite = useMutation(api.members.acceptInvite);
	const approveInvite = useMutation(api.members.approveInvite);
	const rejectInvite = useMutation(api.members.rejectInvite);
	const resendInvite = useMutation(api.members.resendInvite);
	const changeInviteMethod = useMutation(api.members.changeInviteMethod);

	// Auto-select first pass
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

	async function handleSimulateAccept(memberId: string) {
		setLoadingMemberId(memberId);
		try {
			const result = await acceptInvite({
				memberId: memberId as Id<"members">,
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

	async function handleApprove(memberId: string) {
		setLoadingMemberId(memberId);
		try {
			const result = await approveInvite({
				memberId: memberId as Id<"members">,
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

	async function handleReject(memberId: string) {
		setLoadingMemberId(memberId);
		try {
			const result = await rejectInvite({
				memberId: memberId as Id<"members">,
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
						memberId: member._id as Id<"members">,
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

	async function handleResend(memberId: string) {
		const result = await resendInvite({
			memberId: memberId as Id<"members">,
		});
		if (result.ok) {
			toast.success("Invite resent.");
		} else {
			toast.error(result.message);
		}
	}

	async function handleChangeMethod(
		memberId: string,
		method: "email" | "phone" | "access_code",
	) {
		const result = await changeInviteMethod({
			memberId: memberId as Id<"members">,
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
											<div className="h-1.5 w-full overflow-hidden bg-muted">
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
						<div className="flex items-center justify-between border p-3">
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
						<div className="border">
							{members.map((member) => (
								<MonitorRow
									key={member._id}
									name={member.name}
									email={member.email}
									phone={member.phone}
									accessCode={member.accessCode}
									status={
										member.status as
											| "draft"
											| "invited"
											| "accepted"
											| "approved"
											| "rejected"
									}
									effectiveMethod={
										member.effectiveMethod as "email" | "phone" | "access_code"
									}
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
