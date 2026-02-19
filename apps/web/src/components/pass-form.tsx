import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	type PassFormInput,
	type PassFormValues,
	passFormSchema,
} from "@/lib/schemas";

interface PassFormProps {
	initialValues?: PassFormValues;
	onSubmit: (values: PassFormValues) => Promise<void>;
	onCancel?: () => void;
	submitLabel?: string;
}

export function PassForm({
	initialValues,
	onSubmit,
	onCancel,
	submitLabel = "Create Pass",
}: PassFormProps) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<PassFormInput, unknown, PassFormValues>({
		resolver: zodResolver(passFormSchema),
		defaultValues: initialValues ?? {
			name: "",
			description: "",
			targetMemberCount: 1,
		},
	});

	async function onValid(values: PassFormValues) {
		await onSubmit(values);
		if (!initialValues) reset();
	}

	return (
		<form
			onSubmit={handleSubmit(onValid)}
			className="grid gap-4 sm:grid-cols-2"
		>
			<div className="grid gap-1.5">
				<Label htmlFor="pass-name">Pass Name *</Label>
				<Input
					id="pass-name"
					placeholder="Executive Reserved"
					{...register("name")}
				/>
				{errors.name && (
					<p className="text-destructive text-xs">{errors.name.message}</p>
				)}
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor="pass-target">Target Member Count *</Label>
				<Input
					id="pass-target"
					type="number"
					min={1}
					placeholder="10"
					{...register("targetMemberCount")}
				/>
				{errors.targetMemberCount && (
					<p className="text-destructive text-xs">
						{errors.targetMemberCount.message}
					</p>
				)}
			</div>
			<div className="grid gap-1.5 sm:col-span-2">
				<Label htmlFor="pass-description">Description *</Label>
				<Input
					id="pass-description"
					placeholder="Reserved spots for C-suite and senior leadership"
					{...register("description")}
				/>
				{errors.description && (
					<p className="text-destructive text-xs">
						{errors.description.message}
					</p>
				)}
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
