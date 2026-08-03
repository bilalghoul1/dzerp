"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type {
  InventoryManagerOptions,
  InventoryMovementRow,
  StockOnHandRow,
} from "@/features/inventory/config";

type MovementKind = "movement" | "adjustment" | "transfer";

type FormState = {
  kind: MovementKind;
  type: "PURCHASE" | "OPENING_BALANCE";
  direction: "in" | "out";
  productId: string;
  warehouseId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: string;
  unitCost: string;
  referenceNumber: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  kind: "movement",
  type: "PURCHASE",
  direction: "in",
  productId: "",
  warehouseId: "",
  fromWarehouseId: "",
  toWarehouseId: "",
  quantity: "",
  unitCost: "",
  referenceNumber: "",
  notes: "",
};

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

export function InventoryManager({
  description,
  movements,
  stock,
  options,
  canCreate,
  canAdjust,
  canTransfer,
}: {
  description: string;
  movements: InventoryMovementRow[];
  stock: StockOnHandRow[];
  options: InventoryManagerOptions;
  canCreate: boolean;
  canAdjust: boolean;
  canTransfer: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);

  const typeLabel = (type: string) => {
    const key = `movementTypes.${type}`;
    const label = t(key);
    return label.startsWith("movementTypes.") ? type : label;
  };

  const errorMessage = (json: unknown): string => {
    const code =
      json && typeof json === "object" && "error" in json
        ? (json as { error?: { code?: string } }).error?.code
        : undefined;
    if (code) {
      const translated = t(`errors.${code}`);
      if (!translated.startsWith("errors.")) return translated;
    }
    return t("common.error");
  };

  const save = async () => {
    setBusy(true);
    try {
      let url = "/api/inventory";
      const payload: Record<string, unknown> = {
        productId: form.productId,
        quantity: form.quantity,
        occurredAt: undefined,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
      };

      if (form.kind === "transfer") {
        url = "/api/inventory?action=transfer";
        payload.fromWarehouseId = form.fromWarehouseId;
        payload.toWarehouseId = form.toWarehouseId;
      } else if (form.kind === "adjustment") {
        payload.type = "ADJUSTMENT";
        payload.direction = form.direction;
        payload.warehouseId = form.warehouseId;
        payload.unitCost = form.unitCost;
      } else {
        payload.type = form.type;
        payload.warehouseId = form.warehouseId;
        payload.unitCost = form.unitCost;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(errorMessage(json));
      }
      toast.success(t("parametres.saveSuccess"));
      setOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const openForm = (kind: MovementKind) => {
    setForm({ ...EMPTY_FORM, kind });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>{t("inventory.title")}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("inventory.number")}</TableHead>
                  <TableHead>{t("inventory.date")}</TableHead>
                  <TableHead>{t("inventory.type")}</TableHead>
                  <TableHead>{t("inventory.product")}</TableHead>
                  <TableHead>{t("inventory.warehouse")}</TableHead>
                  <TableHead className="text-end">{t("inventory.quantity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {t("inventory.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(m.occurredAt.toISOString())}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.quantity >= 0 ? "success" : "destructive"}>
                          {typeLabel(m.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p>{m.productName}</p>
                        <p className="text-xs text-muted-foreground">{m.productCode}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.warehouseName}
                      </TableCell>
                      <TableCell
                        className={`text-end font-semibold ${
                          m.quantity < 0 ? "text-destructive" : "text-emerald-600"
                        }`}
                      >
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>{t("inventory.add")}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {canCreate ? (
                <Button onClick={() => openForm("movement")} disabled={busy}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    move_up
                  </span>
                  {t("inventory.sectionMovement")}
                </Button>
              ) : null}
              {canAdjust ? (
                <Button variant="outline" onClick={() => openForm("adjustment")} disabled={busy}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    balance
                  </span>
                  {t("inventory.adjustment")}
                </Button>
              ) : null}
              {canTransfer ? (
                <Button variant="outline" onClick={() => openForm("transfer")} disabled={busy}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    swap_horiz
                  </span>
                  {t("inventory.transfer")}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("stock.stockOnHand")}</CardTitle>
              <CardDescription>{t("stock.stockOnHandHint")}</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[420px] space-y-1 overflow-y-auto">
              {stock.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("inventory.empty")}
                </p>
              ) : (
                stock.map((s) => (
                  <div
                    key={`${s.productId}-${s.warehouseId}`}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.productName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.warehouseName}
                      </p>
                    </div>
                    <Badge variant={s.quantity > 0 ? "success" : "destructive"}>
                      {s.quantity}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {form.kind === "adjustment"
                ? t("inventory.adjustment")
                : form.kind === "transfer"
                  ? t("inventory.transfer")
                  : t("inventory.sectionMovement")}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mv-product">{t("inventory.product")} *</Label>
                <Select
                  value={form.productId}
                  onValueChange={(v) => setField("productId", v)}
                >
                  <SelectTrigger id="mv-product">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.kind === "transfer" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="mv-from">{t("inventory.sectionSource")} *</Label>
                    <Select
                      value={form.fromWarehouseId}
                      onValueChange={(v) => setField("fromWarehouseId", v)}
                    >
                      <SelectTrigger id="mv-from">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {options.warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mv-to">{t("inventory.sectionTarget")} *</Label>
                    <Select
                      value={form.toWarehouseId}
                      onValueChange={(v) => setField("toWarehouseId", v)}
                    >
                      <SelectTrigger id="mv-to">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {options.warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="mv-warehouse">{t("inventory.warehouse")} *</Label>
                  <Select
                    value={form.warehouseId}
                    onValueChange={(v) => setField("warehouseId", v)}
                  >
                    <SelectTrigger id="mv-warehouse">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.kind !== "transfer" ? (
                <div className="space-y-2">
                  <Label htmlFor="mv-type">{t("inventory.type")}</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setField(
                        "type",
                        v as "PURCHASE" | "OPENING_BALANCE",
                      )
                    }
                  >
                    <SelectTrigger id="mv-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PURCHASE">
                        {typeLabel("PURCHASE")}
                      </SelectItem>
                      <SelectItem value="OPENING_BALANCE">
                        {typeLabel("OPENING_BALANCE")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {form.kind === "adjustment" ? (
                <div className="space-y-2">
                  <Label htmlFor="mv-direction">{t("stock.direction")}</Label>
                  <Select
                    value={form.direction}
                    onValueChange={(v) => setField("direction", v as "in" | "out")}
                  >
                    <SelectTrigger id="mv-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">{t("stock.in")}</SelectItem>
                      <SelectItem value="out">{t("stock.out")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="mv-qty">{t("inventory.quantity")} *</Label>
                <Input
                  id="mv-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setField("quantity", e.target.value)}
                />
              </div>

              {form.kind !== "transfer" ? (
                <div className="space-y-2">
                  <Label htmlFor="mv-cost">{t("inventory.unitCost")}</Label>
                  <Input
                    id="mv-cost"
                    type="number"
                    min="0"
                    step="any"
                    value={form.unitCost}
                    onChange={(e) => setField("unitCost", e.target.value)}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="mv-ref">{t("inventory.reference")}</Label>
                <Input
                  id="mv-ref"
                  value={form.referenceNumber}
                  onChange={(e) => setField("referenceNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mv-notes">{t("inventory.notes")}</Label>
                <Textarea
                  id="mv-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
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
