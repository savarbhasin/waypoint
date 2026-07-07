import { WorkflowDetailClient } from "@/components/WorkflowDetailClient";

export default async function WorkflowPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <WorkflowDetailClient name={name} />;
}
