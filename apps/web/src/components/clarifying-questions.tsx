import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClarifyingQuestion {
	id: string;
	question: string;
	options?: string[];
	context: string;
}

interface ClarifyingQuestionsProps {
	questions: ClarifyingQuestion[];
	onSubmit: (answers: Array<{ questionId: string; answer: string }>) => void;
	onSkip: () => void;
	isSubmitting: boolean;
}

export function ClarifyingQuestions({
	questions,
	onSubmit,
	onSkip,
	isSubmitting,
}: ClarifyingQuestionsProps) {
	const [answers, setAnswers] = useState<Record<string, string>>({});

	function handleOptionSelect(questionId: string, option: string) {
		setAnswers((prev) => ({ ...prev, [questionId]: option }));
	}

	function handleTextChange(questionId: string, value: string) {
		setAnswers((prev) => ({ ...prev, [questionId]: value }));
	}

	function handleSubmit() {
		const result = questions.map((q) => ({
			questionId: q.id,
			answer: answers[q.id] || "",
		}));
		onSubmit(result);
	}

	const allAnswered = questions.every((q) => answers[q.id]?.trim());

	return (
		<div className="grid gap-4">
			<div>
				<h4 className="font-medium text-sm">Clarifying Questions</h4>
				<p className="text-muted-foreground text-xs">
					Help improve the extraction by answering these questions.
				</p>
			</div>

			{questions.map((q) => (
				<div key={q.id} className="grid gap-2 rounded-lg border p-3">
					<Label className="font-medium text-sm">{q.question}</Label>
					<p className="text-muted-foreground text-xs">{q.context}</p>

					{q.options && q.options.length > 0 ? (
						<div className="grid gap-1.5">
							{q.options.map((option) => (
								<button
									key={option}
									type="button"
									className={`rounded-md border px-3 py-1.5 text-left text-sm transition-colors ${
										answers[q.id] === option
											? "border-primary bg-primary/10 text-primary"
											: "hover:bg-muted"
									}`}
									onClick={() => handleOptionSelect(q.id, option)}
								>
									{option}
								</button>
							))}
							<Input
								placeholder="Or type a custom answer..."
								value={
									q.options.includes(answers[q.id] ?? "")
										? ""
										: (answers[q.id] ?? "")
								}
								onChange={(e) => handleTextChange(q.id, e.target.value)}
								className="mt-1"
							/>
						</div>
					) : (
						<Input
							placeholder="Your answer..."
							value={answers[q.id] ?? ""}
							onChange={(e) => handleTextChange(q.id, e.target.value)}
						/>
					)}
				</div>
			))}

			<div className="flex justify-end gap-2">
				<Button variant="outline" onClick={onSkip} disabled={isSubmitting}>
					Skip
				</Button>
				<Button onClick={handleSubmit} disabled={!allAnswered || isSubmitting}>
					{isSubmitting ? "Refining..." : "Submit Answers"}
				</Button>
			</div>
		</div>
	);
}
