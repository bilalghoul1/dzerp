import { notFound } from "next/navigation";
import { parseDocTypeParam } from "@/features/documents/framework/ui-config";
import { DocumentEditorPage } from "@/components/documents/pages/document-editor-page";

type PageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ customerId?: string }>;
};

export default async function DocumentNewRoute({
  params,
  searchParams,
}: PageProps) {
  const { type } = await params;
  const docType = parseDocTypeParam(type);
  if (!docType) notFound();
  const { customerId } = await searchParams;
  return (
    <DocumentEditorPage type={docType} initialCustomerId={customerId ?? null} />
  );
}
