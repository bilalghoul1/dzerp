import { z } from "zod";
import { DocType } from "@/generated/prisma/enums";

const seriesSchema = z.object({
  docType: z.nativeEnum(DocType),
  prefix: z.string().trim().max(20).optional(),
  separator: z.string().trim().max(4).optional(),
  suffix: z.string().trim().max(20).optional(),
  withYear: z.boolean().optional(),
  padLength: z.number().int().min(1).max(12).optional(),
  step: z.number().int().min(1).max(99).optional(),
  nextValue: z.number().int().min(1).optional(),
});

const branchSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().max(120).optional().nullable(),
  type: z.enum(["HEADQUARTER", "DIRECTION", "AGENCY"]).optional(),
  city: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable(),
  manager: z.string().trim().max(120).optional().nullable(),
});

const memberSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  defaultBranchCode: z.string().trim().max(20).optional().nullable(),
});

/** Compte Propriétaire neuf créé lors de l'ajout d'une société. */
const ownerSchema = z.object({
  fullName: z.string().trim().min(1, "Nom complet requis").max(160),
  username: z
    .string()
    .trim()
    .min(3, "Identifiant (3 caractères minimum)")
    .max(60)
    .regex(/^\S+$/, "L'identifiant ne doit pas contenir d'espaces."),
  email: z.string().trim().email("Email invalide").max(160).optional().nullable(),
  password: z
    .string()
    .min(8, "Le mot de passe temporaire doit contenir au moins 8 caractères.")
    .max(256),
});

const companyFieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().max(160).optional().nullable(),
  commercialName: z.string().trim().max(160).optional().nullable(),
  legalName: z.string().trim().max(160).optional().nullable(),
  legalForm: z.string().trim().max(80).optional().nullable(),
  activity: z.string().trim().max(255).optional().nullable(),
  secondaryActivity: z.string().trim().max(255).optional().nullable(),
  type: z.string().trim().max(80).optional().nullable(),
  capital: z.string().trim().max(40).optional().nullable(),
  establishedAt: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  taxId: z.string().trim().max(40).optional().nullable(),
  rc: z.string().trim().max(40).optional().nullable(),
  nis: z.string().trim().max(40).optional().nullable(),
  ai: z.string().trim().max(40).optional().nullable(),
  vatNumber: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  country: z.string().trim().max(20).optional().nullable(),
  wilaya: z.string().trim().max(20).optional().nullable(),
  commune: z.string().trim().max(20).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  mobile: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable(),
  website: z.string().trim().max(160).optional().nullable(),
  currency: z.string().trim().max(12).optional(),
  fiscalYear: z.number().int().positive().max(2100).optional().nullable(),
  language: z.enum(["fr", "ar", "en"]).optional(),
  bank: z.string().trim().max(120).optional().nullable(),
  bankAgency: z.string().trim().max(120).optional().nullable(),
  bankAccount: z.string().trim().max(40).optional().nullable(),
  rib: z.string().trim().max(40).optional().nullable(),
  iban: z.string().trim().max(40).optional().nullable(),
  swift: z.string().trim().max(20).optional().nullable(),
  paymentTerms: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  logoKey: z.string().trim().max(255).optional().nullable(),
  stampKey: z.string().trim().max(255).optional().nullable(),
  signatureKey: z.string().trim().max(255).optional().nullable(),
  primaryColor: z.string().trim().max(20).optional().nullable(),
  secondaryColor: z.string().trim().max(20).optional().nullable(),
  invoiceFooter: z.string().trim().max(2000).optional().nullable(),
  emailFooter: z.string().trim().max(2000).optional().nullable(),
  printHeader: z.string().trim().max(2000).optional().nullable(),
  printFormat: z.enum(["A4", "A5", "THERMAL"]).optional(),
  printMargins: z.record(z.string(), z.number()).optional().nullable(),
  qrEnabled: z.boolean().optional(),
  defaultBranchCode: z.string().trim().max(20).optional().nullable(),
});

export const companyCreateSchema = companyFieldsSchema.extend({
  code: z.string().trim().min(1).max(20),
  series: z.array(seriesSchema).optional(),
  branches: z.array(branchSchema).optional(),
  members: z.array(memberSchema).optional(),
  owner: ownerSchema.optional().nullable(),
});

export const companyUpdateSchema = companyFieldsSchema.partial();

export const companyStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"]),
});

export const resetOwnerPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères.")
    .max(256),
});

/** Réinitialisation d'un mot de passe utilisateur (SUPER_ADMIN uniquement). */
export const resetUserPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères.")
    .max(256),
});

/** Modification des identifiants d'un membre de société (SUPER_ADMIN uniquement). */
export const updateUserIdentitySchema = z.object({
  fullName: z.string().trim().max(160).optional().nullable(),
  username: z
    .string()
    .trim()
    .min(3, "L'identifiant doit contenir au moins 3 caractères.")
    .max(60)
    .regex(/^\S+$/, "L'identifiant ne doit pas contenir d'espaces.")
    .optional(),
  email: z.string().trim().email("Email invalide").max(160).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  defaultBranchCode: z.string().trim().max(20).optional().nullable(),
});

export const updateMemberSchema = z.object({
  roleId: z.string().min(1).optional().nullable(),
  active: z.boolean().optional(),
  defaultBranchCode: z.string().trim().max(20).optional().nullable(),
});

/** Suppression définitive d'un utilisateur (SUPER_ADMIN uniquement). */
export const deleteUserConfirmationSchema = z.object({
  confirmation: z.string().trim().min(1),
});

export const draftSchema = z.object({
  step: z.number().int().min(0).max(9),
  data: z.record(z.string(), z.unknown()),
});
