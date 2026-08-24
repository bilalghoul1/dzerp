import type {
  ActivityType,
  AuditAction,
  CompanyStatus,
  DocType,
  UserStatus,
} from "@/generated/prisma/enums";

/** Acteur de l'administration globale (session + permissions effectives). */
export type AdminActor = {
  userId: string;
  permissions: readonly string[];
  /** Société active de l'acteur — contrainte pour les administrateurs de société. */
  activeCompanyId: string | null;
  /** Porteur du rôle global SUPER_ADMIN : seul profil habilité à administrer la plateforme. */
  isSuperAdmin: boolean;
};

/** Événement récent de la plateforme (tableau de bord Super Admin). */
export type PlatformActivityEntry = {
  id: string;
  type: ActivityType;
  title: string;
  titleAr: string | null;
  actorName: string | null;
  companyName: string | null;
  createdAt: string;
};

/** Statistiques globales de la plateforme (tableau de bord Super Admin). */
export type PlatformStats = {
  companiesTotal: number;
  companiesActive: number;
  companiesInactive: number;
  companiesSuspended: number;
  companiesArchived: number;
  usersTotal: number;
  usersActive: number;
  usersInactive: number;
  usersSuspended: number;
  sessionsActive: number;
  branchesTotal: number;
  recentCompanies: CompanyAdminRow[];
  recentActivity: PlatformActivityEntry[];
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
  createdAt: string;
  logoKey: string | null;
  branchCount: number;
  memberCount: number;
  ownerName: string | null;
  ownerUsername: string | null;
};

/** Propriétaire (OWNER) d'une société — créé avec un mot de passe temporaire. */
export type CompanyOwnerView = {
  userId: string;
  userCompanyId: string;
  username: string;
  fullName: string | null;
  email: string | null;
  status: string;
  mustChangePassword: boolean;
  joinedAt: string;
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
  owner: CompanyOwnerView | null;
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
  /** Créer un compte Propriétaire neuf (nom, identifiant, email, mot de passe temporaire). */
  owner?: {
    fullName: string;
    username: string;
    email?: string | null;
    password: string;
  } | null;
};

/** Résultat de la création : détail société + identifiants temporaires du propriétaire. */
export type CompanyCreateResult = {
  company: CompanyAdminDetail;
  owner: { username: string; temporaryPassword: string } | null;
};

export type CompanyUpdateInput = Partial<
  Omit<CompanyCreateInput, "code" | "series" | "branches" | "members" | "owner">
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

/** Compte utilisateur au niveau plateforme (Phase 7.5 — contrôle central). */
export type PlatformUserRow = {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  memberships: {
    userCompanyId: string;
    companyId: string;
    companyCode: string;
    companyName: string;
    active: boolean;
    isDefault: boolean;
    joinedAt: string;
    roles: { roleId: string; roleKey: string; roleName: string }[];
  }[];
};

/** Session utilisateur au niveau plateforme (Phase 7.5 — contrôle central). */
export type PlatformSessionRow = {
  id: string;
  userId: string;
  username: string;
  fullName: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  activeCompanyId: string | null;
  activeCompanyName: string | null;
};

/** Options de recherche de la liste plateforme des utilisateurs. */
export type PlatformUsersQuery = {
  q?: string;
  status?: UserStatus;
};

/** Options de recherche de la liste plateforme des sessions. */
export type PlatformSessionsQuery = {
  q?: string;
  /** `true` : sessions actives uniquement ; `false` : sessions révoquées. */
  active?: boolean;
};

/** Vue d'ensemble de sécurité de la plateforme (Phase 7.5 — Security Center). */
export type PlatformSecurityOverview = {  /** Comptes protégés (rôle global SUPER_ADMIN). */
  protectedAccounts: {
    id: string;
    username: string;
    fullName: string | null;
    lastLoginAt: string | null;
    createdAt: string;
  }[];
  totalUsers: number;
  activeSessions: number;
  sessionsLast24h: number;
  revokedSessionsLast30d: number;
  usersByStatus: { status: UserStatus; count: number }[];
  /** Comptes devant changer leur mot de passe à la prochaine connexion. */
  mustChangePassword: number;
  roles: {
    roleId: string;
    roleKey: string;
    roleName: string;
    roleNameAr: string | null;
    isSystem: boolean;
    memberCount: number;
    permissionCount: number;
  }[];
  recentSecurityEvents: {
    id: string;
    type: ActivityType;
    entity: string;
    title: string;
    titleAr: string | null;
    actorName: string | null;
    companyName: string | null;
    createdAt: string;
  }[];
};

/** Entrée du journal d'audit de la plateforme (Phase 7.5 — Audit Log). */
export type PlatformAuditEntry = {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  actorName: string | null;
  actorUsername: string | null;
  companyName: string | null;
  changes: unknown;
  createdAt: string;
};

/** Options de recherche du journal d'audit plateforme. */
export type PlatformAuditQuery = {
  /** Recherche libre dans l'entité et son identifiant. */
  q?: string;
  action?: string;
  entity?: string;
  actorId?: string;
  companyId?: string;
  from?: string;
  to?: string;
};

/** Vérification individuelle de l'état de santé de la plateforme. */
export type PlatformHealthCheck = {
  key: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
};

/** État de santé global de la plateforme (Phase 7.5 — Maintenance). */
export type PlatformHealth = {
  database: {
    reachable: boolean;
    latencyMs: number;
  };
  counts: {
    companies: number;
    users: number;
    activeSessions: number;
    auditEntries: number;
    files: number;
    memberships: number;
  };
  checks: PlatformHealthCheck[];
  checkedAt: string;
};

/** Statistique d'une table de la base (Phase 7.5 — Sauvegardes). */
export type DatabaseTableStat = {
  table: string;
  label: string;
  rows: number;
};

/** Ligne de paramètre plateforme (Phase 7.5 — Paramètres). */
export type PlatformSettingRow = {
  key: string;
  value: unknown;
  type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "SECRET";
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
};

/** Agrégats d'activité de la plateforme (Phase 7.5 — Analytics). */
export type PlatformAnalytics = {
  companiesByStatus: { status: CompanyStatus; count: number }[];
  usersByStatus: { status: UserStatus; count: number }[];
  documentsByType: { docType: DocType; label: string; labelAr: string | null; count: number }[];
  auditByAction: { action: AuditAction; count: number }[];
  activityByType: { type: ActivityType; count: number }[];
  /** 7 derniers jours complets (clé : date ISO UTC). */
  activityLast7d: { day: string; count: number }[];
  sessionsLast7d: { day: string; count: number }[];
  totals: {
    companies: number;
    users: number;
    activeSessions: number;
    auditEntries: number;
  };
};
