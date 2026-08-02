"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { CurrencyItem } from "@/features/settings/config";
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

export function CurrenciesForm({
  rows,
  description,
}: {
  rows: CurrencyItem[];
  description: string;
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<CurrencyItem[]>(rows);
  const [busy, setBusy] = React.useState(false);

  const update = (index: number, patch: Partial<CurrencyItem>) =>
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { code: "", name: "", symbol: "", rate: 1, isActive: true },
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
          settings: [{ key: "currency.list", value: items, type: "JSON" }],
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
        <CardTitle>{t("parametres.currencies")}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-20">{t("parametres.currencyCode")}</TableHead>
              <TableHead>{t("parametres.currencyName")}</TableHead>
              <TableHead className="w-20">{t("parametres.currencySymbol")}</TableHead>
              <TableHead className="w-28">{t("parametres.currencyRate")}</TableHead>
              <TableHead className="w-20">{t("parametres.rateDefault")}</TableHead>
              <TableHead className="w-20">{t("common.active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row, index) => (
              <TableRow key={row.code || index}>
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
                    value={row.code}
                    onChange={(e) =>
                      update(index, { code: e.target.value.toUpperCase() })
                    }
                    placeholder={t("parametres.currencyCode")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    placeholder={t("parametres.currencyName")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.symbol}
                    onChange={(e) => update(index, { symbol: e.target.value })}
                    placeholder={t("parametres.currencySymbol")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
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
                      update(index, { isDefault: v === true })
                    }
                    aria-label={t("parametres.rateDefault")}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={row.isActive ?? true}
                    onCheckedChange={(v) =>
                      update(index, { isActive: v === true })
                    }
                    aria-label={t("common.active")}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button variant="outline" size="sm" onClick={addRow} disabled={busy} className="mt-3">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          {t("parametres.addCurrency")}
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
