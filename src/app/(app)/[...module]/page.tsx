import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/shell/coming-soon";

/** Modules volontairement en construction (placeholder) conservant ComingSoon. */
const PLACEHOLDER_MODULES = new Set(["aide"]);

export default async function ModuleCatchAllPage({
  params,
}: {
  params: Promise<{ module: string[] }>;
}) {
  const { module } = await params;
  const first = module?.[0];

  if (first && PLACEHOLDER_MODULES.has(first)) {
    return <ComingSoon moduleKey={first} />;
  }

  notFound();
}