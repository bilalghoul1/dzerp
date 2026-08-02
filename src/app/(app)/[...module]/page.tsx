import { ComingSoon } from "@/components/shell/coming-soon";

export default async function ModuleCatchAllPage({
  params,
}: {
  params: Promise<{ module: string[] }>;
}) {
  const { module } = await params;
  return <ComingSoon moduleKey={module?.[0]} />;
}
