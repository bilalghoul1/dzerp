"use client";

import * as React from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { PlatformAuditEntry } from "@/features/company-admin/types";
import { formatDateTime } from "@/lib/utils";

const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "VIEW",
  "EXPORT",
  "IMPORT",
  "LOGIN",
  "LOGOUT",
  "ASSIGN",
  "REVOKE",
  "SETTING_CHANGE",
  "UPLOAD",
  "FALLBACK",
] as const;

function actionVariant(action: string): "success" | "warning" | "destructive" | "secondary" {
  switch (action) {
    case "CREATE":
      return "success";
    case "DELETE":
    case "REVOKE":
      return "destructive";
    case "UPDATE":
    case "ASSIGN":
    case "SETTING_CHANGE":
      return "warning";
    default:
      return "secondary";
  }
}

function describeChanges(changes: unknown): string {
  if (changes === null || changes === undefined) return "";
  if (typeof changes === "string") return changes;
  try {
    return JSON.stringify(changes);
  } catch {
    return String(changes);
  }
}

export function AuditLogTable({ entries }: { entries: PlatformAuditEntry[] }) {
  const { t } = useI18n();
  const [query, setQuery] = React.useState("");
  const [action, setAction] = React.useState("ALL");
  const [entity, setEntity] = React.useState("ALL");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const entities = React.useMemo(() => {
    const set = new Set(entries.map((e) => e.entity));
    return [...set].sort();
  }, [entries]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null;

    return entries.filter((entry) => {
      if (action !== "ALL" && entry.action !== action) return false;
      if (entity !== "ALL" && entry.entity !== entity) return false;
      const ts = new Date(entry.createdAt).getTime();
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      if (!q) return true;
      return [entry.entity, entry.entityId, entry.actorName, entry.actorUsername, entry.companyName]
        .some((value) => value?.toLowerCase().includes(q));
    });
  }, [entries, query, action, entity, from, to]);

  return (
    <div>
      <div className="mb-4 grid gap-3 lg:grid-cols-4">
        <div className="relative">
          <span
            className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground"
            aria-hidden="true"
          >
            search
          </span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.auditSearchPlaceholder")}
            className="ps-9"
          />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("admin.auditActionAll")}</SelectItem>
            {AUDIT_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("admin.auditEntityAll")}</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label={t("admin.auditFrom")}
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label={t("admin.auditTo")}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.colCreated")}</TableHead>
              <TableHead>{t("admin.colType")}</TableHead>
              <TableHead>{t("admin.colEntity")}</TableHead>
              <TableHead>{t("admin.colUser")}</TableHead>
              <TableHead>{t("admin.colCompany")}</TableHead>
              <TableHead>{t("admin.colChanges")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length ? (
              filtered.map((entry) => {
                const changes = describeChanges(entry.changes);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(entry.action)}>{entry.action}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{entry.entity}</span>
                        {entry.entityId ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {entry.entityId}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.actorName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.companyName ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      {changes ? (
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {changes}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24">
                  <EmptyState
                    icon="history"
                    title={t("admin.noAudit")}
                    description={t("admin.auditNoResults")}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="py-4 text-sm text-muted-foreground">
        {filtered.length} / {entries.length} {t("admin.auditUnit")}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setQuery("");
          setAction("ALL");
          setEntity("ALL");
          setFrom("");
          setTo("");
        }}
      >
        {t("admin.auditReset")}
      </Button>
    </div>
  );
}
