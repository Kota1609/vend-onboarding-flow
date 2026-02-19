import {
	type Edge,
	Handle,
	type Node,
	type NodeProps,
	Position,
	ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

interface PipelineFlowProps {
	draft: number;
	invited: number;
	accepted: number;
	approved: number;
	rejected: number;
}

type PipelineNodeData = {
	label: string;
	count: number;
	variant?: "green" | "red" | "blue";
};

type PipelineNodeType = Node<PipelineNodeData, "pipeline">;

const variantClasses: Record<string, string> = {
	green:
		"border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
	red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
	blue: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

function PipelineNode({ data }: NodeProps<PipelineNodeType>) {
	const className = data.variant
		? variantClasses[data.variant]
		: "border-border bg-card text-foreground";

	return (
		<div
			className={`flex flex-col items-center rounded-lg border px-6 py-3 ${className}`}
		>
			<Handle type="target" position={Position.Left} className="invisible" />
			<span className="font-semibold text-lg">{data.count}</span>
			<span className="text-muted-foreground text-xs">{data.label}</span>
			<Handle type="source" position={Position.Right} className="invisible" />
		</div>
	);
}

const nodeTypes = { pipeline: PipelineNode };

export function PipelineFlow({
	draft,
	invited,
	accepted,
	approved,
	rejected,
}: PipelineFlowProps) {
	const nodes = useMemo<PipelineNodeType[]>(
		() => [
			{
				id: "draft",
				type: "pipeline",
				position: { x: 0, y: 0 },
				data: { label: "Draft", count: draft },
			},
			{
				id: "invited",
				type: "pipeline",
				position: { x: 200, y: 0 },
				data: { label: "Invited", count: invited, variant: "blue" },
			},
			{
				id: "accepted",
				type: "pipeline",
				position: { x: 400, y: 0 },
				data: { label: "Accepted", count: accepted },
			},
			{
				id: "approved",
				type: "pipeline",
				position: { x: 600, y: 0 },
				data: { label: "Approved", count: approved, variant: "green" },
			},
			{
				id: "rejected",
				type: "pipeline",
				position: { x: 600, y: 120 },
				data: { label: "Rejected", count: rejected, variant: "red" },
			},
		],
		[draft, invited, accepted, approved, rejected],
	);

	const edges = useMemo<Edge[]>(
		() => [
			{
				id: "draft-invited",
				source: "draft",
				target: "invited",
				type: "smoothstep",
				animated: true,
				style: { stroke: "var(--muted-foreground)" },
			},
			{
				id: "invited-accepted",
				source: "invited",
				target: "accepted",
				type: "smoothstep",
				animated: true,
				style: { stroke: "var(--muted-foreground)" },
			},
			{
				id: "accepted-approved",
				source: "accepted",
				target: "approved",
				type: "smoothstep",
				animated: true,
				style: { stroke: "var(--color-green-500)" },
			},
			{
				id: "accepted-rejected",
				source: "accepted",
				target: "rejected",
				type: "smoothstep",
				animated: true,
				style: { stroke: "var(--color-red-500)" },
			},
		],
		[],
	);

	return (
		<div className="h-[200px] w-full">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
				panOnDrag={false}
				zoomOnScroll={false}
				zoomOnPinch={false}
				zoomOnDoubleClick={false}
				preventScrolling={false}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				proOptions={{ hideAttribution: true }}
			/>
		</div>
	);
}
