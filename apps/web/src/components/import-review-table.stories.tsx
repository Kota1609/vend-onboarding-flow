import type { Meta, StoryObj } from "@storybook/react";
import { ImportReviewTable } from "./import-review-table";

const meta: Meta<typeof ImportReviewTable> = {
  title: "Components/ImportReviewTable",
  component: ImportReviewTable,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Review table for AI-extracted member data. Shows confidence badges, inline editing, duplicate detection, and accept/reject toggles.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ImportReviewTable>;

export const Default: Story = {
  args: {
    batchId: "test_batch_id" as any,
    onConfirm: () => console.log("Confirmed"),
    onCancel: () => console.log("Cancelled"),
  },
};

export const Empty: Story = {
  args: {
    batchId: "empty_batch_id" as any,
    onConfirm: () => console.log("Confirmed"),
    onCancel: () => console.log("Cancelled"),
  },
};

export const AllLowConfidence: Story = {
  args: {
    batchId: "low_confidence_batch_id" as any,
    onConfirm: () => console.log("Confirmed"),
    onCancel: () => console.log("Cancelled"),
  },
};
