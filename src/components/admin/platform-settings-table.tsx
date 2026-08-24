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
import type { PlatformSettingRow } from "@/features/company-admin/types";

function formatValue(
  value: unknown,
  type: PlatformSettingRow["type"],
  t: (key: string) => string,
): string {
  if (type === "SECRET") return "••••••••••••";
  if (type === "BOOLEAN") {
    return value === true
      ? t("admin.settingsTrue")
      : value === false
        ? t("admin.settingsFalse")
        : String(value);
  }
  if (type === "JSON") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function typeBadge(type: PlatformSettingRow["type"]): string {
  switch (type) {
    case "BOOLEAN":
      return "bg-blue-500/10 text-blue-600";
    case "NUMBER":
      return "bg-emerald-500/10 text-emerald-600";
    case "JSON":
      return "bg-amber-500/10 text-amber-600";
    case "SECRET":
      return "bg-purple-500/10 text-purple-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function editableType(type: PlatformSettingRow["type"]): boolean {
  return type === "STRING" || type === "NUMBER" || type === "BOOLEAN";
}

export function PlatformSettingsTable({
  settings,
}: {
  settings: PlatformSettingRow[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<PlatformSettingRow | null>(null);
  const [rawValue, setRawValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return settings;
    return settings.filter((s) =>
      [s.key, s.description].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [settings, query]);

  const openEdit = (setting: PlatformSettingRow) => {
    setRawValue(String(setting.value));
    setEditing(setting);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      let value: string | number | boolean = rawValue;
      if (editing.type === "NUMBER") {
        const n = Number(rawValue);
        if (Number.isNaN(n)) throw new Error(t("admin.settingsInvalidNumber"));
        value = n;
      } else if (editing.type === "BOOLEAN") {
        value = rawValue === "true";
      }
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: [{ key: editing.key, value }] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      toast.success(t("admin.settingsSaveSuccess"));
      setEditing(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="relative mb-4 w-full sm:max-w-xs">
        <span
          className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground"
          aria-hidden="true"
        >
          search
        </span>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.settingsSearchPlaceholder")}
          className="ps-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="settings"
          title={t("admin.settingsEmpty")}
          description={t("admin.settingsEmptyDesc")}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.settingsColKey")}</TableHead>
                <TableHead>{t("admin.settingsColValue")}</TableHead>
                <TableHead>{t("admin.settingsColType")}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("admin.settingsColUpdated")}
                </TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((setting) => (
                <TableRow key={setting.key}>
                  <TableCell className="font-mono text-xs">
                    {setting.key}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="block truncate font-mono text-xs">
                      {formatValue(setting.value, setting.type, t)}
                    </span>
                    {setting.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {setting.description}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={typeBadge(setting.type)}>
                      {setting.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {new Date(setting.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!editableType(setting.type)}
                      onClick={() => openEdit(setting)}
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        edit
                      </span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.settingsEditTitle")}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {editing?.key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("admin.settingsColValue")}</Label>
              {editing?.type === "BOOLEAN" ? (
                <Select value={rawValue} onValueChange={setRawValue}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">
                      {t("admin.settingsTrue")}
                    </SelectItem>
                    <SelectItem value="false">
                      {t("admin.settingsFalse")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={editing?.type === "NUMBER" ? "number" : "text"}
                  value={rawValue}
                  onChange={(e) => setRawValue(e.target.value)}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
