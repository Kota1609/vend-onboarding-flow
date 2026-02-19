import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	type MemberFormInput,
	type MemberFormValues,
	memberFormSchema,
} from "@/lib/schemas";

interface MemberFormProps {
	initialValues?: {
		name: string;
		email?: string;
		phone?: string;
	};
	onSubmit: (values: {
		name: string;
		email?: string;
		phone?: string;
	}) => Promise<void>;
	onCancel?: () => void;
	submitLabel?: string;
}

export function MemberForm({
	initialValues,
	onSubmit,
	onCancel,
	submitLabel = "Add Member",
}: MemberFormProps) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<MemberFormInput, unknown, MemberFormValues>({
		resolver: zodResolver(memberFormSchema),
		defaultValues: {
			name: initialValues?.name ?? "",
			email: initialValues?.email ?? "",
			phone: initialValues?.phone ?? "",
		},
	});

	async function onValid(values: MemberFormValues) {
		await onSubmit(values);
		if (!initialValues) reset();
	}

	return (
		<form
			onSubmit={handleSubmit(onValid)}
			className="grid gap-4 sm:grid-cols-2"
		>
			<div className="grid gap-1.5 sm:col-span-2">
				<Label htmlFor="member-name">Name *</Label>
				<Input id="member-name" placeholder="Jane Doe" {...register("name")} />
				{errors.name && (
					<p className="text-destructive text-xs">{errors.name.message}</p>
				)}
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor="member-email">Email</Label>
				<Input
					id="member-email"
					type="email"
					placeholder="jane@example.com"
					{...register("email")}
				/>
				{errors.email && (
					<p className="text-destructive text-xs">{errors.email.message}</p>
				)}
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor="member-phone">Phone</Label>
				<Input
					id="member-phone"
					type="tel"
					placeholder="+1 555-0100"
					{...register("phone")}
				/>
			</div>
			<p className="text-muted-foreground text-xs sm:col-span-2">
				Invite method auto-determined: email &gt; phone &gt; access code
			</p>
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
