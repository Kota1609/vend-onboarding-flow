import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
	formatRelativeTime,
	METHOD_LABELS,
	STATUS_CONFIG,
} from "@/lib/constants";
import type { InviteMethod, MemberStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface MonitorRowProps {
	name: string;
	email?: string;
	phone?: string;
	accessCode?: string;
	status: MemberStatus;
	effectiveMethod: InviteMethod;
	lastInviteAt?: number | null;
	onSimulateAccept?: () => void;
	onApprove?: () => void;
	onReject?: () => void;
	onResend?: () => void;
	onChangeMethod?: (method: InviteMethod) => void;
	isLoading?: boolean;
}

export function MonitorRow({
	name,
	email,
	phone,
	accessCode,
	status,
	effectiveMethod,
	lastInviteAt,
	onSimulateAccept,
	onApprove,
	onReject,
	onResend,
	onChangeMethod,
	isLoading,
}: MonitorRowProps) {
	const statusConfig = STATUS_CONFIG[status];
	const contact = email || phone || "No contact";
	const isInvited = status === "invited";
	const isAccepted = status === "accepted";

	const availableMethods: { value: InviteMethod; label: string }[] = [
		...(email ? [{ value: "email" as const, label: "Email" }] : []),
		...(phone ? [{ value: "phone" as const, label: "Phone" }] : []),
		{ value: "access_code", label: "Code" },
	];

	const showMethodSelector = isInvited && onChangeMethod;
	const showQr = isInvited && effectiveMethod === "access_code" && accessCode;

	return (
		<div className="border-b last:border-b-0">
			<div className="flex items-center gap-3 px-2 py-2">
				{/* Name */}
				<span className="min-w-0 flex-1 truncate font-medium text-sm">
					{name}
				</span>

				{/* Contact */}
				<span className="hidden min-w-0 truncate text-muted-foreground text-sm sm:block">
					{contact}
				</span>

				{/* Method badge or selector */}
				{showMethodSelector ? (
					<div className="flex gap-0.5">
						{availableMethods.map((m) => (
							<Button
								key={m.value}
								variant={effectiveMethod === m.value ? "default" : "ghost"}
								size="xs"
								onClick={() => {
									if (m.value !== effectiveMethod) onChangeMethod(m.value);
								}}
								disabled={isLoading || m.value === effectiveMethod}
							>
								{m.label}
							</Button>
						))}
					</div>
				) : (
					<span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
						{METHOD_LABELS[effectiveMethod]}
					</span>
				)}

				{/* Status badge */}
				<span
					className={cn(
						"inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs",
						statusConfig.className,
					)}
				>
					{statusConfig.label}
				</span>

				{/* Actions by status */}
				{isInvited && (
					<div className="flex items-center gap-2">
						{lastInviteAt && (
							<span className="text-muted-foreground text-xs">
								{formatRelativeTime(lastInviteAt)}
							</span>
						)}
						{onResend && (
							<Button
								size="xs"
								variant="outline"
								onClick={onResend}
								disabled={isLoading}
							>
								Resend
							</Button>
						)}
						{onSimulateAccept && (
							<Button
								size="xs"
								variant="ghost"
								onClick={onSimulateAccept}
								disabled={isLoading}
							>
								Mock Accept
							</Button>
						)}
					</div>
				)}
				{isAccepted && (
					<div className="flex items-center gap-1">
						{onApprove && (
							<Button size="xs" onClick={onApprove} disabled={isLoading}>
								{isLoading ? "..." : "Approve"}
							</Button>
						)}
						{onReject && (
							<Button
								size="xs"
								variant="ghost"
								onClick={onReject}
								disabled={isLoading}
								className="text-destructive"
							>
								Reject
							</Button>
						)}
					</div>
				)}
			</div>

			{/* QR code for access_code invited members */}
			{showQr && (
				<div className="flex items-center gap-3 px-2 pb-2">
					<QRCodeSVG value={accessCode} size={64} />
					<span className="font-mono text-sm">{accessCode}</span>
				</div>
			)}
		</div>
	);
}
