"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useSettingsReadOnly } from "@/components/settings/settings-readonly-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type SeriesRow = {
  id: string;
  key: string;
  docType: string;
  label: string;
  labelAr: string | null;
  prefix: string;
  separator: string;
  suffix: string;
  withYear: boolean;
  year: number | null;
  nextValue: number;
  padLength: number;
  step: number;
  isActive: boolean;
  /** Numéro suivant calculé côté serveur (indicatif, jamais réservé). */
  next: string;
};

export function SeriesManager({
  series,
  description,
}: {
  series: SeriesRow[];
  description: string;
}) {
  const { t } = useI18n();
  const readOnly = useSettingsReadOnly();
  const [rows, setRows] = React.useState<SeriesRow[]>(series);
  const [busy, setBusy] = React.useState<Record<string, boolean>>({});

  const refresh = async () => {
    const res = await fetch("/api/series");
    const json = (await res.json().catch(() => null)) as
      | { data?: SeriesRow[] }
      | null;
    if (res.ok && json?.data) {
      setRows(json.data);
    }
  };

  const update = (id: string, patch: Partial<SeriesRow>) =>
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );

  const save = async (row: SeriesRow) => {
    setBusy((prev) => ({ ...prev, [row.id]: true }));
    try {
      const res = await fetch("/api/series", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          prefix: row.prefix,
          separator: row.separator,
          suffix: row.suffix,
          withYear: row.withYear,
          year: row.withYear ? row.year : null,
          padLength: row.padLength,
          nextValue: row.nextValue,
          isActive: row.isActive,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      await refresh();
      toast.success(t("parametres.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy((prev) => ({ ...prev, [row.id]: false }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("parametres.numbering")}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("parametres.seriesDoc")}</TableHead>
                <TableHead className="w-24">{t("parametres.seriesPrefix")}</TableHead>
                <TableHead className="w-16">{t("parametres.seriesSeparator")}</TableHead>
                <TableHead className="w-24">{t("parametres.seriesSuffix")}</TableHead>
                <TableHead className="w-16">{t("parametres.seriesYear")}</TableHead>
                <TableHead className="w-20">{t("parametres.seriesPad")}</TableHead>
                <TableHead className="w-24">{t("parametres.seriesNext")}</TableHead>
                <TableHead className="w-20">{t("parametres.seriesActive")}</TableHead>
                <TableHead>{t("parametres.seriesPreview")}</TableHead>
                <TableHead className="w-10 text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium">{t(`docTypes.${row.docType}` as "docTypes.QUOTATION")}</p>
                    <p className="text-xs text-muted-foreground">{row.key}</p>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.prefix}
                      disabled={readOnly}
                      onChange={(e) => update(row.id, { prefix: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.separator}
                      disabled={readOnly}
                      onChange={(e) => update(row.id, { separator: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.suffix}
                      disabled={readOnly}
                      onChange={(e) => update(row.id, { suffix: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.withYear}
                      disabled={readOnly}
                      onCheckedChange={(v) => update(row.id, { withYear: v })}
                      aria-label={t("parametres.seriesYear")}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      disabled={readOnly}
                      value={row.padLength}
                      onChange={(e) =>
                        update(row.id, {
                          padLength: Math.min(
                            12,
                            Math.max(1, Number(e.target.value) || 1),
                          ),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      disabled={readOnly}
                      value={row.nextValue}
                      onChange={(e) =>
                        update(row.id, {
                          nextValue: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.isActive}
                      disabled={readOnly}
                      onCheckedChange={(v) => update(row.id, { isActive: v })}
                      aria-label={t("parametres.seriesActive")}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {row.next}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {t("parametres.seriesIndicative")}
                    </p>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy[row.id] || readOnly}
                      onClick={() => save(row)}
                    >
                      {busy[row.id] ? t("common.saving") : t("common.save")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
