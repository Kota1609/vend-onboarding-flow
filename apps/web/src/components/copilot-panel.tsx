import { api } from "@onboarding-flow/backend/convex/_generated/api";
import { useRouterState } from "@tanstack/react-router";
import { useAction } from "convex/react";
import {
	ChevronLeft,
	ChevronRight,
	MessageCircle,
	Send,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CopilotMarkdown } from "@/components/copilot-markdown";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

type ToolCallResult = { toolName: string; result: unknown };

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	toolCalls?: ToolCallResult[];
}

interface ProposalResult {
	action?: string;
	intent?: Record<string, unknown>;
	summary?: string;
	requiresConfirmation?: boolean;
}

// --- Step context: persistent bar below header ---
const STEP_CONTEXT: Record<number, { label: string; capabilities: string[] }> =
	{
		1: {
			label: "Define Passes",
			capabilities: ["Create passes", "Edit details", "Set targets"],
		},
		2: {
			label: "Add Members",
			capabilities: ["Add members", "Import CSV", "Delete members"],
		},
		3: {
			label: "Send Invites",
			capabilities: ["Send invites", "Resend", "Change method"],
		},
		4: {
			label: "Monitor & Approve",
			capabilities: ["Approve members", "Reject", "Track progress"],
		},
	};

// --- Suggestion chips: always visible above input ---
const STEP_CHIPS: Record<number, string[]> = {
	1: ["Create a pass", "Show pass progress", "What needs attention?"],
	2: ["Add members to a pass", "Show draft members", "Any duplicates?"],
	3: ["Send all invites", "Resend to a member", "Who hasn't been invited?"],
	4: ["Approve all accepted", "Show approval progress", "Any blockers?"],
};

const DEFAULT_CHIPS = [
	"Show onboarding progress",
	"What should I do next?",
	"Any blockers?",
];

const VEND_CHIPS = [
	"Create a new tenant",
	"Which tenants are behind?",
	"Show all progress",
];

const VEND_CONTEXT = {
	label: "Platform Admin",
	capabilities: ["Create tenants", "Configure billing", "Track all tenants"],
};

export function CopilotPanel() {
	const { role, tenantId } = useAuth();
	// Key on role+tenant only — chat persists across step navigation
	const contextKey = `${role}-${tenantId ?? "admin"}`;

	return <CopilotPanelInner key={contextKey} />;
}

