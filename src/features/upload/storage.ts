import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const uploadRoot = path.join(process.cwd(), "uploads");

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

export function uploadUrl(storageKey: string): string {
  return `/api/files/${encodeURIComponent(storageKey)}`;
}
