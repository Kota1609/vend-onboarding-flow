import Papa from "papaparse";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { csvRowSchema } from "@/lib/schemas";

interface MemberRow {
	name: string;
	email?: string;
	phone?: string;
}

interface ExistingMember {
	_id: string;
	name: string;
	email?: string;
	phone?: string;
}

interface ParsedRow {
	index: number;
	row: MemberRow;
	errors: string[];
	duplicate?: { existingName: string; reason: "email" | "phone" };
	selected: boolean;
}

interface CsvUploadCardProps {
	existingMembers: ExistingMember[];
	onConfirm: (rows: MemberRow[]) => Promise<void>;
	onCancel: () => void;
}

type CardState = "idle" | "previewing" | "submitting";

function downloadTemplate() {
	const csv = "name,email,phone\n";
	const blob = new Blob([csv], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "members-template.csv";
	a.click();
	URL.revokeObjectURL(url);
}

function validateRow(raw: Record<string, string>): {
	row: MemberRow;
	errors: string[];
} {
	const result = csvRowSchema.safeParse({
		name: (raw.name || "").trim(),
		email: (raw.email || "").trim(),
		phone: (raw.phone || "").trim(),
	});
	if (!result.success) {
		return {
			row: { name: (raw.name || "").trim() },
			errors: result.error.issues.map((i) => i.message),
		};
	}
	return { row: result.data, errors: [] };
}

function checkDuplicate(
	row: MemberRow,
	existingMembers: ExistingMember[],
): ParsedRow["duplicate"] {
	if (row.email) {
		const emailLower = row.email.toLowerCase();
		const match = existingMembers.find(
			(m) => m.email && m.email.toLowerCase() === emailLower,
		);
		if (match) return { existingName: match.name, reason: "email" };
	}
	if (row.phone) {
		const match = existingMembers.find((m) => m.phone === row.phone);
		if (match) return { existingName: match.name, reason: "phone" };
	}
	return undefined;
}

export function CsvUploadCard({
	existingMembers,
	onConfirm,
	onCancel,
}: CsvUploadCardProps) {
	const [state, setState] = useState<CardState>("idle");
	const [parsed, setParsed] = useState<ParsedRow[]>([]);
	const fileRef = useRef<HTMLInputElement>(null);

	function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (evt) => {
			const text = evt.target?.result as string;
			const result = Papa.parse<Record<string, string>>(text, {
				header: true,
				skipEmptyLines: true,
			});

			const rows: ParsedRow[] = result.data.map((raw, index) => {
				const { row, errors } = validateRow(raw);
				const duplicate = checkDuplicate(row, existingMembers);
				return { index, row, errors, duplicate, selected: errors.length === 0 };
			});

			setParsed(rows);
			setState("previewing");
		};
		reader.readAsText(file);
	}

	function toggleRow(index: number) {
		setParsed((prev) =>
			prev.map((r) =>
				r.index === index ? { ...r, selected: !r.selected } : r,
			),
		);
	}

	async function handleConfirm() {
		setState("submitting");
		const selectedRows = parsed
			.filter((r) => r.selected && r.errors.length === 0)
			.map((r) => r.row);
		try {
			await onConfirm(selectedRows);
		} finally {
			setState("idle");
			setParsed([]);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	function handleCancel() {
		if (state === "previewing") {
			setState("idle");
			setParsed([]);
			if (fileRef.current) fileRef.current.value = "";
			return;
		}
		onCancel();
	}

	const validSelected = parsed.filter(
		(r) => r.selected && r.errors.length === 0,
	).length;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Upload CSV</CardTitle>
				<CardDescription>
					Import members from a CSV file with columns: name, email, phone
				</CardDescription>
			</CardHeader>
			<CardContent>
				{state === "idle" && (
					<div className="flex items-center gap-3">
						<input
							ref={fileRef}
							type="file"
							accept=".csv"
							onChange={handleFile}
							className="text-sm file:mr-3 file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:font-medium file:text-foreground file:text-sm"
						/>
						<Button variant="outline" size="sm" onClick={downloadTemplate}>
							Download Template
						</Button>
						<Button variant="ghost" size="sm" onClick={onCancel}>
							Cancel
						</Button>
					</div>
				)}

				{(state === "previewing" || state === "submitting") && (
					<div className="grid gap-4">
						<div className="max-h-64 overflow-auto border">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b bg-muted/50 text-left">
										<th className="px-2 py-1.5 font-medium" />
										<th className="px-2 py-1.5 font-medium">Name</th>
										<th className="px-2 py-1.5 font-medium">Email</th>
										<th className="px-2 py-1.5 font-medium">Phone</th>
										<th className="px-2 py-1.5 font-medium">Status</th>
									</tr>
								</thead>
								<tbody>
									{parsed.map((r) => (
										<tr
											key={r.index}
											className={
												r.errors.length > 0
													? "bg-red-500/5 text-muted-foreground"
													: ""
											}
										>
											<td className="px-2 py-1.5">
												{r.errors.length === 0 && (
													<input
														type="checkbox"
														checked={r.selected}
														onChange={() => toggleRow(r.index)}
														disabled={state === "submitting"}
													/>
												)}
											</td>
											<td className="px-2 py-1.5">
												{r.row.name || (
													<span className="text-muted-foreground italic">
														empty
													</span>
												)}
											</td>
											<td className="px-2 py-1.5">{r.row.email || "—"}</td>
											<td className="px-2 py-1.5">{r.row.phone || "—"}</td>
											<td className="px-2 py-1.5">
												{r.errors.length > 0 ? (
													<span className="text-red-600 text-xs">
														{r.errors.join(", ")}
													</span>
												) : r.duplicate ? (
													<span className="text-xs text-yellow-600">
														Duplicate {r.duplicate.reason} — matches{" "}
														{r.duplicate.existingName}
													</span>
												) : (
													<span className="text-green-600 text-xs">OK</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className="flex items-center justify-between">
							<p className="text-muted-foreground text-sm">
								{validSelected} of {parsed.length} rows selected
							</p>
							<div className="flex gap-2">
								<Button
									variant="ghost"
									onClick={handleCancel}
									disabled={state === "submitting"}
								>
									Back
								</Button>
								<Button
									onClick={handleConfirm}
									disabled={validSelected === 0 || state === "submitting"}
								>
									{state === "submitting"
										? "Importing..."
										: `Import ${validSelected} Members`}
								</Button>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
