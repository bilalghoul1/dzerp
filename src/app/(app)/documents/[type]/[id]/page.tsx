import { notFound } from "next/navigation";
import { parseDocTypeParam } from "@/features/documents/framework/ui-config";
import { DocumentEditorPage } from "@/components/documents/pages/document-editor-page";

type PageProps = {
  params: Promise<{ type: string; id: string }>;
};

export default async function DocumentViewRoute({ params }: PageProps) {
  const { type, id } = await params;
  const docType = parseDocTypeParam(type);
  if (!docType) notFound();
  return <DocumentEditorPage type={docType} docId={id} />;
}
