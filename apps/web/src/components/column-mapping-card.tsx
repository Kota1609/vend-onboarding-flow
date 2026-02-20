import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export type TargetField = "name" | "first_name" | "last_name" | "email" | "phone" | "skip";

export interface ColumnMapping {
	sourceColumn: string;
	targetField: TargetField;
	confidence: "high" | "medium" | "low";
	reasoning: string;
}

interface ColumnMappingCardProps {
	headers: string[];
	sampleRows: string[][];
	aiMappings: ColumnMapping[] | null;
	isLoading: boolean;
	onApply: (mappings: ColumnMapping[]) => void;
	onUseRawHeaders: () => void;
}

const CONFIDENCE_STYLES = {
	high: "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
	medium:
		"bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
	low: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
} as const;

const TARGET_OPTIONS: { value: TargetField; label: string }[] = [
	{ value: "name", label: "Name" },
	{ value: "first_name", label: "First Name" },
	{ value: "last_name", label: "Last Name" },
	{ value: "email", label: "Email" },
	{ value: "phone", label: "Phone" },
	{ value: "skip", label: "Skip" },
];

export function ColumnMappingCard({
	headers,
	sampleRows,
	aiMappings,
	isLoading,
	onApply,
	onUseRawHeaders,
}: ColumnMappingCardProps) {
	const [mappings, setMappings] = useState<ColumnMapping[]>(
		() =>
			aiMappings ??
			headers.map((h) => ({
				sourceColumn: h,
				targetField: "skip" as TargetField,
				confidence: "low" as const,
				reasoning: "No AI suggestion available",
			})),
	);

	// Sync with AI mappings when they arrive
	useEffect(() => {
		if (aiMappings) {
			setMappings(aiMappings);
		}
	}, [aiMappings]);

	function updateMapping(index: number, targetField: TargetField) {
		setMappings((prev) =>
			prev.map((m, i) =>
				i === index
					? {
							...m,
							targetField,
							confidence: "high",
							reasoning: "Manually selected",
						}
					: m,
			),
		);
	}

	const hasName = mappings.some(
		(m) => m.targetField === "name" || m.targetField === "first_name",
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Column Mapping</CardTitle>
				<CardDescription>
					{isLoading
						? "AI is analyzing your columns..."
						: "Map your file columns to member fields. AI suggestions are pre-filled."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex items-center justify-center gap-3 py-8">
						<div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
						<span className="text-muted-foreground text-sm">
							Analyzing columns...
						</span>
					</div>
				) : (
					<div className="grid gap-4">
						{/* Mapping rows */}
						<div className="grid gap-2">
							{mappings.map((mapping, idx) => (
								<div
									key={mapping.sourceColumn}
									className="flex items-center gap-3 rounded-md border px-3 py-2"
								>
									<span className="min-w-32 truncate font-medium text-sm">
										{mapping.sourceColumn}
									</span>
									<span className="text-muted-foreground text-sm">&rarr;</span>
									<select
										className="rounded border bg-background px-2 py-1 text-sm"
										value={mapping.targetField}
										onChange={(e) =>
											updateMapping(idx, e.target.value as TargetField)
										}
									>
										{TARGET_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
									<span
										className={`inline-block rounded-full border px-2 py-0.5 font-medium text-xs ${CONFIDENCE_STYLES[mapping.confidence]}`}
									>
										{mapping.confidence}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{mapping.reasoning}
									</span>
								</div>
							))}
						</div>

						{/* Sample data preview */}
						{sampleRows.length > 0 && (
							<div className="overflow-auto rounded-lg border">
								<table className="w-full text-xs">
									<thead>
										<tr className="border-b bg-muted/50">
											{headers.map((h) => (
												<th key={h} className="px-2 py-1 text-left font-medium">
													{h}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{sampleRows.slice(0, 3).map((row, rowIdx) => (
											<tr
												key={`row-${String(rowIdx)}`}
												className="border-b last:border-b-0"
											>
												{row.map((cell, colIdx) => (
													<td
														key={`${String(rowIdx)}-${headers[colIdx] ?? String(colIdx)}`}
														className="px-2 py-1 text-muted-foreground"
													>
														{cell || "—"}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						{!hasName && (
							<p className="text-red-600 text-xs">
								A "Name" mapping is required. Please map at least one column to
								Name.
							</p>
						)}

						<div className="flex gap-2">
							<Button onClick={() => onApply(mappings)} disabled={!hasName}>
								Apply Mapping
							</Button>
							<Button variant="ghost" onClick={onUseRawHeaders}>
								Use Raw Headers
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
