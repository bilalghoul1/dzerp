import { prisma } from "@/lib/prisma";
import type { DocType } from "@/generated/prisma/enums";

export type DocumentSeriesView = {
  id: string;
  key: string;
  docType: DocType;
  label: string;
  labelAr: string | null;
  prefix: string;
  separator: string;
  suffix: string;
  withYear: boolean;
  year: number | null;
  nextValue: bigint;
  padLength: number;
  step: number;
  isActive: boolean;
};

export type NextDocumentNumberResult = {
  number: string;
  seriesId: string;
  nextValue: bigint;
};

function pad(value: bigint, length: number): string {
  return value.toString().padStart(Math.max(length, 1), "0");
}

/** Formate un numéro à partir d'une série (prévisualisation sans incrément). */
export function formatSeriesNumber(
  series: Pick<
    DocumentSeriesView,
    "prefix" | "separator" | "suffix" | "withYear" | "year" | "padLength"
  >,
  seq: bigint | number,
): string {
  const year = series.withYear
    ? String(series.year ?? new Date().getFullYear())
    : "";
  return `${series.prefix}${year}${series.separator}${pad(BigInt(seq), series.padLength)}${series.suffix}`;
}

/** Exemple de prochain numéro pour une série, sans incrémenter. */
export function previewNextNumber(
  series: Pick<
    DocumentSeriesView,
    "prefix" | "separator" | "suffix" | "withYear" | "year" | "padLength"
  > & { nextValue: bigint | number },
): string {
  return formatSeriesNumber(series, series.nextValue);
}

/**
 * Alloue le prochain numéro d'une série documentaire de façon atomique
 * (compare-and-swap) : deux appels concurrents ne peuvent pas obtenir le même
 * numéro. Throws si aucune série active n'est configurée pour le type.
 */
export async function nextDocumentNumber(
  docType: DocType,
): Promise<NextDocumentNumberResult> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const series = await prisma.documentSeries.findFirst({
      where: { docType, isActive: true },
    });

    if (!series) {
      throw new Error(`No active series for doc type "${docType}".`);
    }

    const nextValue = series.nextValue;
    const updated = await prisma.documentSeries.updateMany({
      where: { id: series.id, nextValue },
      data: { nextValue: nextValue + BigInt(series.step) },
    });

    if (updated.count === 1) {
      return {
        number: formatSeriesNumber(series, nextValue),
        seriesId: series.id,
        nextValue,
      };
    }
  }

  throw new Error(`Numbering saturated for doc type "${docType}".`);
}

/** Liste des séries, utilisée par la configuration de la numérotation. */
export async function listDocumentSeries(): Promise<DocumentSeriesView[]> {
  const rows = await prisma.documentSeries.findMany({
    orderBy: { key: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    docType: row.docType,
    label: row.label,
    labelAr: row.labelAr,
    prefix: row.prefix,
    separator: row.separator,
    suffix: row.suffix,
    withYear: row.withYear,
    year: row.year,
    nextValue: row.nextValue,
    padLength: row.padLength,
    step: row.step,
    isActive: row.isActive,
  }));
}
