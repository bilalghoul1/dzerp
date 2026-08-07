import type { CommercialDocType } from "@/features/documents/engine/types";
import type {
  AttachmentItem,
  DocumentDetailModel,
  ListResult,
  RelationItem,
  TransitionsResult,
} from "./ui-types";
import {
  normalizeAttachment,
  normalizeDocumentDetail,
  normalizeDocumentRow,
  normalizeRelation,
} from "./normalize";

export class DocumentApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DocumentApiError";
  }
}

type ErrorEnvelope = {
  error?: { message?: string; code?: string };
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const json = (await res.json().catch(() => null)) as
    | { data?: T }
    | ErrorEnvelope
    | null;

  if (!res.ok) {
    const error =
      json && typeof json === "object" && "error" in json
        ? (json as ErrorEnvelope).error
        : undefined;
    throw new DocumentApiError(
      error?.message ?? "Erreur API",
      error?.code,
    );
  }

  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export function listDocumentsUrl(
  type: CommercialDocType,
  params: ListParams = {},
): string {
  const qs = new URLSearchParams({ type });
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  return `/api/documents?${qs.toString()}`;
}

export async function listDocuments(
  type: CommercialDocType,
  params: ListParams = {},
): Promise<ListResult> {
  const raw = await request<{ items: Record<string, unknown>[]; total: number; page: number; pageSize: number }>(
    listDocumentsUrl(type, params),
  );
  return {
    items: raw.items.map((item) => normalizeDocumentRow(item, type)),
    total: raw.total,
    page: raw.page,
    pageSize: raw.pageSize,
  };
}

export async function getDocument(
  type: CommercialDocType,
  docId: string,
): Promise<DocumentDetailModel> {
  const raw = await request<Record<string, unknown>>(
    `/api/documents/${docId}?type=${type}`,
  );
  return normalizeDocumentDetail(raw, type);
}

export async function createDocument(
  type: CommercialDocType,
  payload: Record<string, unknown>,
): Promise<DocumentDetailModel> {
  const raw = await request<Record<string, unknown>>(
    `/api/documents?type=${type}`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return normalizeDocumentDetail(raw, type);
}

export async function updateDocument(
  type: CommercialDocType,
  docId: string,
  payload: Record<string, unknown>,
): Promise<DocumentDetailModel> {
  const raw = await request<Record<string, unknown>>(
    `/api/documents/${docId}?type=${type}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return normalizeDocumentDetail(raw, type);
}

export async function deleteDocument(
  type: CommercialDocType,
  docId: string,
): Promise<void> {
  await request<{ deleted: boolean }>(`/api/documents/${docId}?type=${type}`, {
    method: "DELETE",
  });
}

export async function getTransitions(
  type: CommercialDocType,
  docId: string,
): Promise<TransitionsResult> {
  return request<TransitionsResult>(
    `/api/documents/${docId}/status?type=${type}`,
  );
}

export async function changeStatus(
  type: CommercialDocType,
  docId: string,
  targetStatus: string,
): Promise<void> {
  await request<{ success: boolean }>(
    `/api/documents/${docId}/status?type=${type}`,
    { method: "PATCH", body: JSON.stringify({ targetStatus }) },
  );
}

export async function approveDocument(
  type: CommercialDocType,
  docId: string,
): Promise<void> {
  await request<{ success: boolean }>(
    `/api/documents/${docId}/status?type=${type}&action=approve`,
    { method: "PATCH", body: JSON.stringify({}) },
  );
}

export async function getRelations(
  type: CommercialDocType,
  docId: string,
): Promise<RelationItem[]> {
  const raw = await request<Record<string, unknown>[]>(
    `/api/documents/${docId}/relations?type=${type}`,
  );
  return raw.map(normalizeRelation);
}

export async function getConversionHistory(
  type: CommercialDocType,
  docId: string,
): Promise<RelationItem[]> {
  const raw = await request<Record<string, unknown>[]>(
    `/api/documents/${docId}/relations?type=${type}&history=true`,
  );
  return raw.map(normalizeRelation);
}

export type DocumentActivityEvent = {
  id: string;
  type: string;
  title: string;
  titleAr: string | null;
  actorName: string | null;
  createdAt: string;
  meta: {
    docType?: unknown;
    from?: unknown;
    to?: unknown;
  } | null;
};

export async function getDocumentActivity(
  type: CommercialDocType,
  docId: string,
): Promise<DocumentActivityEvent[]> {
  const raw = await request<Record<string, unknown>[]>(
    `/api/documents/${docId}/activity?type=${type}`,
  );
  return raw.map((item) => ({
    id: String(item.id),
    type: String(item.type),
    title: String(item.title),
    titleAr: item.titleAr == null ? null : String(item.titleAr),
    actorName: item.actorName == null ? null : String(item.actorName),
    createdAt: String(item.createdAt),
    meta:
      item.meta && typeof item.meta === "object"
        ? (item.meta as DocumentActivityEvent["meta"])
        : null,
  }));
}

export async function convertDocument(input: {
  sourceDocType: CommercialDocType;
  sourceDocId: string;
  targetDocType: CommercialDocType;
  conversionRate?: number;
  description?: string;
}): Promise<{ relationId: string; sourceNumber: string }> {
  return request<{ relationId: string; sourceNumber: string }>(
    "/api/documents/convert",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function listAttachments(
  entity: string,
  entityId: string,
): Promise<AttachmentItem[]> {
  const raw = await request<Record<string, unknown>[]>(
    `/api/documents/${entityId}/attachments?entity=${encodeURIComponent(entity)}`,
  );
  return raw.map(normalizeAttachment);
}

export async function deleteAttachment(
  entity: string,
  entityId: string,
  attachmentId: string,
): Promise<void> {
  await request<{ deleted: boolean }>(
    `/api/documents/${entityId}/attachments?entity=${encodeURIComponent(entity)}&attachmentId=${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );
}

export async function uploadAttachments(
  files: File[],
  entity: string,
  entityId: string,
): Promise<void> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  formData.append("entity", entity);
  formData.append("entityId", entityId);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const json = (await res.json().catch(() => null)) as
    | { data?: unknown }
    | ErrorEnvelope
    | null;

  if (!res.ok) {
    const error =
      json && typeof json === "object" && "error" in json
        ? (json as ErrorEnvelope).error
        : undefined;
    throw new DocumentApiError(error?.message ?? "Erreur d'envoi", error?.code);
  }
}
