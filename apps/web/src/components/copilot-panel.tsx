import { api } from "@onboarding-flow/backend/convex/_generated/api";
import { useRouterState } from "@tanstack/react-router";
import { useAction } from "convex/react";
import {
	ChevronLeft,
	ChevronRight,
	MessageCircle,
	Send,
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

const STEP_QUICK_ACTIONS: Record<number, string[]> = {
	0: [
		"Help me set up passes",
		"What passes should I create?",
		"What needs attention?",
	],
	1: ["Show member counts", "Any duplicates?", "What needs attention?"],
	2: ["Send all pending invites", "Who hasn't been invited?", "Any blockers?"],
	3: ["Approve all accepted members", "Show progress", "What needs attention?"],
};

const DEFAULT_QUICK_ACTIONS = [
	"Show onboarding progress",
	"Any blockers?",
	"What should I do next?",
];

const VEND_ADMIN_QUICK_ACTIONS = [
	"Which tenants are behind?",
	"Show all tenants progress",
	"Create a new tenant",
];

export function CopilotPanel() {
	const { role, tenantId } = useAuth();
	const contextKey = `${role}-${tenantId ?? "admin"}`;

	// key forces full remount when role/tenant changes — completely fresh chat
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
	const routerState = useRouterState();
	const currentStep = (() => {
		if (!routerState.location.pathname.startsWith("/onboarding"))
			return undefined;
		const params = new URLSearchParams(routerState.location.searchStr);
		const step = Number(params.get("step"));
		return Number.isFinite(step) ? step : 0;
	})();

	const isVendAdmin = role === "vend_admin" && !tenantId;

	const quickActions = isVendAdmin
		? VEND_ADMIN_QUICK_ACTIONS
		: currentStep !== undefined
			? (STEP_QUICK_ACTIONS[currentStep] ?? DEFAULT_QUICK_ACTIONS)
			: DEFAULT_QUICK_ACTIONS;

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
				currentStep,
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
					title="Open Copilot"
				>
					<ChevronLeft className="size-4" />
					<MessageCircle className="size-4" />
				</button>
				<div className="mt-3 flex flex-1 items-start justify-center">
					<span className="text-muted-foreground text-xs [writing-mode:vertical-lr]">
						Copilot
					</span>
				</div>
			</div>
		);
	}

	// Expanded panel
	return (
		<div className="flex h-full w-[420px] flex-col border-l">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div>
					<h3 className="font-semibold text-sm">Onboarding Copilot</h3>
					<p className="text-muted-foreground text-xs">
						{isVendAdmin
							? "Platform overview — all tenants"
							: currentStep !== undefined
								? `Step ${currentStep} — ask anything`
								: "Ask about your onboarding"}
					</p>
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

			{/* Messages */}
			<div className="flex-1 overflow-auto px-4 py-3">
				{messages.length === 0 && (
					<div className="grid gap-2 py-4">
						<p className="mb-3 text-center text-muted-foreground text-sm">
							Quick actions:
						</p>
						{quickActions.map((qa) => (
							<button
								type="button"
								key={qa}
								onClick={() => handleSend(qa)}
								className="rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
							>
								{qa}
							</button>
						))}
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
														className="mt-1 flex w-full items-center gap-2 rounded border border-primary/20 bg-primary/5 px-3 py-2"
													>
														<span className="flex-1 text-sm">{r.summary}</span>
														<Button
															size="sm"
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
																? "..."
																: isConfirmed
																	? "Done"
																	: "Confirm"}
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

			{/* Input */}
			<div className="border-t px-4 py-3">
				<div className="flex gap-2">
					<input
						type="text"
						className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
						placeholder={
							isVendAdmin
								? "Ask about tenants..."
								: "Ask about your onboarding..."
						}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={isLoading || inputDisabled}
					/>
					<Button
						size="sm"
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
