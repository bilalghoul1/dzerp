import type { PermissionKey } from "@/features/auth/permissions";

export type SessionUser = {
  id: string;
  username: string;
  email: string | null;
  fullName: string | null;
  title: string | null;
  branchId: string | null;
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
  branch: {
    id: string;
    code: string;
    name: string;
    nameAr: string | null;
  } | null;
  roles: {
    role: { key: string; name: string; nameAr: string | null };
  }[];
};

export type SessionContext = {
  user: SessionUser;
  permissions: PermissionKey[];
  /** L'utilisateur porte le rôle global SUPER_ADMIN (niveau plateforme, hors société). */
  isSuperAdmin: boolean;
};
