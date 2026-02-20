import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PassCard } from "@/components/pass-card";
import { PassForm } from "@/components/pass-form";
import { SetupSuggestionCard } from "@/components/setup-suggestion-card";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StepDefinePassesProps {
	tenantId: Id<"tenants">;
	onNext: () => void;
}

export function StepDefinePasses({ tenantId, onNext }: StepDefinePassesProps) {
	const passes = useQuery(api.passes.listByTenant, { tenantId });
	const createPass = useMutation(api.passes.create);
	const updatePass = useMutation(api.passes.update);
	const removePass = useMutation(api.passes.remove);

	const [showForm, setShowForm] = useState(false);
	const [showSetupImport, setShowSetupImport] = useState(false);
	const [editingPassId, setEditingPassId] = useState<Id<"passes"> | null>(null);

	const hasAtLeastOnePass = passes && passes.length > 0;

	async function handleCreate(values: {
		name: string;
		description: string;
		targetMemberCount: number;
	}) {
		await createPass({ tenantId, ...values });
		toast.success(`Pass "${values.name}" created.`);
		setShowForm(false);
	}

	async function handleUpdate(
		passId: Id<"passes">,
		values: {
			name: string;
			description: string;
			targetMemberCount: number;
		},
	) {
		await updatePass({ passId, ...values });
		toast.success("Pass updated.");
		setEditingPassId(null);
	}

	async function handleDelete(passId: Id<"passes">) {
		const result = await removePass({ passId });
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
				{!showForm && !showSetupImport && (
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => setShowSetupImport(true)}>
							<FileText className="mr-1.5 h-4 w-4" />
							Setup from Document
						</Button>
						<Button onClick={() => setShowForm(true)}>Add Pass</Button>
					</div>
				)}
			</div>

			{showSetupImport && (
				<SetupSuggestionCard
					tenantId={tenantId}
					onComplete={() => setShowSetupImport(false)}
					onCancel={() => setShowSetupImport(false)}
				/>
			)}

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
						billingType={pass.billingType}
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
