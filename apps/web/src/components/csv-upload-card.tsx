import { api } from "@onboarding-flow/backend/convex/_generated/api";
import { useAction } from "convex/react";
import Papa from "papaparse";
import { useRef, useState } from "react";
import {
	type ColumnMapping,
	ColumnMappingCard,
} from "@/components/column-mapping-card";
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

type CardState = "idle" | "mapping" | "previewing" | "submitting";

const STANDARD_HEADERS = ["name", "email", "phone"];

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

function normalizeHeader(h: string): string {
	return h.trim().toLowerCase();
}

function headersMatchStandard(headers: string[]): boolean {
	const normalized = headers.map(normalizeHeader);
	return STANDARD_HEADERS.every((h) => normalized.includes(h));
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

function applyMapping(
	rawRows: Record<string, string>[],
	mappings: ColumnMapping[],
): Record<string, string>[] {
	const firstNameCol = mappings.find((m) => m.targetField === "first_name")?.sourceColumn;
	const lastNameCol = mappings.find((m) => m.targetField === "last_name")?.sourceColumn;

	return rawRows.map((raw) => {
		const mapped: Record<string, string> = {};
		for (const m of mappings) {
			if (m.targetField === "first_name" || m.targetField === "last_name") {
				// Handled below as combined name
				continue;
			}
			if (m.targetField !== "skip") {
				mapped[m.targetField] = raw[m.sourceColumn] ?? "";
			}
		}

		// Combine first_name + last_name into name
		if (firstNameCol || lastNameCol) {
			const first = (firstNameCol ? raw[firstNameCol] : "")?.trim() ?? "";
			const last = (lastNameCol ? raw[lastNameCol] : "")?.trim() ?? "";
			mapped.name = [first, last].filter(Boolean).join(" ");
		}

		return mapped;
	});
}

export function CsvUploadCard({
	existingMembers,
	onConfirm,
	onCancel,
}: CsvUploadCardProps) {
	const [state, setState] = useState<CardState>("idle");
	const [parsed, setParsed] = useState<ParsedRow[]>([]);
	const [rawHeaders, setRawHeaders] = useState<string[]>([]);
	const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
	const [aiMappings, setAiMappings] = useState<ColumnMapping[] | null>(null);
	const [mappingLoading, setMappingLoading] = useState(false);
	const [mappingError, setMappingError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const mapColumns = useAction(api.ai.mapColumns);

	function processRows(rows: Record<string, string>[]) {
		const parsedRows: ParsedRow[] = rows.map((raw, index) => {
			const { row, errors } = validateRow(raw);
			const duplicate = checkDuplicate(row, existingMembers);
			return { index, row, errors, duplicate, selected: errors.length === 0 };
		});
		setParsed(parsedRows);
		setState("previewing");
	}

	function parseCsvText(text: string) {
		const result = Papa.parse<Record<string, string>>(text, {
			header: true,
			skipEmptyLines: true,
		});

		const headers = result.meta.fields ?? [];
		setRawHeaders(headers);
		setRawRows(result.data);

		if (headersMatchStandard(headers)) {
			processRows(result.data);
		} else {
			setState("mapping");
			setMappingLoading(true);
			setMappingError(null);

			const sampleData = result.data
				.slice(0, 5)
				.map((row) => headers.map((h) => row[h] ?? ""));

			mapColumns({ headers, sampleRows: sampleData })
				.then((res) => {
					if (res.ok) {
						setAiMappings(res.mappings);
					} else {
						if (res.code === "NO_API_KEY") {
							setMappingError(
								"AI features require an API key. Please configure ANTHROPIC_API_KEY in the Convex dashboard.",
							);
						} else {
							setMappingError(res.message);
						}
					}
				})
				.catch(() => {
					setMappingError("Failed to get AI column suggestions.");
				})
				.finally(() => setMappingLoading(false));
		}
	}

	function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		const ext = file.name.split(".").pop()?.toLowerCase();

		if (ext === "xlsx" || ext === "xls") {
			const reader = new FileReader();
			reader.onload = async (evt) => {
				const arrayBuffer = evt.target?.result as ArrayBuffer;
				const XLSX = await import("xlsx");
				const workbook = XLSX.read(arrayBuffer);
				const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
				const csvText = XLSX.utils.sheet_to_csv(firstSheet);
				parseCsvText(csvText);
			};
			reader.readAsArrayBuffer(file);
		} else {
			const reader = new FileReader();
			reader.onload = (evt) => {
				const text = evt.target?.result as string;
				parseCsvText(text);
			};
			reader.readAsText(file);
		}
	}

	function handleMappingApply(mappings: ColumnMapping[]) {
		const mapped = applyMapping(rawRows, mappings);
		processRows(mapped);
	}

	function handleUseRawHeaders() {
		// Try to use raw headers as-is
		processRows(rawRows);
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
			setRawHeaders([]);
			setRawRows([]);
			setAiMappings(null);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	function handleCancel() {
		if (state === "previewing" || state === "mapping") {
			setState("idle");
			setParsed([]);
			setRawHeaders([]);
			setRawRows([]);
			setAiMappings(null);
			setMappingError(null);
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
				<CardTitle>Upload CSV / Excel</CardTitle>
				<CardDescription>
					Import members from a CSV or Excel file with columns: name, email, phone
				</CardDescription>
			</CardHeader>
			<CardContent>
				{state === "idle" && (
					<div className="flex items-center gap-3">
						<input
							ref={fileRef}
							type="file"
							accept=".csv,.xlsx,.xls"
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

				{state === "mapping" && (
					<div className="grid gap-3">
						{mappingError && (
							<p className="text-sm text-yellow-600">{mappingError}</p>
						)}
						<ColumnMappingCard
							headers={rawHeaders}
							sampleRows={rawRows
								.slice(0, 3)
								.map((row) => rawHeaders.map((h) => row[h] ?? ""))}
							aiMappings={aiMappings}
							isLoading={mappingLoading}
							onApply={handleMappingApply}
							onUseRawHeaders={handleUseRawHeaders}
						/>
						<Button variant="ghost" size="sm" onClick={handleCancel}>
							Back
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
