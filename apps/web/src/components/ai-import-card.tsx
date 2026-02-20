import { api } from "@onboarding-flow/backend/convex/_generated/api";
import type { Id } from "@onboarding-flow/backend/convex/_generated/dataModel";
import { useAction, useMutation } from "convex/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ClarifyingQuestions } from "@/components/clarifying-questions";
import { ImportReviewTable } from "@/components/import-review-table";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface AiImportCardProps {
	tenantId: Id<"tenants">;
	passId: Id<"passes">;
	onComplete: () => void;
	onCancel: () => void;
}

type CardState =
	| "input"
	| "extracting"
	| "clarifying"
	| "reviewing"
	| "confirming";

type SourceType = "pdf" | "csv" | "excel" | "text" | "image";

async function extractTextFromPdf(
	file: File,
	onProgress?: (page: number, total: number) => void,
): Promise<
	{ mode: "text"; text: string } | { mode: "vision"; images: string[] }
> {
	const pdfjsLib = await import("pdfjs-dist");
	pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
		"pdfjs-dist/build/pdf.worker.mjs",
		import.meta.url,
	).toString();

	const arrayBuffer = await file.arrayBuffer();
	const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

	let fullText = "";
	const pageCount = pdf.numPages;

	for (let i = 1; i <= pageCount; i++) {
		onProgress?.(i, pageCount);
		const page = await pdf.getPage(i);
		const content = await page.getTextContent();
		const pageText = content.items
			.map((item) => ("str" in item ? item.str : ""))
			.join(" ");
		fullText += `${pageText}\n`;
	}

	// Hybrid routing: if sparse text, use VLM
	const avgCharsPerPage = fullText.trim().length / pageCount;
	if (avgCharsPerPage < 50) {
		// Likely scanned — render pages to images
		const images: string[] = [];
		const pagesToRender = Math.min(pageCount, 10);
		for (let i = 1; i <= pagesToRender; i++) {
			onProgress?.(i, pagesToRender);
			const page = await pdf.getPage(i);
			const viewport = page.getViewport({ scale: 1.5 });
			const canvas = document.createElement("canvas");
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			const ctx = canvas.getContext("2d");
			if (!ctx) continue;
			// pdfjs-dist v5 RenderParameters requires canvas + canvasContext
			const renderParams: Parameters<typeof page.render>[0] = {
				canvasContext: ctx,
				viewport,
				canvas,
			};
			await page.render(renderParams).promise;
			images.push(canvas.toDataURL("image/png"));
		}
		return { mode: "vision", images };
	}

	return { mode: "text", text: fullText };
}

async function extractTextFromExcel(file: File): Promise<string> {
	const XLSX = await import("xlsx");
	const arrayBuffer = await file.arrayBuffer();
	const workbook = XLSX.read(arrayBuffer);
	const sheetNames = workbook.SheetNames;
	const csvParts = sheetNames.map((name) =>
		XLSX.utils.sheet_to_csv(workbook.Sheets[name]),
	);
	return csvParts.join("\n");
}

function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

function getSourceType(file: File): SourceType {
	const ext = file.name.split(".").pop()?.toLowerCase();
	if (ext === "pdf") return "pdf";
	if (ext === "csv") return "csv";
	if (ext === "txt") return "text";
	if (ext === "xlsx" || ext === "xls") return "excel";
	if (["png", "jpg", "jpeg"].includes(ext ?? "")) return "image";
	return "text";
}

