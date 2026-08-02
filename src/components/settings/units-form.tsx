"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { UnitItem } from "@/features/settings/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

export function UnitsForm({
  rows,
  description,
}: {
  rows: UnitItem[];
  description: string;
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<UnitItem[]>(rows);
  const [busy, setBusy] = React.useState(false);

  const update = (index: number, patch: Partial<UnitItem>) =>
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const addRow = () => {
    setItems((prev) => [...prev, { key: "", label: "" }]);
  };

  const removeRow = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [{ key: "units.list", value: items, type: "JSON" }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      toast.success(t("parametres.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("parametres.units")}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-40">{t("parametres.unitKey")}</TableHead>
              <TableHead>{t("parametres.unitLabel")}</TableHead>
              <TableHead className="w-40">Label (AR)</TableHead>
              <TableHead className="w-10 text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row, index) => (
              <TableRow key={`${row.key}-${index}`}>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => removeRow(index)}
                    aria-label={t("common.delete")}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      delete
                    </span>
                  </Button>
                </TableCell>
                <TableCell>
                  <Input
                    value={row.key}
                    onChange={(e) => update(index, { key: e.target.value })}
                    placeholder={t("parametres.unitKey")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.label}
                    onChange={(e) => update(index, { label: e.target.value })}
                    placeholder={t("parametres.unitLabel")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    dir="rtl"
                    value={row.labelAr ?? ""}
                    onChange={(e) => update(index, { labelAr: e.target.value })}
                  />
                </TableCell>
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button variant="outline" size="sm" onClick={addRow} disabled={busy} className="mt-3">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          {t("parametres.addUnit")}
        </Button>
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
