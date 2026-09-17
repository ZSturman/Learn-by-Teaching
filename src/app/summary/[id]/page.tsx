import { SessionSummaryScreen } from "@/components/summary/session-summary-screen";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SessionSummaryScreen sessionId={id} />;
}
