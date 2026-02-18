import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsSubmitting(true);

		const form = e.currentTarget;
		const formData = new FormData(form);

		const name = (formData.get("name") as string).trim();
		const email = (formData.get("email") as string).trim();
		const phone = (formData.get("phone") as string).trim();

		if (!name) {
			setIsSubmitting(false);
			return;
		}

		try {
			await onSubmit({
				name,
				email: email || undefined,
				phone: phone || undefined,
			});
			if (!initialValues) form.reset();
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
			<div className="grid gap-1.5 sm:col-span-2">
				<Label htmlFor="member-name">Name *</Label>
				<Input
					id="member-name"
					name="name"
					placeholder="Jane Doe"
					defaultValue={initialValues?.name}
					required
				/>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor="member-email">Email</Label>
				<Input
					id="member-email"
					name="email"
					type="email"
					placeholder="jane@example.com"
					defaultValue={initialValues?.email}
				/>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor="member-phone">Phone</Label>
				<Input
					id="member-phone"
					name="phone"
					type="tel"
					placeholder="+1 555-0100"
					defaultValue={initialValues?.phone}
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
