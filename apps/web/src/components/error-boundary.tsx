import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	render() {
		if (this.state.hasError) {
			return (
				<Card className="m-6">
					<CardHeader>
						<CardTitle>Something went wrong</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="mb-4 text-muted-foreground text-sm">
							{this.state.error?.message ?? "An unexpected error occurred."}
						</p>
						<Button
							onClick={() => this.setState({ hasError: false, error: null })}
						>
							Try Again
						</Button>
					</CardContent>
				</Card>
			);
		}
		return this.props.children;
	}
}
