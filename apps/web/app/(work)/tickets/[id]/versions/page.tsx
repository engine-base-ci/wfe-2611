// チケットの版と差分（K-449・道 /tickets/[id]/versions?of=items&from=&to=）。中身は apps/web/features/F4/versions/versions-page.tsx
import { VersionsPage } from "@/features/F4/versions/versions-page";

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | null => (typeof v === "string" ? v : null);

export default async function TicketVersions({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  const { id } = await params;
  const q = await searchParams;
  return <VersionsPage id={id} of={one(q["of"])} from={one(q["from"])} to={one(q["to"])} />;
}
