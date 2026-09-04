"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { PlatformUserRow } from "@/features/company-admin/types";
import { formatDateTime } from "@/lib/utils";

function statusBadgeVariant(status: PlatformUserRow["status"]):
  | "success"
  | "secondary"
  | "warning" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "warning";
    default:
      return "secondary";
  }
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "SUSPENDED";

const STATUS_FILTERS: StatusFilter[] = ["ALL", "ACTIVE", "INACTIVE", "SUSPENDED"];

export function PlatformUsersTable({
  users,
  currentUserId,
}: {
  users: PlatformUserRow[];
  currentUserId?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const [editingUser, setEditingUser] = React.useState<PlatformUserRow | null>(null);
  const [passwordUser, setPasswordUser] = React.useState<PlatformUserRow | null>(null);
  const [revoking, setRevoking] = React.useState<PlatformUserRow | null>(null);
  const [deletingUser, setDeletingUser] = React.useState<PlatformUserRow | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [identity, setIdentity] = React.useState({
    fullName: "",
    username: "",
    email: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "SUSPENDED",
  });
  const [newPassword, setNewPassword] = React.useState("");
  const [identityBusy, setIdentityBusy] = React.useState(false);
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [revokeBusy, setRevokeBusy] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = users;
    if (statusFilter !== "ALL") {
      rows = rows.filter((u) => u.status === statusFilter);
    }
    if (!q) return rows;
    return rows.filter((u) =>
      [u.username, u.fullName, u.email].some(
        (value) => value?.toLowerCase().includes(q),
      ),
    );
  }, [users, query, statusFilter]);

  const openEdit = (user: PlatformUserRow) => {
    setIdentity({
      fullName: user.fullName ?? "",
      username: user.username,
      email: user.email ?? "",
      status: user.status,
    });
    setEditingUser(user);
  };

  const saveIdentity = async () => {
    if (!editingUser) return;
    setIdentityBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(identity),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      toast.success(t("admin.memberUpdateSuccess"));
      setEditingUser(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setIdentityBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!passwordUser) return;
    setPasswordBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${passwordUser.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      toast.success(t("admin.memberPasswordResetSuccess"));
      setPasswordUser(null);
      setNewPassword("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setPasswordBusy(false);
    }
  };

  const revokeSessions = async () => {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${revoking.id}/sessions`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      toast.success(t("admin.sessionsRevoked"));
      setRevoking(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setRevokeBusy(false);
    }
  };

  const deleteUser = async () => {
    if (!deletingUser) return;
    if (deleteConfirmName.trim() !== deletingUser.username) {
      toast.error(t("admin.userDeleteMismatch"));
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deletingUser.username }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      toast.success(t("admin.userDeleteSuccess"));
      setDeletingUser(null);
      setDeleteConfirmName("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <span
            className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground"
            aria-hidden="true"
          >
            search
          </span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.usersSearchPlaceholder")}
            className="ps-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/users/sessions">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                devices
              </span>
              {t("admin.nav.sessions")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex w-full flex-wrap items-center gap-1 rounded-md border p-1 sm:w-fit">
        {STATUS_FILTERS.map((filter) => {
          const label =
            filter === "ALL"
              ? t("admin.filterAllUsers")
              : filter === "ACTIVE"
                ? t("admin.userStatusActive")
                : filter === "INACTIVE"
                  ? t("admin.userStatusInactive")
                  : t("admin.userStatusSuspended");
          return (
            <Button
              key={filter}
              size="sm"
              variant={statusFilter === filter ? "default" : "ghost"}
              onClick={() => setStatusFilter(filter)}
            >
              {label}
            </Button>
          );
        })}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("profile.username")}</TableHead>
              <TableHead>{t("profile.fullName")}</TableHead>
              <TableHead>{t("admin.colStatus")}</TableHead>
              <TableHead>{t("admin.lastLogin")}</TableHead>
              <TableHead>{t("admin.colCompanies")}</TableHead>
              <TableHead>{t("admin.colCreated")}</TableHead>
              <TableHead className="text-end">{t("admin.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length ? (
              filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">
                        {user.username}
                      </span>
                      {user.isSuperAdmin ? (
                        <Badge variant="outline" className="px-2 py-0 font-semibold">
                          {t("admin.superAdminBadge")}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{user.fullName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(user.status)}>
                      {t(`admin.userStatus${user.status}` as "admin.userStatusACTIVE")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : t("admin.never")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {user.memberships.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        user.memberships.slice(0, 2).map((m) => (
                          <Badge key={m.userCompanyId} variant="secondary">
                            {m.companyName}
                          </Badge>
                        ))
                      )}
                      {user.memberships.length > 2 ? (
                        <span className="text-xs text-muted-foreground">
                          +{user.memberships.length - 2}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {user.isSuperAdmin ? (
                        <span className="text-xs text-muted-foreground">
                          {t("admin.usersProtected")}
                        </span>
                      ) : user.id === currentUserId ? (
                        <span className="text-xs text-muted-foreground">
                          {t("admin.userDeleteSelfNote")}
                        </span>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                            {t("admin.edit")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setPasswordUser(user)}>
                            {t("admin.resetMemberPassword")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setRevoking(user)}>
                            {t("admin.revokeSessions")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                              setDeleteConfirmName("");
                              setDeletingUser(user);
                            }}
                          >
                            {t("admin.userDelete")}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24">
                  <EmptyState
                    icon="group"
                    title={t("admin.usersEmpty")}
                    description={t("admin.usersSubtitle")}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="py-4 text-sm text-muted-foreground">
        {filtered.length} / {users.length} {t("admin.usersUnit")}
      </div>

      <Dialog open={editingUser !== null} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.userEdit")}</DialogTitle>
            <DialogDescription>{t("admin.userEditDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform-user-fullName">{t("profile.fullName")}</Label>
              <Input
                id="platform-user-fullName"
                value={identity.fullName}
                onChange={(e) => setIdentity((s) => ({ ...s, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-user-username" required>
                {t("auth.username")}
              </Label>
              <Input
                id="platform-user-username"
                value={identity.username}
                onChange={(e) => setIdentity((s) => ({ ...s, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-user-email">{t("profile.email")}</Label>
              <Input
                id="platform-user-email"
                type="email"
                value={identity.email}
                onChange={(e) => setIdentity((s) => ({ ...s, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.userStatus")}</Label>
              <Select
                value={identity.status}
                onValueChange={(value) =>
                  setIdentity((s) => ({
                    ...s,
                    status: value as "ACTIVE" | "INACTIVE" | "SUSPENDED",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{t("admin.userStatusActive")}</SelectItem>
                  <SelectItem value="INACTIVE">{t("admin.userStatusInactive")}</SelectItem>
                  <SelectItem value="SUSPENDED">{t("admin.userStatusSuspended")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={identityBusy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveIdentity()} disabled={identityBusy}>
              {identityBusy ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordUser !== null} onOpenChange={(open) => { if (!open) setPasswordUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.resetMemberPassword")}</DialogTitle>
            <DialogDescription>{t("admin.memberPasswordResetInfo")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="platform-user-newPassword" required>
              {t("admin.userPasswordNewLabel")}
            </Label>
            <Input
              id="platform-user-newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUser(null)} disabled={passwordBusy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void resetPassword()} disabled={passwordBusy || newPassword.length < 8}>
              {passwordBusy ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revoking !== null} onOpenChange={(open) => { if (!open) setRevoking(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.revokeSessions")}</DialogTitle>
            <DialogDescription>{t("admin.revokeSessionsConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)} disabled={revokeBusy}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void revokeSessions()} disabled={revokeBusy}>
              {revokeBusy ? t("common.saving") : t("admin.revokeSessions")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingUser !== null} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t("admin.userDelete")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.userDeleteDescription", { username: deletingUser?.username ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="platform-user-delete-confirm" required>
              {t("admin.userDeleteLabel", { username: deletingUser?.username ?? "" })}
            </Label>
            <Input
              id="platform-user-delete-confirm"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)} disabled={deleteBusy}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void deleteUser()} disabled={deleteBusy || deleteConfirmName.trim() !== deletingUser?.username}>
              {deleteBusy ? t("common.saving") : t("admin.userDeleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
