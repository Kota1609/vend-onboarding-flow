import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SetupSuggestionCardProps {
	tenantId: Id<"tenants">;
	onComplete: () => void;
	onCancel: () => void;
}

type CardState = "input" | "extracting" | "reviewing" | "creating";

interface SuggestedPass {
	name: string;
	description: string;
	estimatedMemberCount: number;
	reasoning: string;
	confidence: string;
	accepted: boolean;
}

const CONFIDENCE_STYLES: Record<string, string> = {
	high: "border-green-200 bg-green-50 text-green-700",
	medium: "border-yellow-200 bg-yellow-50 text-yellow-700",
	low: "border-red-200 bg-red-50 text-red-700",
};

async function extractTextFromFile(
	file: File,
	onProgress?: (page: number, total: number) => void,
): Promise<string> {
	if (file.type === "application/pdf") {
		const pdfjsLib = await import("pdfjs-dist");
		pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
			"pdfjs-dist/build/pdf.worker.mjs",
			import.meta.url,
		).toString();

		const arrayBuffer = await file.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

		let fullText = "";
		for (let i = 1; i <= pdf.numPages; i++) {
			onProgress?.(i, pdf.numPages);
			const page = await pdf.getPage(i);
			const content = await page.getTextContent();
			const pageText = content.items
				.map((item) => ("str" in item ? item.str : ""))
				.join(" ");
			fullText += `${pageText}\n`;
		}
		return fullText;
	}

	return file.text();
}

function getSourceType(file: File): "pdf" | "csv" | "excel" | "text" | "image" {
	if (file.type === "application/pdf") return "pdf";
	if (file.type === "text/csv" || file.name.endsWith(".csv")) return "csv";
	if (
		file.name.endsWith(".xlsx") ||
		file.name.endsWith(".xls") ||
		file.type.includes("spreadsheet")
	)
		return "excel";
	return "text";
}