export function AiImportCard({
	tenantId,
	passId,
	onComplete,
	onCancel,
}: AiImportCardProps) {
	const [state, setState] = useState<CardState>("input");
	const [batchId, setBatchId] = useState<Id<"importBatches"> | null>(null);
	const [pasteText, setPasteText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [questions, setQuestions] = useState<
		Array<{
			id: string;
			question: string;
			options?: string[];
			context: string;
		}>
	>([]);
	const [refinementRound, setRefinementRound] = useState(0);
	const [isRefining, setIsRefining] = useState(false);
	const [pdfProgress, setPdfProgress] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const extractMembers = useAction(api.ai.extractMembers);
	const extractMembersVision = useAction(api.ai.extractMembersVision);
	const refineExtraction = useAction(api.ai.refineExtraction);
	const confirmBatch = useMutation(api.imports.confirmBatch);

	async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setError(null);

		// File size limits: 5MB for text-based files, 10MB for images/PDFs
		const isImage = ["png", "jpg", "jpeg"].includes(
			file.name.split(".").pop()?.toLowerCase() ?? "",
		);
		const maxSize = isImage ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
		if (file.size > maxSize) {
			setError(
				`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${isImage ? "10" : "5"}MB.`,
			);
			if (fileRef.current) fileRef.current.value = "";
			return;
		}

		setState("extracting");
		setPdfProgress(null);
		try {
			const ext = file.name.split(".").pop()?.toLowerCase();
			const sourceType = getSourceType(file);

			// Image files → VLM directly
			if (["png", "jpg", "jpeg"].includes(ext ?? "")) {
				const dataUrl = await fileToBase64(file);
				const result = await extractMembersVision({
					images: [dataUrl],
					sourceType,
					tenantId,
					passId,
				});
				handleExtractionResult(result);
				return;
			}

			// PDF → hybrid text/VLM
			if (ext === "pdf") {
				const pdfResult = await extractTextFromPdf(file, (page, total) =>
					setPdfProgress(
						total > 1 ? `Processing page ${page} of ${total}...` : null,
					),
				);
				setPdfProgress(null);
				if (pdfResult.mode === "vision") {
					const result = await extractMembersVision({
						images: pdfResult.images,
						sourceType,
						tenantId,
						passId,
					});
					handleExtractionResult(result);
				} else {
					const result = await extractMembers({
						text: pdfResult.text,
						sourceType,
						tenantId,
						passId,
					});
					handleExtractionResult(result);
				}
				return;
			}

			// Excel
			if (ext === "xlsx" || ext === "xls") {
				const text = await extractTextFromExcel(file);
				const result = await extractMembers({
					text,
					sourceType,
					tenantId,
					passId,
				});
				handleExtractionResult(result);
				return;
			}

			// CSV/TXT → plain text
			const text = await file.text();
			const result = await extractMembers({
				text,
				sourceType,
				tenantId,
				passId,
			});
			handleExtractionResult(result);
		} catch (err) {
			setState("input");
			setError(err instanceof Error ? err.message : "Extraction failed");
		}
	}

	async function handlePasteExtract() {
		if (!pasteText.trim()) return;
		setError(null);
		setState("extracting");
		try {
			const result = await extractMembers({
				text: pasteText,
				sourceType: "text",
				tenantId,
				passId,
			});
			handleExtractionResult(result);
		} catch (err) {
			setState("input");
			setError(err instanceof Error ? err.message : "Extraction failed");
		}
	}

	function handleExtractionResult(
		result: Awaited<ReturnType<typeof extractMembers>>,
	) {
		if (!result.ok) {
			setState("input");
			if (result.code === "NO_API_KEY") {
				setError(
					"AI features require an API key. Please configure ANTHROPIC_API_KEY in the Convex dashboard.",
				);
			} else {
				setError(result.message);
			}
			return;
		}

		if (result.memberCount === 0) {
			setState("input");
			setError(
				"No members found in the document. Try a different format or paste the text directly.",
			);
			return;
		}

		if ("warning" in result && result.warning) {
			toast.warning(result.warning);
		}

		setBatchId(result.batchId as Id<"importBatches">);

		// Check for clarifying questions (only on initial extraction, max 2 rounds)
		if (
			"questions" in result &&
			result.questions &&
			result.questions.length > 0 &&
			refinementRound < 2
		) {
			setQuestions(result.questions);
			setState("clarifying");
			return;
		}

		setState("reviewing");
	}

	async function handleConfirm() {
		if (!batchId) return;
		setState("confirming");
		try {
			const result = await confirmBatch({ batchId });
			if (result.ok) {
				toast.success(
					`Imported ${result.successCount} members${result.failCount > 0 ? ` (${result.failCount} skipped)` : ""}.`,
				);
				onComplete();
			} else {
				toast.error(result.message);
				setState("reviewing");
			}
		} catch {
			toast.error("Failed to confirm import");
			setState("reviewing");
		}
	}

	function handleCancel() {
		if (state === "reviewing" || state === "input") {
			setState("input");
			setBatchId(null);
			setPasteText("");
			setError(null);
			setQuestions([]);
			setRefinementRound(0);
			if (fileRef.current) fileRef.current.value = "";
			if (state === "input") onCancel();
		}
	}

	async function handleClarifySubmit(
		answers: Array<{ questionId: string; answer: string }>,
	) {
		if (!batchId) return;
		setIsRefining(true);
		try {
			const result = await refineExtraction({
				batchId,
				answers,
				tenantId,
				passId,
				round: refinementRound + 1,
			});
			setRefinementRound((prev) => prev + 1);

			if (!result.ok) {
				toast.error(result.message);
				setState("reviewing");
			} else {
				setQuestions([]);
				setState("reviewing");
			}
		} catch {
			toast.error("Refinement failed");
			setState("reviewing");
		} finally {
			setIsRefining(false);
		}
	}

	function handleClarifySkip() {
		setQuestions([]);
		setState("reviewing");
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>AI Document Import</CardTitle>
				<CardDescription>
					Upload a document or paste text — AI will extract member data for
					review.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{state === "input" && (
					<div className="grid gap-4">
						<div className="flex items-center gap-3">
							<input
								ref={fileRef}
								type="file"
								accept=".pdf,.csv,.xlsx,.xls,.txt,.png,.jpg,.jpeg"
								onChange={handleFile}
								className="text-sm file:mr-3 file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:font-medium file:text-foreground file:text-sm"
							/>
						</div>

						<div className="relative">
							<div className="absolute inset-x-0 top-1/2 border-t" />
							<div className="relative flex justify-center">
								<span className="bg-card px-2 text-muted-foreground text-xs">
									or paste text
								</span>
							</div>
						</div>

						<textarea
							className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
							placeholder="Paste lease text, member list, or any document content..."
							value={pasteText}
							onChange={(e) => setPasteText(e.target.value)}
						/>

						{error && <p className="text-red-600 text-sm">{error}</p>}

						<div className="flex gap-2">
							<Button onClick={handlePasteExtract} disabled={!pasteText.trim()}>
								Extract with AI
							</Button>
							<Button variant="ghost" onClick={onCancel}>
								Cancel
							</Button>
						</div>
					</div>
				)}

				{state === "extracting" && (
					<div className="flex flex-col items-center gap-3 py-8">
						<div className="flex items-center gap-3">
							<div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
							<span className="text-muted-foreground text-sm">
								{pdfProgress ?? "Analyzing document..."}
							</span>
						</div>
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
				)}

				{state === "clarifying" && questions.length > 0 && (
					<ClarifyingQuestions
						questions={questions}
						onSubmit={handleClarifySubmit}
						onSkip={handleClarifySkip}
						isSubmitting={isRefining}
					/>
				)}

				{state === "reviewing" && batchId && (
					<ImportReviewTable
						batchId={batchId}
						onConfirm={handleConfirm}
						onCancel={handleCancel}
					/>
				)}

				{state === "confirming" && (
					<div className="flex items-center justify-center gap-3 py-8">
						<div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
						<span className="text-muted-foreground text-sm">
							Importing members...
						</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
