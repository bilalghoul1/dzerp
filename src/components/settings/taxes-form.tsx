"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { TaxRate } from "@/features/settings/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

export function TaxesForm({
  rows,
  description,
}: {
  rows: TaxRate[];
  description: string;
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<TaxRate[]>(rows);
  const [busy, setBusy] = React.useState(false);

  const update = (index: number, patch: Partial<TaxRate>) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { key: `taux_${Date.now()}`, label: "", rate: 0 },
    ]);
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
          settings: [{ key: "tax.rates", value: items, type: "JSON" }],
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
        <CardTitle>{t("parametres.taxes")}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>{t("parametres.rateLabel")}</TableHead>
              <TableHead className="w-28">{t("parametres.rateValue")}</TableHead>
              <TableHead className="w-24">{t("parametres.rateDefault")}</TableHead>
              <TableHead className="w-24">{t("parametres.rateExempt")}</TableHead>
              <TableHead className="w-10 text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row, index) => (
              <TableRow key={row.key}>
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
                    value={row.label}
                    onChange={(e) => update(index, { label: e.target.value })}
                    placeholder={t("parametres.rateLabel")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={row.rate}
                    onChange={(e) =>
                      update(index, { rate: Number(e.target.value) || 0 })
                    }
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={row.isDefault ?? false}
                    onCheckedChange={(v) =>
                      update(index, { isDefault: v === true, exempt: v === true ? false : row.exempt })
                    }
                    aria-label={t("parametres.rateDefault")}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={row.exempt ?? false}
                    onCheckedChange={(v) =>
                      update(index, { exempt: v === true, isDefault: v === true ? false : row.isDefault })
                    }
                    aria-label={t("parametres.rateExempt")}
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
          {t("parametres.addTax")}
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
