"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
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
  convertDocument,
  DocumentApiError,
} from "@/features/documents/framework/api";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import type { CommercialDocType } from "@/features/documents/engine/types";

export function DocumentConvertDialog({
  open,
  onOpenChange,
  sourceType,
  sourceId,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: CommercialDocType;
  sourceId: string;
  onConverted?: (targetType: CommercialDocType, targetId: string) => void;
}) {
  const { t } = useI18n();
  const [target, setTarget] = React.useState<CommercialDocType | "">("");
  const [busy, setBusy] = React.useState(false);

  const config = getUiConfig(sourceType);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialisation à l'ouverture
    if (open) setTarget("");
  }, [open]);

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const result = await convertDocument({
        sourceDocType: sourceType,
        sourceDocId: sourceId,
        targetDocType: target,
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
            : error.message
          : t("documentsUI.saveError");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("documentsUI.convertTo")}</DialogTitle>
          <DialogDescription>
            {t("documentsUI.conversionDescription")}
          </DialogDescription>
        </DialogHeader>

        {config.allowedConversions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("documentsUI.noTransitions")}
          </p>
        ) : (
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