function CopilotPanelInner() {
	const { role, tenantId } = useAuth();
	const [collapsed, setCollapsed] = useState(
		() => localStorage.getItem("copilot-collapsed") === "true",
	);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirmedProposals, setConfirmedProposals] = useState<Set<string>>(
		new Set(),
	);
	const [executingProposal, setExecutingProposal] = useState<string | null>(
		null,
	);
	const [inputDisabled, setInputDisabled] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	function toggleCollapsed() {
		const next = !collapsed;
		setCollapsed(next);
		localStorage.setItem("copilot-collapsed", String(next));
	}

	// Auto-scroll to bottom when messages change or loading state changes
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	const sendMessageAction = useAction(api.assistant.sendMessage);
	const execProposal = useAction(api.assistant.executeProposal);

	// Step detection from URL
	// URL step 0 = overview, steps 1-4 = wizard steps that map to backend 0-3
	const routerState = useRouterState();
	const urlStep = (() => {
		if (!routerState.location.pathname.startsWith("/onboarding"))
			return undefined;
		const params = new URLSearchParams(routerState.location.searchStr);
		const step = Number(params.get("step"));
		return Number.isFinite(step) ? step : 0;
	})();
	// Backend copilot step: undefined when not on onboarding or on overview (step 0)
	const copilotStep =
		urlStep !== undefined && urlStep >= 1 ? urlStep - 1 : undefined;
	const currentStep = urlStep;

	const isVendAdmin = role === "vend_admin" && !tenantId;

	// Derive context and chips
	const stepCtx = isVendAdmin
		? VEND_CONTEXT
		: currentStep !== undefined
			? STEP_CONTEXT[currentStep]
			: null;

	const chips = isVendAdmin
		? VEND_CHIPS
		: currentStep !== undefined
			? (STEP_CHIPS[currentStep] ?? DEFAULT_CHIPS)
			: DEFAULT_CHIPS;

	function clearChat() {
		setMessages([]);
		setError(null);
		setConfirmedProposals(new Set());
	}

	async function handleSend(text?: string) {
		const prompt = text ?? input.trim();
		if (!prompt || isLoading || inputDisabled) return;

		setInput("");
		setError(null);
		if (textareaRef.current) textareaRef.current.style.height = "auto";

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content: prompt,
		};
		setMessages((prev) => [...prev, userMessage]);
		setIsLoading(true);

		try {
			const result = await sendMessageAction({
				prompt,
				role: isVendAdmin ? "vend_admin" : "tenant_admin",
				tenantId: tenantId ? (tenantId as string) : undefined,
				currentStep: copilotStep,
				history: messages.map((m) => ({
					role: m.role,
					content: m.content,
				})),
			});

			if (result.ok) {
				const assistantMessage: Message = {
					id: crypto.randomUUID(),
					role: "assistant",
					content: result.text,
					toolCalls: result.toolCalls,
				};
				setMessages((prev) => [...prev, assistantMessage]);
			} else {
				setError(result.message);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to send message");
		} finally {
			setIsLoading(false);
		}
	}

	async function handleConfirmProposal(
		key: string,
		proposalAction: string,
		intent: Record<string, unknown>,
	) {
		setExecutingProposal(key);
		try {
			const result = await execProposal({
				proposalAction,
				role: isVendAdmin ? "vend_admin" : "tenant_admin",
				intent: {
					tenantId: intent.tenantId as string | undefined,
					name: intent.name as string | undefined,
					description: intent.description as string | undefined,
					targetMemberCount: intent.targetMemberCount as number | undefined,
					passId: intent.passId as string | undefined,
					status: intent.status as string | undefined,
					memberId: intent.memberId as string | undefined,
					email: intent.email as string | undefined,
					phone: intent.phone as string | undefined,
					method: intent.method as string | undefined,
					billingType: intent.billingType as string | undefined,
					companyName: intent.companyName as string | undefined,
					adminName: intent.adminName as string | undefined,
					adminEmail: intent.adminEmail as string | undefined,
					adminPhone: intent.adminPhone as string | undefined,
					members: intent.members as
						| Array<{
								name: string;
								email?: string;
								phone?: string;
						  }>
						| undefined,
					memberIds: intent.memberIds as string[] | undefined,
				},
			});
			if (result.ok) {
				toast.success(result.message);
				setConfirmedProposals((prev) => new Set(prev).add(key));

				// Outcome injection: inject as user message so LLM has context
				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "user",
						content: `System: Action completed — ${result.message}. Continue assisting.`,
					},
				]);

				// Post-confirm input delay: 500ms for Convex reactivity
				setInputDisabled(true);
				setTimeout(() => setInputDisabled(false), 500);
			} else {
				setMessages((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content: result.message,
					},
				]);
			}
		} catch {
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content:
						"That action failed. The data may have changed — want me to check the current status?",
				},
			]);
		} finally {
			setExecutingProposal(null);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	// Collapsed vertical bar
	if (collapsed) {
		return (
			<div className="flex h-full w-12 flex-col items-center border-l bg-muted/30 py-3">
				<button
					type="button"
					onClick={toggleCollapsed}
					className="flex flex-col items-center gap-3 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title="Open Vend Assistant"
				>
					<ChevronLeft className="size-4" />
					<MessageCircle className="size-4" />
				</button>
				<div className="mt-3 flex flex-1 items-start justify-center">
					<span className="text-muted-foreground text-xs [writing-mode:vertical-lr]">
						Assistant
					</span>
				</div>
			</div>
		);
	}

	// Expanded panel
	return (
		<div className="flex h-full w-[540px] flex-col border-l">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="flex items-center gap-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
						<Sparkles className="h-3.5 w-3.5 text-primary" />
					</div>
					<div>
						<h3 className="font-semibold text-sm leading-tight">
							Vend Assistant
						</h3>
						<p className="text-muted-foreground text-xs leading-tight">
							{isVendAdmin
								? "Your platform command center"
								: "Your onboarding co-pilot"}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-1">
					{messages.length > 0 && (
						<button
							type="button"
							onClick={clearChat}
							className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							title="Clear chat"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					)}
					<button
						type="button"
						onClick={toggleCollapsed}
						className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						title="Collapse panel"
					>
						<ChevronRight className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Persistent step context bar — always visible */}
			{stepCtx && (
				<div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2">
					{currentStep !== undefined && currentStep >= 1 && (
						<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-[10px] text-primary-foreground">
							{currentStep}
						</span>
					)}
					<div className="min-w-0 flex-1">
						<span className="font-medium text-xs">{stepCtx.label}</span>
						<span className="mx-1.5 text-muted-foreground/40">|</span>
						<span className="text-muted-foreground text-xs">
							{stepCtx.capabilities.join(" / ")}
						</span>
					</div>
				</div>
			)}

			{/* Messages */}
			<div className="flex-1 overflow-auto px-4 py-3">
				{messages.length === 0 && (
					<div className="flex h-full flex-col items-center justify-center px-4 text-center">
						<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
							<MessageCircle className="h-6 w-6 text-primary" />
						</div>
						<p className="mb-1 font-medium text-sm">
							{isVendAdmin
								? "Manage your platform"
								: stepCtx
									? `Ready to help with ${stepCtx.label.toLowerCase()}`
									: "How can I help?"}
						</p>
						<p className="max-w-xs text-muted-foreground text-xs">
							{isVendAdmin
								? "Ask me to create tenants, check progress, or configure billing."
								: stepCtx
									? "Use the suggestions below or type your own request."
									: "Ask about your onboarding progress or request any action."}
						</p>
					</div>
				)}

				{messages.map((msg) => {
					// Hide outcome injection messages from display
					if (
						msg.role === "user" &&
						msg.content.startsWith("System: Action completed")
					) {
						return null;
					}

					return (
						<div
							key={msg.id}
							className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
						>
							<div className="max-w-[85%]">
								<div
									className={`rounded-lg px-3 py-2 text-sm ${
										msg.role === "user"
											? "whitespace-pre-wrap bg-primary text-primary-foreground"
											: "bg-muted"
									}`}
								>
									{msg.role === "assistant" ? (
										<CopilotMarkdown content={msg.content} />
									) : (
										msg.content
									)}
								</div>

								{/* Tool call badges */}
								{msg.toolCalls && msg.toolCalls.length > 0 && (
									<div className="mt-1 flex flex-wrap gap-1">
										{msg.toolCalls.map((tc) => {
											const r = tc.result as ProposalResult;
											const proposalKey = `${msg.id}-${tc.toolName}`;
											const isConfirmed = confirmedProposals.has(proposalKey);
											const isExecuting = executingProposal === proposalKey;

											if (r?.requiresConfirmation && r.intent) {
												return (
													<div
														key={proposalKey}
														className="mt-2 w-full rounded-lg border border-primary/30 bg-primary/5 p-3"
													>
														<p className="mb-2 font-medium text-primary text-xs">
															Proposed action
														</p>
														<p className="mb-3 text-sm">{r.summary}</p>
														<Button
															size="sm"
															className="w-full"
															disabled={isConfirmed || isExecuting}
															onClick={() =>
																handleConfirmProposal(
																	proposalKey,
																	r.action ?? "",
																	r.intent ?? {},
																)
															}
														>
															{isExecuting
																? "Executing..."
																: isConfirmed
																	? "Completed"
																	: "Confirm & Execute"}
														</Button>
													</div>
												);
											}

											return (
												<span
													key={proposalKey}
													className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs"
												>
													{tc.toolName}
												</span>
											);
										})}
									</div>
								)}
							</div>
						</div>
					);
				})}

				{isLoading && (
					<div className="mb-3 flex justify-start">
						<div className="rounded-lg bg-muted px-3 py-2">
							<div className="flex gap-1">
								<span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
								<span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
								<span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
							</div>
						</div>
					</div>
				)}

				{error && <p className="mb-3 text-red-600 text-xs">{error}</p>}

				<div ref={messagesEndRef} />
			</div>

			{/* Suggestion chips — always visible above input */}
			<div className="flex flex-wrap gap-1.5 border-t bg-muted/20 px-4 py-2">
				{chips.map((chip) => (
					<button
						type="button"
						key={chip}
						onClick={() => handleSend(chip)}
						disabled={isLoading || inputDisabled}
						className="rounded-full border border-border/60 bg-background px-3 py-1 text-muted-foreground text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
					>
						{chip}
					</button>
				))}
			</div>

			{/* Input */}
			<div className="border-t px-4 py-3">
				<div className="flex items-end gap-2">
					<textarea
						ref={textareaRef}
						className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
						placeholder={
							stepCtx
								? `Ask about ${stepCtx.label.toLowerCase()}...`
								: isVendAdmin
									? "Create tenants, check progress, configure billing..."
									: "Create passes, add members, send invites..."
						}
						rows={1}
						value={input}
						onChange={(e) => {
							setInput(e.target.value);
							const el = e.target;
							el.style.height = "auto";
							el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
						}}
						onKeyDown={handleKeyDown}
						disabled={isLoading || inputDisabled}
					/>
					<Button
						size="sm"
						className="shrink-0"
						onClick={() => handleSend()}
						disabled={!input.trim() || isLoading || inputDisabled}
					>
						<Send className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