export function SetupSuggestionCard({
	tenantId,
	onComplete,
	onCancel,
}: SetupSuggestionCardProps) {
	const [state, setState] = useState<CardState>("input");
	const [suggestionId, setSuggestionId] =
		useState<Id<"setupSuggestions"> | null>(null);
	const [passes, setPasses] = useState<SuggestedPass[]>([]);
	const [memberCount, setMemberCount] = useState(0);
	const [warning, setWarning] = useState<string | null>(null);
	const [creatingIndex, setCreatingIndex] = useState(-1);
	const [pdfProgress, setPdfProgress] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const extractSetup = useAction(api.ai.extractSetup);
	const createPass = useMutation(api.passes.create);
	const markApplied = useMutation(api.setup.markApplied);

	const suggestion = useQuery(
		api.setup.get,
		suggestionId ? { suggestionId } : "skip",
	);

	async function handleFileSelect(file: File) {
		// File size limit: 10MB
		if (file.size > 10 * 1024 * 1024) {
			toast.error(
				`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`,
			);
			return;
		}

		setState("extracting");
		setPdfProgress(null);
		try {
			const text = await extractTextFromFile(file, (page, total) =>
				setPdfProgress(
					total > 1 ? `Processing page ${page} of ${total}...` : null,
				),
			);
			setPdfProgress(null);
			if (!text.trim()) {
				toast.error("Could not extract text from file.");
				setState("input");
				return;
			}

			const result = await extractSetup({
				text,
				sourceType: getSourceType(file),
				tenantId,
			});

			if (!result.ok) {
				toast.error(result.message);
				setState("input");
				return;
			}

			setSuggestionId(result.suggestionId);
			setMemberCount(result.memberCount);
			if (result.warning) setWarning(result.warning);
			setState("reviewing");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Extraction failed");
			setState("input");
		}
	}

	// Sync suggestion data into local state when available
	useEffect(() => {
		if (
			suggestion &&
			state === "reviewing" &&
			passes.length === 0 &&
			suggestion.suggestedPasses.length > 0
		) {
			setPasses(
				suggestion.suggestedPasses.map((p) => ({ ...p, accepted: true })),
			);
			setMemberCount(suggestion.members.length);
		}
	}, [suggestion, state, passes.length]);

	async function handleCreatePasses() {
		const accepted = passes.filter((p) => p.accepted);
		if (accepted.length === 0) {
			toast.error("Select at least one pass to create.");
			return;
		}

		setState("creating");
		let successCount = 0;
		const failedNames: string[] = [];

		for (let i = 0; i < accepted.length; i++) {
			setCreatingIndex(i);
			const p = accepted[i];
			try {
				await createPass({
					tenantId,
					name: p.name,
					description: p.description,
					targetMemberCount: p.estimatedMemberCount,
				});
				successCount++;
			} catch {
				failedNames.push(p.name);
			}
		}

		if (suggestionId && successCount > 0) {
			await markApplied({ suggestionId });
		}

		if (failedNames.length === 0) {
			toast.success(
				`Created ${successCount} pass${successCount === 1 ? "" : "es"} from document.`,
			);
			onComplete();
		} else if (successCount > 0) {
			toast.warning(
				`Created ${successCount} pass${successCount === 1 ? "" : "es"}, but failed: ${failedNames.join(", ")}. You can retry the failed ones.`,
			);
			// Mark successful passes as no longer accepted so user can retry just the failures
			setPasses((prev) =>
				prev.map((p) =>
					failedNames.includes(p.name) ? p : { ...p, accepted: false },
				),
			);
			setState("reviewing");
		} else {
			toast.error("Failed to create passes. Please try again.");
			setState("reviewing");
		}
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (file) handleFileSelect(file);
	}

	if (state === "input") {
		return (
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div>
							<CardTitle>Setup from Document</CardTitle>
							<CardDescription>
								Upload a lease agreement, directory, or spreadsheet to
								auto-detect pass types.
							</CardDescription>
						</div>
						<Button variant="ghost" size="sm" onClick={onCancel}>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<button
						type="button"
						className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
						onDragOver={(e) => e.preventDefault()}
						onDrop={handleDrop}
						onClick={() => fileRef.current?.click()}
					>
						<Upload className="h-8 w-8 text-muted-foreground" />
						<div className="text-center">
							<p className="font-medium text-sm">
								Drop a file or click to browse
							</p>
							<p className="text-muted-foreground text-xs">
								PDF, CSV, Excel, or text files
							</p>
						</div>
					</button>
					<input
						ref={fileRef}
						type="file"
						accept=".pdf,.csv,.xlsx,.xls,.txt"
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) handleFileSelect(file);
						}}
					/>
				</CardContent>
			</Card>
		);
	}

	if (state === "extracting") {
		return (
			<Card>
				<CardContent className="py-12">
					<div className="flex flex-col items-center gap-3">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
						<p className="font-medium text-sm">
							{pdfProgress ?? "Analyzing document..."}
						</p>
						<p className="text-muted-foreground text-xs">
							Detecting pass types and member records
						</p>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setState("input");
								if (fileRef.current) fileRef.current.value = "";
							}}
						>
							Cancel
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (state === "creating") {
		const accepted = passes.filter((p) => p.accepted);
		return (
			<Card>
				<CardContent className="py-12">
					<div className="flex flex-col items-center gap-3">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
						<p className="font-medium text-sm">Creating passes...</p>
						<p className="text-muted-foreground text-xs">
							{creatingIndex + 1} of {accepted.length}
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	// state === "reviewing"
	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle>Suggested Passes</CardTitle>
						<CardDescription>
							{passes.length} pass
							{passes.length === 1 ? "" : "es"} detected
							{memberCount > 0 &&
								` with ${memberCount} member${memberCount === 1 ? "" : "s"}`}
						</CardDescription>
					</div>
					<Button variant="ghost" size="sm" onClick={onCancel}>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3">
					{warning && <p className="text-amber-600 text-xs">{warning}</p>}

					{passes.map((pass, i) => (
						<div
							key={pass.name}
							className={cn(
								"rounded-lg border p-3 transition-colors",
								pass.accepted
									? "border-primary/20 bg-primary/5"
									: "border-muted bg-muted/30 opacity-60",
							)}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<FileText className="h-4 w-4 text-muted-foreground" />
										<span className="font-medium text-sm">{pass.name}</span>
										<span
											className={cn(
												"rounded-full border px-1.5 py-0.5 text-[10px]",
												CONFIDENCE_STYLES[pass.confidence] ??
													CONFIDENCE_STYLES.low,
											)}
										>
											{pass.confidence}
										</span>
									</div>
									<p className="mt-1 text-muted-foreground text-xs">
										{pass.description}
									</p>
									<p className="mt-1 text-muted-foreground text-xs italic">
										{pass.reasoning}
									</p>
									<p className="mt-1 text-xs">
										~{pass.estimatedMemberCount} members
									</p>
								</div>
								<Button
									variant={pass.accepted ? "outline" : "ghost"}
									size="sm"
									onClick={() => {
										setPasses((prev) =>
											prev.map((p, j) =>
												j === i
													? {
															...p,
															accepted: !p.accepted,
														}
													: p,
											),
										);
									}}
								>
									{pass.accepted ? "Included" : "Excluded"}
								</Button>
							</div>
						</div>
					))}

					{suggestion?.sourceNotes && (
						<p className="text-muted-foreground text-xs">
							{suggestion.sourceNotes}
						</p>
					)}

					<div className="flex justify-end gap-2 pt-2">
						<Button variant="outline" onClick={onCancel}>
							Cancel
						</Button>
						<Button
							onClick={handleCreatePasses}
							disabled={!passes.some((p) => p.accepted)}
						>
							Create {passes.filter((p) => p.accepted).length} Pass
							{passes.filter((p) => p.accepted).length === 1 ? "" : "es"}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
