import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function StatCard({
	label,
	value,
	detail,
}: {
	label: string;
	value: string | number;
	detail?: string;
}) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="text-2xl">{value}</CardTitle>
			</CardHeader>
			{detail && (
				<CardContent>
					<p className="text-muted-foreground text-xs">{detail}</p>
				</CardContent>
			)}
		</Card>
	);
}
