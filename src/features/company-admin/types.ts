import type { CompanyStatus, DocType } from "@/generated/prisma/enums";

/** Acteur de l'administration globale (session + permissions effectives). */
export type AdminActor = {
  userId: string;
  permissions: readonly string[];
  /** Société active de l'acteur — contrainte pour les administrateurs de société. */
  activeCompanyId: string | null;
};

/** Ligne du tableau des sociétés. */
export type CompanyAdminRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  commercialName: string | null;
  legalName: string | null;
  type: string | null;
  taxId: string | null;
  rc: string | null;
  nis: string | null;
  ai: string | null;
  status: CompanyStatus;
  isActive: boolean;
  /** Renseigné uniquement dans la vue « sociétés supprimées ». */
  deletedAt: string | null;
  createdAt: string;
  logoKey: string | null;
  branchCount: number;
  memberCount: number;
};

/** Détail complet d'une société (onglets). */
export type CompanyAdminDetail = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  commercialName: string | null;
  legalName: string | null;
  legalForm: string | null;
  activity: string | null;
  secondaryActivity: string | null;
  type: string | null;
  capital: string | null;
  establishedAt: string | null;
  expiryDate: string | null;
  taxId: string | null;
  rc: string | null;
  nis: string | null;
  ai: string | null;
  vatNumber: string | null;
  address: string | null;
  country: string | null;
  wilaya: string | null;
  commune: string | null;
  postalCode: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  currency: string;
  fiscalYear: number | null;
  language: string;
  bank: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  rib: string | null;
  iban: string | null;
  swift: string | null;
  paymentTerms: string | null;
  notes: string | null;
  logoKey: string | null;
  stampKey: string | null;
  signatureKey: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  invoiceFooter: string | null;
  emailFooter: string | null;
  printHeader: string | null;
  printFormat: string;
  printMargins: Record<string, number> | null;
  qrEnabled: boolean;
  status: CompanyStatus;
  isActive: boolean;
  isDefault: boolean;
  defaultBranch: { id: string; code: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

/** Données envoyées par l'assistant à la création d'une société. */
export type CompanyCreateInput = {
  code: string;
  name: string;
  nameAr?: string | null;
  commercialName?: string | null;
  legalName?: string | null;
  legalForm?: string | null;
  activity?: string | null;
  secondaryActivity?: string | null;
  type?: string | null;
  capital?: string | null;
  establishedAt?: string | null;
  expiryDate?: string | null;
  taxId?: string | null;
  rc?: string | null;
  nis?: string | null;
  ai?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  country?: string | null;
  wilaya?: string | null;
  commune?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  website?: string | null;
  currency?: string;
  fiscalYear?: number | null;
  language?: string;
  bank?: string | null;
  bankAgency?: string | null;
  bankAccount?: string | null;
  rib?: string | null;
  iban?: string | null;
  swift?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  logoKey?: string | null;
  stampKey?: string | null;
  signatureKey?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  invoiceFooter?: string | null;
  emailFooter?: string | null;
  printHeader?: string | null;
  printFormat?: string;
  printMargins?: Record<string, number> | null;
  qrEnabled?: boolean;
  defaultBranchCode?: string | null;
  series?: {
    docType: DocType;
    prefix?: string;
    separator?: string;
    suffix?: string;
    withYear?: boolean;
    padLength?: number;
    step?: number;
    nextValue?: number;
  }[];
  branches?: {
    code: string;
    name: string;
    nameAr?: string | null;
    type?: "HEADQUARTER" | "DIRECTION" | "AGENCY";
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    manager?: string | null;
  }[];
  members?: {
    userId: string;
    roleId: string;
    defaultBranchCode?: string | null;
  }[];
};

export type CompanyUpdateInput = Partial<
  Omit<CompanyCreateInput, "code" | "series" | "branches" | "members">
>;

/** Statistiques d'une société (onglet). */
export type CompanyStatistics = {
  branches: number;
  users: number;
  activeMembers: number;
  customers: number;
  suppliers: number;
  products: number;
  warehouses: number;
  lastLogin: string | null;
};

/** Membre affecté à une société (onglet utilisateurs). */
export type CompanyMemberView = {
  userCompanyId: string;
  userId: string;
  username: string;
  fullName: string | null;
  email: string | null;
  status: string;
  lastLoginAt: string | null;
  active: boolean;
  isDefault: boolean;
  joinedAt: string;
  defaultBranch: { id: string; code: string; name: string } | null;
  roles: {
    assignmentId: string;
    roleId: string;
    roleKey: string;
    roleName: string;
    active: boolean;
    expiresAt: string | null;
  }[];
};

/** Vue branche complète (réutilisée par BranchesManager). */
export type CompanyBranchAdmin = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  type: "HEADQUARTER" | "DIRECTION" | "AGENCY";
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager: string | null;
  country: string | null;
  wilaya: string | null;
  commune: string | null;
  postalCode: string | null;
  rc: string | null;
  nif: string | null;
  nis: string | null;
  ai: string | null;
  isActive: boolean;
  isDefault: boolean;
};

/** Données de création / mise à jour d'une branche (sous-ressource admin). */
export type CompanyBranchInput = {
  /** Requis à la création (le code n'est pas modifiable à la mise à jour). */
  code?: string;
  name?: string;
  nameAr?: string | null;
  type?: "HEADQUARTER" | "DIRECTION" | "AGENCY";
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  manager?: string | null;
  country?: string | null;
  wilaya?: string | null;
  commune?: string | null;
  postalCode?: string | null;
  rc?: string | null;
  nif?: string | null;
  nis?: string | null;
  ai?: string | null;
  isActive?: boolean;
};
