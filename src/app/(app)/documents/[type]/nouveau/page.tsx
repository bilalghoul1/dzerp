import { notFound } from "next/navigation";
import { parseDocTypeParam } from "@/features/documents/framework/ui-config";
import { DocumentEditorPage } from "@/components/documents/pages/document-editor-page";

type PageProps = { params: Promise<{ type: string }> };

export default async function DocumentNewRoute({ params }: PageProps) {
  const { type } = await params;
  const docType = parseDocTypeParam(type);
  if (!docType) notFound();
  return <DocumentEditorPage type={docType} />;
}
