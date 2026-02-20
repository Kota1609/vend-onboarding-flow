import type { Meta, StoryObj } from "@storybook/react";
import { AiImportCard } from "./ai-import-card";

const meta: Meta<typeof AiImportCard> = {
  title: "Components/AiImportCard",
  component: AiImportCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "AI-powered document import card. Supports PDF, CSV, Excel, images, and pasted text. Extracts member data using Anthropic Claude.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AiImportCard>;

export const Default: Story = {
  args: {
    tenantId: "test_tenant_id" as any,
    passId: "test_pass_id" as any,
    onComplete: () => console.log("Import complete"),
    onCancel: () => console.log("Import cancelled"),
  },
};

export const WithExistingMembers: Story = {
  args: {
    tenantId: "test_tenant_id" as any,
    passId: "test_pass_id" as any,
    onComplete: () => console.log("Import complete"),
    onCancel: () => console.log("Import cancelled"),
  },
};
