import type { Preview } from "@storybook/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import React from "react";
import { AuthProvider } from "../src/lib/auth-context";
import "../src/index.css";

// Use a fake URL so queries stay in loading state — never hits the real backend
const mockConvex = new ConvexReactClient("https://storybook-mock.convex.cloud");

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
	},
	decorators: [
		(Story) => (
			<ConvexProvider client={mockConvex}>
				<AuthProvider>
					<Story />
				</AuthProvider>
			</ConvexProvider>
		),
	],
};

export default preview;
