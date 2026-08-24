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
import type { ProductionOrderRow } from "@/features/production/config";

type Option = { id: string; code: string; name: string };
type Options = { products: Option[]; warehouses: Option[]; boms: Option[]; workCenters: Option[]; branches: Option[] };

type FormState = {
  productId: string;
  bomId: string;
  plannedQty: string;
  warehouseId: string;
  workCenterId: string;
  notes: string;
};

const EMPTY: FormState = {
  productId: "",
  bomId: "",
  plannedQty: "",
  warehouseId: "",
  workCenterId: "",
  notes: "",
};

const statusVariant = (s: string): "default" | "secondary" | "success" | "destructive" | "warning" => {
  switch (s) {
    case "COMPLETED": return "success";
    case "IN_PROGRESS": return "warning";
    case "CANCELLED": return "destructive";
    case "PLANNED": return "default";
    default: return "secondary";
  }
};

export function ProductionOrdersManager({
  title,
  description,
  rows,
  options,
}: {
  title: string;
  description: string;
  rows: ProductionOrderRow[];
  options: Options;
}) {
  const { t } = useI18n();
  const [items] = React.useState<ProductionOrderRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState<{ id: string; action: "plan" | "start" | "complete" | "cancel"; label: string } | null>(null);
  const [consumeId, setConsumeId] = React.useState<string | null>(null);
  const [consumeLines, setConsumeLines] = React.useState<{ productId: string; warehouseId: string; quantity: string }[]>([]);

  const openCreate = () => {
    setForm(EMPTY);
    setDialogOpen(true);
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
    return t("production.saveError");
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        productId: form.productId,
        bomId: form.bomId || null,
        plannedQty: Number(form.plannedQty),
        warehouseId: form.warehouseId,
        workCenterId: form.workCenterId || null,
        notes: form.notes,
      };
      const res = await fetch(`/api/production/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json));
      toast.success(t("production.saveSuccess"));
      setDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("production.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const action = async (id: string, action: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/production/orders/${id}/${action}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json));
      toast.success(t("production.saveSuccess"));
      setConfirm(null);
      setConsumeId(null);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("production.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const doConsume = async () => {
    setBusy(true);
    try {
      const lines = consumeLines
        .filter((l) => l.productId && l.warehouseId && Number(l.quantity) > 0)
        .map((l) => ({ productId: l.productId, warehouseId: l.warehouseId, quantity: Number(l.quantity) }));
      if (!lines.length) throw new Error(t("production.emptyBom"));
      const res = await fetch(`/api/production/orders/${consumeId}/consume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json));
      toast.success(t("production.saveSuccess"));
      setConsumeId(null);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("production.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const statusLabel = (s: string) =>
    t(`production.status${s}`);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button onClick={openCreate} disabled={busy}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          {t("production.addOrder")}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("production.orderNumber")}</TableHead>
              <TableHead>{t("production.orderProduct")}</TableHead>
              <TableHead>{t("production.orderBom")}</TableHead>
              <TableHead>{t("production.orderPlannedQty")}</TableHead>
              <TableHead>{t("production.orderWarehouse")}</TableHead>
              <TableHead>{t("production.orderStatus")}</TableHead>
              <TableHead className="text-end">{t("production.orderActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {t("production.emptyOrders")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.number}</TableCell>
                  <TableCell>{row.productCode} — {row.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.bomCode ?? "—"}</TableCell>
                  <TableCell>{row.plannedQty}</TableCell>
                  <TableCell className="text-muted-foreground">{row.warehouseName}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {(row.status === "DRAFT" || row.status === "PLANNED") && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirm({ id: row.id, action: "plan", label: t("production.confirmStart") })} disabled={busy}>
                          {t("production.plan")}
                        </Button>
                      )}
                      {row.status !== "COMPLETED" && row.status !== "CANCELLED" && row.status !== "IN_PROGRESS" && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirm({ id: row.id, action: "start", label: t("production.confirmStart") })} disabled={busy}>
                          {t("production.start")}
                        </Button>
                      )}
                      {row.status === "IN_PROGRESS" && (
                        <Button variant="ghost" size="sm" onClick={() => setConsumeId(row.id)} disabled={busy}>
                          {t("production.consume")}
                        </Button>
                      )}
                      {row.status === "IN_PROGRESS" && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirm({ id: row.id, action: "complete", label: t("production.confirmComplete") })} disabled={busy}>
                          {t("production.complete")}
                        </Button>
                      )}
                      {row.status !== "COMPLETED" && row.status !== "CANCELLED" && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirm({ id: row.id, action: "cancel", label: t("production.confirmCancel") })} disabled={busy}>
                          {t("production.cancel")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("production.addOrder")}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="po-product">{t("production.selectProduct")} *</Label>
                <Select value={form.productId} onValueChange={(v) => setField("productId", v)}>
                  <SelectTrigger id="po-product"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-bom">{t("production.selectBom")}</Label>
                <Select value={form.bomId} onValueChange={(v) => setField("bomId", v)}>
                  <SelectTrigger id="po-bom"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.boms.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.code} — {b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-qty">{t("production.selectQuantity")} *</Label>
                <Input id="po-qty" type="number" value={form.plannedQty} onChange={(e) => setField("plannedQty", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-wh">{t("production.selectWarehouse")} *</Label>
                <Select value={form.warehouseId} onValueChange={(v) => setField("warehouseId", v)}>
                  <SelectTrigger id="po-wh"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-wc">{t("production.selectWorkCenter")}</Label>
                <Select value={form.workCenterId} onValueChange={(v) => setField("workCenterId", v)}>
                  <SelectTrigger id="po-wc"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.workCenters.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="po-notes">{t("production.bomStatus")}</Label>
                <Textarea id="po-notes" rows={2} value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for plan/start/complete/cancel */}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("common.confirm")}</DialogTitle>
            <DialogDescription>{confirm?.label}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => confirm && action(confirm.id, confirm.action)} disabled={busy}>
              {busy ? t("common.saving") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consume dialog */}
      <Dialog open={consumeId !== null} onOpenChange={(o) => !o && setConsumeId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("production.consumeMaterials")}</DialogTitle>
            <DialogDescription>{t("production.confirmConsume")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(consumeLines.length === 0 ? [{ productId: "", warehouseId: "", quantity: "" }] : consumeLines).map((l, idx) => (
              <div key={idx} className="grid gap-3 rounded-md border p-3 sm:grid-cols-12">
                <div className="space-y-2 sm:col-span-5">
                  <Label>{t("production.orderProduct")}</Label>
                  <Select
                    value={l.productId}
                    onValueChange={(v) => setConsumeLines((prev) => prev.map((x, i) => (i === idx ? { ...x, productId: v } : x)))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-4">
                  <Label>{t("production.orderWarehouse")}</Label>
                  <Select
                    value={l.warehouseId}
                    onValueChange={(v) => setConsumeLines((prev) => prev.map((x, i) => (i === idx ? { ...x, warehouseId: v } : x)))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label>{t("production.bomQuantity")}</Label>
                  <Input
                    type="number"
                    value={l.quantity}
                    onChange={(e) => setConsumeLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setConsumeLines((prev) => [...prev, { productId: "", warehouseId: "", quantity: "" }])}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
              {t("common.add")}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsumeId(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={doConsume} disabled={busy}>
              {busy ? t("common.saving") : t("production.consume")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
