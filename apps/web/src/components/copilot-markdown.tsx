import type { ReactNode } from "react";

/**
 * Lightweight markdown renderer for copilot chat messages.
 * Handles: **bold**, `inline code`, ```code blocks```, - lists, 1. ordered lists.
 * No external dependency needed.
 */

function parseInline(text: string): ReactNode[] {
	const parts: ReactNode[] = [];
	let remaining = text;
	let key = 0;

	while (remaining.length > 0) {
		// Bold: **text**
		const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
		// Inline code: `text`
		const codeMatch = remaining.match(/`([^`]+)`/);

		// Find whichever comes first
		const boldIdx = boldMatch?.index ?? Number.POSITIVE_INFINITY;
		const codeIdx = codeMatch?.index ?? Number.POSITIVE_INFINITY;

		if (
			boldIdx === Number.POSITIVE_INFINITY &&
			codeIdx === Number.POSITIVE_INFINITY
		) {
			// No more patterns
			parts.push(remaining);
			break;
		}

		if (boldIdx <= codeIdx && boldMatch) {
			// Bold comes first
			if (boldIdx > 0) {
				parts.push(remaining.slice(0, boldIdx));
			}
			parts.push(
				<strong key={key++} className="font-semibold">
					{boldMatch[1]}
				</strong>,
			);
			remaining = remaining.slice(boldIdx + boldMatch[0].length);
		} else if (codeMatch && codeIdx !== undefined) {
			// Code comes first
			if (codeIdx > 0) {
				parts.push(remaining.slice(0, codeIdx));
			}
			parts.push(
				<code
					key={key++}
					className="rounded bg-background/50 px-1 py-0.5 font-mono text-[0.85em]"
				>
					{codeMatch[1]}
				</code>,
			);
			remaining = remaining.slice(codeIdx + codeMatch[0].length);
		}
	}

	return parts;
}

export function CopilotMarkdown({ content }: { content: string }) {
	const lines = content.split("\n");
	const elements: ReactNode[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Fenced code block: ```...```
		if (line.trimStart().startsWith("```")) {
			const codeLines: string[] = [];
			i++; // skip opening ```
			while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			i++; // skip closing ```
			elements.push(
				<pre
					key={`code-${String(i)}`}
					className="my-1 overflow-x-auto rounded bg-background/50 px-2 py-1.5 font-mono text-xs"
				>
					{codeLines.join("\n")}
				</pre>,
			);
			continue;
		}

		// Empty line → spacing
		if (line.trim() === "") {
			elements.push(<div key={`space-${String(i)}`} className="h-1.5" />);
			i++;
			continue;
		}

		// Unordered list: - item or * item
		if (/^[\s]*[-*]\s/.test(line)) {
			const items: ReactNode[] = [];
			while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
				const itemText = lines[i].replace(/^[\s]*[-*]\s/, "");
				items.push(<li key={`li-${String(i)}`}>{parseInline(itemText)}</li>);
				i++;
			}
			elements.push(
				<ul
					key={`ul-${String(i)}`}
					className="my-0.5 list-inside list-disc space-y-0.5"
				>
					{items}
				</ul>,
			);
			continue;
		}

		// Ordered list: 1. item
		if (/^[\s]*\d+\.\s/.test(line)) {
			const items: ReactNode[] = [];
			while (i < lines.length && /^[\s]*\d+\.\s/.test(lines[i])) {
				const itemText = lines[i].replace(/^[\s]*\d+\.\s/, "");
				items.push(<li key={`oli-${String(i)}`}>{parseInline(itemText)}</li>);
				i++;
			}
			elements.push(
				<ol
					key={`ol-${String(i)}`}
					className="my-0.5 list-inside list-decimal space-y-0.5"
				>
					{items}
				</ol>,
			);
			continue;
		}

		// Regular paragraph line
		elements.push(
			<p key={`p-${String(i)}`} className="leading-relaxed">
				{parseInline(line)}
			</p>,
		);
		i++;
	}

	return <div className="grid gap-0.5">{elements}</div>;
}
