import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PassFormProps {
	initialValues?: {
		name: string;
		description: string;
		targetMemberCount: number;
	};
	onSubmit: (values: {
		name: string;
		description: string;
		targetMemberCount: number;
	}) => Promise<void>;
	onCancel?: () => void;
	submitLabel?: string;
}

export function PassForm({
	initialValues,
	onSubmit,
	onCancel,
	submitLabel = "Create Pass",
}: PassFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsSubmitting(true);

		const form = e.currentTarget;
		const formData = new FormData(form);

		const name = formData.get("name") as string;
		const description = formData.get("description") as string;
		const targetMemberCount = Number(formData.get("targetMemberCount"));

		if (!name || !description || targetMemberCount < 1) {
			setIsSubmitting(false);
			return;
		}

		try {
			await onSubmit({ name, description, targetMemberCount });
			if (!initialValues) form.reset();
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
			<div className="grid gap-1.5">
				<Label htmlFor="pass-name">Pass Name *</Label>
				<Input
					id="pass-name"
					name="name"
					placeholder="Executive Reserved"
					defaultValue={initialValues?.name}
					required
				/>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor="pass-target">Target Member Count *</Label>
				<Input
					id="pass-target"
					name="targetMemberCount"
					type="number"
					min={1}
					placeholder="10"
					defaultValue={initialValues?.targetMemberCount}
					required
				/>
			</div>
			<div className="grid gap-1.5 sm:col-span-2">
				<Label htmlFor="pass-description">Description *</Label>
				<Input
					id="pass-description"
					name="description"
					placeholder="Reserved spots for C-suite and senior leadership"
					defaultValue={initialValues?.description}
					required
				/>
			</div>
			<div className="flex gap-2 sm:col-span-2">
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Saving..." : submitLabel}
				</Button>
				{onCancel && (
					<Button type="button" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				)}
			</div>
		</form>
	);
}
