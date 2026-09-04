"use client";

import * as React from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { PlatformSessionRow } from "@/features/company-admin/types";
import { formatDateTime } from "@/lib/utils";

type ActiveFilter = "ALL" | "ACTIVE" | "REVOKED";

const ACTIVE_FILTERS: ActiveFilter[] = ["ALL", "ACTIVE", "REVOKED"];

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "—";
  const ua = userAgent;
  if (/mobile|android/i.test(ua)) {
    return /android/i.test(ua) ? "Android" : "Mobile";
  }
  if (/iphone|ipad/i.test(ua)) return "iOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/macintosh|mac os/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return ua.length > 60 ? `${ua.slice(0, 60)}…` : ua;
}

export function PlatformSessionsTable({
  sessions,
}: {
  sessions: PlatformSessionRow[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<ActiveFilter>("ACTIVE");
  const [revoking, setRevoking] = React.useState<PlatformSessionRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = sessions;
    if (activeFilter === "ACTIVE") {
      rows = rows.filter((s) => s.revokedAt === null);
    } else if (activeFilter === "REVOKED") {
      rows = rows.filter((s) => s.revokedAt !== null);
    }
    if (!q) return rows;
    return rows.filter((s) =>
      [s.username, s.fullName].some((value) => value?.toLowerCase().includes(q)),
    );
  }, [sessions, query, activeFilter]);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sessions/${revoking.id}`, {
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
      setBusy(false);
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
            placeholder={t("admin.sessionsSearchPlaceholder")}
            className="ps-9"
          />
        </div>
      </div>

      <div className="mb-4 flex w-full flex-wrap items-center gap-1 rounded-md border p-1 sm:w-fit">
        {ACTIVE_FILTERS.map((filter) => {
          const label =
            filter === "ALL"
              ? t("admin.sessionsFilterAll")
              : filter === "ACTIVE"
                ? t("admin.sessionsFilterActive")
                : t("admin.sessionsFilterRevoked");
          return (
            <Button
              key={filter}
              size="sm"
              variant={activeFilter === filter ? "default" : "ghost"}
              onClick={() => setActiveFilter(filter)}
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
              <TableHead>{t("admin.colUser")}</TableHead>
              <TableHead>{t("admin.colIp")}</TableHead>
              <TableHead>{t("admin.colDevice")}</TableHead>
              <TableHead>{t("admin.colCompany")}</TableHead>
              <TableHead>{t("admin.colCreated")}</TableHead>
              <TableHead>{t("admin.colExpires")}</TableHead>
              <TableHead>{t("admin.colStatus")}</TableHead>
              <TableHead className="text-end">{t("admin.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length ? (
              filtered.map((session) => {
                const active = session.revokedAt === null;
                return (
                  <TableRow key={session.id}>
                    <TableCell>
                      <span className="font-medium">{session.username}</span>
                      {session.fullName ? (
                        <span className="block text-xs text-muted-foreground">
                          {session.fullName}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {session.ip ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {describeDevice(session.userAgent)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.activeCompanyName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(session.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(session.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={active ? "success" : "secondary"}>
                        {active ? t("admin.sessionActive") : t("admin.sessionRevoked")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        {active ? (
                          <Button variant="ghost" size="sm" onClick={() => setRevoking(session)}>
                            {t("admin.revokeSessions")}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24">
                  <EmptyState
                    icon="devices"
                    title={t("admin.sessionsEmpty")}
                    description={t("admin.sessionsSubtitle")}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="py-4 text-sm text-muted-foreground">
        {filtered.length} / {sessions.length} {t("admin.sessionsUnit")}
      </div>

      <Dialog open={revoking !== null} onOpenChange={(open) => { if (!open) setRevoking(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.revokeSessions")}</DialogTitle>
            <DialogDescription>{t("admin.revokeSessionsConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void revoke()} disabled={busy}>
              {busy ? t("common.saving") : t("admin.revokeSessions")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
