import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ImportReviewTableProps {
	batchId: Id<"importBatches">;
	onConfirm: () => void;
	onCancel: () => void;
}

const CONFIDENCE_STYLES = {
	high: "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
	medium:
		"bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
	low: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
} as const;

export function ImportReviewTable({
	batchId,
	onConfirm,
	onCancel,
}: ImportReviewTableProps) {
	const data = useQuery(api.imports.getByBatch, { batchId });
	const updateRow = useMutation(api.imports.updateRow);
	const [editingRowId, setEditingRowId] = useState<Id<"importRows"> | null>(
		null,
	);
	const [editValues, setEditValues] = useState<{
		name: string;
		email: string;
		phone: string;
	}>({ name: "", email: "", phone: "" });

	if (!data) {
		return (
			<div className="py-8 text-center text-muted-foreground text-sm">
				Loading review data...
			</div>
		);
	}

	const { rows } = data;
	const acceptedCount = rows.filter((r) => r.accepted).length;
	const allSelected = rows.length > 0 && acceptedCount === rows.length;

	async function toggleAll() {
		const newValue = !allSelected;
		await Promise.all(
			rows
				.filter((r) => r.accepted !== newValue)
				.map((r) => updateRow({ rowId: r._id, accepted: newValue })),
		);
	}

	function startEdit(row: (typeof rows)[0]) {
		setEditingRowId(row._id);
		setEditValues({
			name: row.name,
			email: row.email ?? "",
			phone: row.phone ?? "",
		});
	}

	async function saveEdit(rowId: Id<"importRows">) {
		await updateRow({
			rowId,
			name: editValues.name,
			email: editValues.email || undefined,
			phone: editValues.phone || undefined,
		});
		setEditingRowId(null);
	}

	async function toggleAccepted(rowId: Id<"importRows">, current: boolean) {
		await updateRow({ rowId, accepted: !current });
	}

	return (
		<div className="grid gap-4">
			<div className="max-h-80 overflow-auto rounded-lg border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/50 text-left">
							<th className="w-8 px-2 py-1.5 font-medium">
								<input
									type="checkbox"
									checked={allSelected}
									onChange={toggleAll}
									title={allSelected ? "Deselect all" : "Select all"}
								/>
							</th>
							<th className="px-2 py-1.5 font-medium">Name</th>
							<th className="px-2 py-1.5 font-medium">Email</th>
							<th className="px-2 py-1.5 font-medium">Phone</th>
							<th className="px-2 py-1.5 font-medium">Confidence</th>
							<th className="px-2 py-1.5 font-medium">Status</th>
							<th className="w-16 px-2 py-1.5 font-medium" />
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr
								key={row._id}
								className={
									!row.accepted
										? "bg-muted/30 text-muted-foreground"
										: row.confidence === "low"
											? "bg-yellow-500/5"
											: ""
								}
							>
								<td className="px-2 py-1.5">
									<input
										type="checkbox"
										checked={row.accepted}
										onChange={() => toggleAccepted(row._id, row.accepted)}
									/>
								</td>
								{editingRowId === row._id ? (
									<>
										<td className="px-2 py-1.5">
											<input
												className="w-full rounded border bg-background px-1.5 py-0.5 text-sm"
												value={editValues.name}
												onChange={(e) =>
													setEditValues((v) => ({
														...v,
														name: e.target.value,
													}))
												}
												onBlur={() => saveEdit(row._id)}
												onKeyDown={(e) =>
													e.key === "Enter" && saveEdit(row._id)
												}
											/>
										</td>
										<td className="px-2 py-1.5">
											<input
												className="w-full rounded border bg-background px-1.5 py-0.5 text-sm"
												value={editValues.email}
												onChange={(e) =>
													setEditValues((v) => ({
														...v,
														email: e.target.value,
													}))
												}
												onBlur={() => saveEdit(row._id)}
												onKeyDown={(e) =>
													e.key === "Enter" && saveEdit(row._id)
												}
											/>
										</td>
										<td className="px-2 py-1.5">
											<input
												className="w-full rounded border bg-background px-1.5 py-0.5 text-sm"
												value={editValues.phone}
												onChange={(e) =>
													setEditValues((v) => ({
														...v,
														phone: e.target.value,
													}))
												}
												onBlur={() => saveEdit(row._id)}
												onKeyDown={(e) =>
													e.key === "Enter" && saveEdit(row._id)
												}
											/>
										</td>
									</>
								) : (
									<>
										<td className="px-2 py-1.5">
											<button
												type="button"
												className="w-full cursor-pointer text-left hover:underline"
												onClick={() => startEdit(row)}
											>
												{row.name}
											</button>
										</td>
										<td className="px-2 py-1.5">
											<button
												type="button"
												className="w-full cursor-pointer text-left hover:underline"
												onClick={() => startEdit(row)}
											>
												{row.email || "—"}
											</button>
										</td>
										<td className="px-2 py-1.5">
											<button
												type="button"
												className="w-full cursor-pointer text-left hover:underline"
												onClick={() => startEdit(row)}
											>
												{row.phone || "—"}
											</button>
										</td>
									</>
								)}
								<td className="px-2 py-1.5">
									<span
										className={`inline-block rounded-full border px-2 py-0.5 font-medium text-xs ${CONFIDENCE_STYLES[row.confidence]}`}
									>
										{row.confidence}
									</span>
								</td>
								<td className="px-2 py-1.5 text-xs">
									{row.errors.length > 0 ? (
										<span className="text-red-600">
											{row.errors.join(", ")}
										</span>
									) : row.duplicateReason ? (
										<span className="text-yellow-600">
											{row.duplicateReason}
										</span>
									) : (
										<span className="text-green-600">OK</span>
									)}
								</td>
								<td className="px-2 py-1.5">
									{row.notes && (
										<span
											className="cursor-help text-muted-foreground text-xs"
											title={row.notes}
										>
											ℹ
										</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="flex items-center justify-between">
				<p className="text-muted-foreground text-sm">
					{acceptedCount} of {rows.length} rows selected
				</p>
				<div className="flex gap-2">
					<Button variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
					<Button onClick={onConfirm} disabled={acceptedCount === 0}>
						Confirm Import ({acceptedCount})
					</Button>
				</div>
			</div>
		</div>
	);
}
