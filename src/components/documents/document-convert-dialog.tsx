"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  convertDocument,
  DocumentApiError,
  getDocument,
} from "@/features/documents/framework/api";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import type { DocumentDetailModel } from "@/features/documents/framework/ui-types";
import type { CommercialDocType } from "@/features/documents/engine/types";

/**
 * Conversion de documents. Pour SALES_ORDER → DELIVERY_NOTE, affiche le suivi
 * des quantités (commandé / déjà livré / restant / à livrer) pour permettre
 * les livraisons partielles et multiples.
 *
 * Le parent contrôle la réinitialisation : il doit passer une `key` qui change
 * à chaque ouverture (remontage = état vierge).
 */
export function DocumentConvertDialog({
  open,
  onOpenChange,
  sourceType,
  sourceId,
  initialTarget,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: CommercialDocType;
  sourceId: string;
  initialTarget?: CommercialDocType | null;
  onConverted?: (targetType: CommercialDocType, targetId: string) => void;
}) {
  const { t } = useI18n();
  const [target, setTarget] = React.useState<CommercialDocType | "">(
    initialTarget ?? "",
  );
  const [busy, setBusy] = React.useState(false);
  const [detail, setDetail] = React.useState<DocumentDetailModel | null>(null);
  const [deliveries, setDeliveries] = React.useState<Record<string, number>>({});

  const config = getUiConfig(sourceType);
  const isDeliveryFlow = sourceType === "SALES_ORDER" && target === "DELIVERY_NOTE";

  React.useEffect(() => {
    if (sourceType !== "SALES_ORDER") return;
    let cancelled = false;
    void getDocument(sourceType, sourceId)
      .then((doc) => {
        if (!cancelled) setDetail(doc);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceType, sourceId]);

  const deliveryRows = React.useMemo(() => {
    if (!detail) return [];
    return detail.lines.map((line) => {
      const remaining = line.remainingQty ?? line.quantity;
      const delivered = line.quantity - remaining;
      return { line, remaining, delivered };
    });
  }, [detail]);

  const buildDeliveries = () =>
    Object.entries(deliveries)
      .filter(([, qty]) => qty > 0)
      .map(([lineId, quantity]) => ({ lineId, quantity }));

  const run = async () => {
    if (!target) return;
    if (isDeliveryFlow && buildDeliveries().length === 0) {
      toast.error(t("documentsUI.noQtyToDeliver"));
      return;
    }
    setBusy(true);
    try {
      const result = await convertDocument({
        sourceDocType: sourceType,
        sourceDocId: sourceId,
        targetDocType: target,
        deliveries: isDeliveryFlow ? buildDeliveries() : undefined,
      });
      toast.success(t("documentsUI.convertedSuccess"));
      onOpenChange(false);
      onConverted?.(target, "");
      void result;
    } catch (error) {
      const message =
        error instanceof DocumentApiError
          ? error.code === "ALREADY_CONVERTED"
            ? t("documentsUI.alreadyConverted", {
                target: t(`docTypes.${target}`),
              })
            : error.code === "ALREADY_DELIVERED"
              ? t("documentsUI.alreadyDelivered")
              : error.code === "OVER_DELIVERY"
                ? t("documentsUI.overDelivery")
                : error.code === "NO_QUANTITY_TO_DELIVER"
                  ? t("documentsUI.noQtyToDeliver")
                  : error.message
          : t("documentsUI.saveError");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const setDeliveredQty = (lineId: string, quantity: number) => {
    setDeliveries((prev) => ({ ...prev, [lineId]: quantity }));
  };

  const deliverAll = () => {
    const next: Record<string, number> = {};
    for (const row of deliveryRows) {
      if (row.remaining > 0) next[row.line.id ?? ""] = row.remaining;
    }
    setDeliveries(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isDeliveryFlow ? "sm:max-w-2xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>
            {isDeliveryFlow
              ? t("documentsUI.deliveryDialogTitle")
              : t("documentsUI.convertTo")}
          </DialogTitle>
          <DialogDescription>
            {isDeliveryFlow
              ? t("documentsUI.deliveryDialogDescription", {
                  number: detail?.number ?? "",
                })
              : t("documentsUI.conversionDescription")}
          </DialogDescription>
        </DialogHeader>

        {config.allowedConversions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("documentsUI.noTransitions")}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="document-convert-target"
                className="text-sm font-medium"
              >
                {t("documentsUI.selectTarget")}
              </label>
              <Select
                value={target}
                onValueChange={(value) => setTarget(value as CommercialDocType)}
              >
                <SelectTrigger id="document-convert-target">
                  <SelectValue placeholder={t("common.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {config.allowedConversions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`docTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isDeliveryFlow && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {t("documentsUI.linesSection")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={deliverAll}
                    disabled={busy}
                  >
                    {t("documentsUI.allRemaining")}
                  </Button>
                </div>
                {deliveryRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("documentsUI.noLines")}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]">
                            {t("documentsUI.lineDescription")}
                          </TableHead>
                          <TableHead className="w-[88px] whitespace-nowrap text-end">
                            {t("documentsUI.qtyOrdered")}
                          </TableHead>
                          <TableHead className="w-[88px] whitespace-nowrap text-end">
                            {t("documentsUI.qtyDelivered")}
                          </TableHead>
                          <TableHead className="w-[88px] whitespace-nowrap text-end">
                            {t("documentsUI.qtyRemaining")}
                          </TableHead>
                          <TableHead className="w-[104px] whitespace-nowrap text-end">
                            {t("documentsUI.qtyToDeliver")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveryRows.map((row) => {
                          const current = deliveries[row.line.id ?? ""] ?? row.remaining;
                          return (
                            <TableRow key={row.line.id ?? row.line.lineNumber}>
                              <TableCell className="py-1 text-sm">
                                {row.line.label}
                              </TableCell>
                              <TableCell className="py-1 text-end text-sm tabular-nums">
                                {row.line.quantity}
                              </TableCell>
                              <TableCell className="py-1 text-end text-sm tabular-nums">
                                {row.delivered}
                              </TableCell>
                              <TableCell className="py-1 text-end text-sm tabular-nums">
                                {row.remaining}
                              </TableCell>
                              <TableCell className="py-1 text-end">
                                <Input
                                  type="number"
                                  min={0}
                                  max={row.remaining}
                                  step="any"
                                  value={current}
                                  onChange={(e) =>
                                    setDeliveredQty(
                                      row.line.id ?? "",
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                  className="h-8 w-full min-w-[5.5rem] text-end px-3"
                                  disabled={busy || row.remaining <= 0}
                                  inputMode="decimal"
                                  aria-label={t("documentsUI.qtyToDeliver")}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={run} disabled={busy || !target}>
            {busy ? t("common.saving") : t("documentsUI.convert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
