import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AiImportCard } from "@/components/ai-import-card";
import { CsvUploadCard } from "@/components/csv-upload-card";
import { MemberForm } from "@/components/member-form";
import { MemberRow } from "@/components/member-row";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StepAddMembersProps {
	tenantId: Id<"tenants">;
	onNext: () => void;
}

export function StepAddMembers({ tenantId, onNext }: StepAddMembersProps) {
	const passes = useQuery(api.passes.listByTenant, { tenantId });
	const [selectedPassId, setSelectedPassId] = useState<Id<"passes"> | null>(
		null,
	);
	const [showForm, setShowForm] = useState(false);
	const [showCsv, setShowCsv] = useState(false);
	const [showAiImport, setShowAiImport] = useState(false);
	const [editingMemberId, setEditingMemberId] = useState<Id<"members"> | null>(
		null,
	);

	const members = useQuery(
		api.members.getByPass,
		selectedPassId ? { passId: selectedPassId } : "skip",
	);

	const createMember = useMutation(api.members.create);
	const updateMember = useMutation(api.members.update);
	const removeMember = useMutation(api.members.remove);
	const createBulk = useMutation(api.members.createBulk);

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
			tenantId,
			passId: selectedPassId,
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
		memberId: Id<"members">,
		values: { name: string; email?: string; phone?: string },
	) {
		const result = await updateMember({
			memberId,
			...values,
		});
		if (result.ok) {
			toast.success("Member updated.");
			setEditingMemberId(null);
		} else {
			toast.error(result.message);
		}
	}

	async function handleDelete(memberId: Id<"members">) {
		const result = await removeMember({
			memberId,
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
			tenantId,
			passId: selectedPassId,
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
					Add people to your passes manually, via CSV upload, or using AI
					document import.
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
							setShowAiImport(false);
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
					{!showForm && !showCsv && !showAiImport && (
						<div className="flex gap-2">
							<Button onClick={() => setShowForm(true)}>Add Member</Button>
							<Button variant="outline" onClick={() => setShowCsv(true)}>
								Upload CSV
							</Button>
							<Button
								variant="outline"
								onClick={() => {
									setShowAiImport(true);
									setShowForm(false);
									setShowCsv(false);
								}}
							>
								AI Import
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

					{/* AI import card */}
					{showAiImport && selectedPassId && (
						<AiImportCard
							tenantId={tenantId}
							passId={selectedPassId}
							onComplete={() => setShowAiImport(false)}
							onCancel={() => setShowAiImport(false)}
						/>
					)}

					{/* Member list */}
					{members && members.length > 0 && (
						<div className="overflow-hidden rounded-lg border">
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
										status={member.status}
										effectiveMethod={member.effectiveMethod}
										onEdit={() => setEditingMemberId(member._id)}
										onDelete={() => handleDelete(member._id)}
									/>
								),
							)}
						</div>
					)}

					{/* Empty state */}
					{members &&
						members.length === 0 &&
						!showForm &&
						!showCsv &&
						!showAiImport && (
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
