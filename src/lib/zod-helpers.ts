import { z } from "zod";

/**
 * Helpers zod partagés (validation « smart » : les champs optionnels ne sont
 * validés que lorsqu'ils sont réellement renseignés).
 */

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? undefined : v || null));

export const optionalDecimal = (min = 0, max = 1_000_000_000) =>
  z
    .union([z.number(), z.string().trim()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isNaN(n) ? undefined : n;
    })
    .refine((v) => v === undefined || (v >= min && v <= max), {
      message: `Value must be between ${min} and ${max}.`,
    });

export const optionalId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === undefined || v === null || v === "" ? null : v));
