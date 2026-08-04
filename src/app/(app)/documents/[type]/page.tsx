import { notFound } from "next/navigation";
import { parseDocTypeParam } from "@/features/documents/framework/ui-config";
import { DocumentListPage } from "@/components/documents/pages/document-list-page";

type PageProps = { params: Promise<{ type: string }> };

export default async function DocumentsListRoute({ params }: PageProps) {
  const { type } = await params;
  const docType = parseDocTypeParam(type);
  if (!docType) notFound();
  return <DocumentListPage type={docType} />;
}
