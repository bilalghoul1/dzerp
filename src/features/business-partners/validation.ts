import { z } from "zod";

// Shared validation helpers for business-partner modules (customers/suppliers).
// Smart validation: optional fields are only validated when actually filled.

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? undefined : v || null));

const optionalNumeric = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .refine((v) => !v || /^\d+$/.test(v), {
      message: "Field must contain digits only.",
    })
    .transform((v) => (v === undefined ? undefined : v || null));

const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .optional()
  .nullable()
  .refine((v) => !v || z.string().email().safeParse(v).success, {
    message: "Invalid email address.",
  })
  .transform((v) => (v === undefined ? undefined : v || null));

export const businessPartnerCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  nameAr: optionalText(160),
  type: z.enum(["COMPANY", "INDIVIDUAL"]),
  firstName: optionalText(80),
  lastName: optionalText(80),
  legalName: optionalText(160),
  commercialName: optionalText(160),
  legalForm: optionalText(120),
  activity: optionalText(160),
  sector: optionalText(160),
  email: optionalEmail,
  phone: optionalText(40),
  taxId: optionalNumeric(20),
  rc: optionalText(40),
  nis: optionalNumeric(20),
  ai: optionalNumeric(20),
  vatNumber: optionalText(40),
  address: optionalText(255),
  wilaya: optionalText(20),
  commune: optionalText(20),
  postalCode: optionalText(20),
  paymentTerms: optionalText(120),
  creditLimit: z
    .union([z.number().min(0), z.literal("")])
    .optional()
    .nullable()
    .transform((v) =>
      v === "" || v === null || v === undefined ? undefined : v,
    ),
  notes: optionalText(2000),
  isActive: z.boolean().optional(),
});

export const businessPartnerUpdateSchema = businessPartnerCreateSchema.partial();

export type BusinessPartnerCreateInput = z.infer<
  typeof businessPartnerCreateSchema
>;
export type BusinessPartnerUpdateInput = z.infer<
  typeof businessPartnerUpdateSchema
>;
