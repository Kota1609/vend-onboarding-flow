import { z } from "zod";

/** Accepts valid email or empty string. Transforms empty to undefined. */
const optionalEmail = z
	.union([z.string().email("Invalid email"), z.literal("")])
	.transform((val) => (val === "" ? undefined : val));

/** Accepts any string. Transforms empty/whitespace to undefined. */
const optionalString = z
	.string()
	.transform((val) => (val.trim() === "" ? undefined : val.trim()));

export const passFormSchema = z.object({
	name: z.string().min(1, "Pass name is required"),
	description: z.string().min(1, "Description is required"),
	targetMemberCount: z.coerce.number().int().min(1, "Must be at least 1"),
});
export type PassFormInput = z.input<typeof passFormSchema>;
export type PassFormValues = z.infer<typeof passFormSchema>;

export const memberFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: optionalEmail,
	phone: optionalString,
});
export type MemberFormInput = z.input<typeof memberFormSchema>;
export type MemberFormValues = z.infer<typeof memberFormSchema>;

export const tenantInviteSchema = z.object({
	companyName: z.string().min(1, "Company name is required"),
	adminName: z.string().min(1, "Admin name is required"),
	adminEmail: optionalEmail,
	adminPhone: optionalString,
});
export type TenantInviteInput = z.input<typeof tenantInviteSchema>;
export type TenantInviteValues = z.infer<typeof tenantInviteSchema>;

export const csvRowSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: optionalEmail,
	phone: optionalString,
});
export type CsvRowValues = z.infer<typeof csvRowSchema>;
