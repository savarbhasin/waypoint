// Workflow detail URLs use the database id (/w/[id]) so links stay stable when a workflow is renamed.
import { WorkflowDetailClient } from "@/components/WorkflowDetailClient";

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkflowDetailClient id={id} />;
}
