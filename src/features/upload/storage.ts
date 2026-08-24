import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/http";

export const uploadRoot = path.join(process.cwd(), "uploads");

/** Taille maximale d'un fichier uploadé (20 Mo). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Types MIME autorisés à l'upload (pièces jointes métier). Tout type exécutable
 * côté client (HTML, SVG, XML, JS) est refusé.
 */
export const ALLOWED_UPLOAD_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/octet-stream",
]);

/** Types pouvant être rendus `inline` sans risque d'exécution dans l'origine. */
export const INLINE_SAFE_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
]);

export function isAllowedUploadType(mimeType: string): boolean {
  return ALLOWED_UPLOAD_MIME_TYPES.has(mimeType.toLowerCase());
}

export function isInlineSafeMime(mimeType: string): boolean {
  return INLINE_SAFE_MIME_TYPES.has(mimeType.toLowerCase());
}

export async function ensureUploadsDir(): Promise<void> {
  await mkdir(uploadRoot, { recursive: true });
}

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[^\w.\-\u0600-\u06FF ]/g, "").replace(/\s+/g, "_");
  return base.slice(0, 120);
}

export function sanitizeStorageKey(key: string): string | null {
  if (!key || key.includes("..") || key.includes("/") || key.includes("\\")) {
    return null;
  }
  if (!/^[\w.\-]+$/.test(key)) return null;
  return key;
}

export type StoredFile = {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export async function saveUploadFile(file: File): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      413,
      `Fichier trop volumineux (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} Mo).`,
      "FILE_TOO_LARGE",
    );
  }
  await ensureUploadsDir();
  const originalName = sanitizeFileName(file.name || "fichier");
  const storageKey = `${Date.now()}-${randomUUID().slice(0, 8)}-${originalName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadRoot, storageKey), buffer);
  return {
    storageKey,
    originalName: file.name || originalName,
    mimeType: file.type || "application/octet-stream",
    size: buffer.byteLength,
  };
}

export async function readUploadFile(
  storageKey: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const safeKey = sanitizeStorageKey(storageKey);
  if (!safeKey) return null;
  try {
    const buffer = await readFile(path.join(uploadRoot, safeKey));
    return { buffer, mimeType: "application/octet-stream" };
  } catch {
    return null;
  }
}

/** Supprime un fichier uploadé (clé validée par `sanitizeStorageKey`). Best-effort. */
export async function deleteUploadFile(storageKey: string): Promise<boolean> {
  const safeKey = sanitizeStorageKey(storageKey);
  if (!safeKey) return false;
  try {
    await rm(path.join(uploadRoot, safeKey), { force: true });
    return true;
  } catch {
    return false;
  }
}

export function uploadUrl(storageKey: string): string {
  return `/api/files/${encodeURIComponent(storageKey)}`;
}
