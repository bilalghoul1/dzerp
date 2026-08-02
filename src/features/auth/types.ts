import type { PermissionKey } from "@/features/auth/permissions";

export type SessionUser = {
  id: string;
  username: string;
  email: string | null;
  fullName: string | null;
  title: string | null;
  branchId: string | null;
  lastLoginAt: Date | null;
  branch: {
    id: string;
    code: string;
    name: string;
    nameAr: string | null;
  } | null;
  roles: {
    role: { name: string; nameAr: string | null };
  }[];
};

export type SessionContext = {
  user: SessionUser;
  permissions: PermissionKey[];
};
