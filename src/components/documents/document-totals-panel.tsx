"use client";

import { useI18n } from "@/features/i18n/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import { formatCurrency } from "@/lib/utils";

export function DocumentTotalsPanel() {
  const { t, locale } = useI18n();
  const editor = useDocumentEditor();
  const currency = editor.header.currency || "DZD";
  const localeFmt = locale === "ar" ? "ar-DZ" : locale;

  const fmt = (value: number) => formatCurrency(value, localeFmt, currency);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <span className="material-symbols-outlined me-1.5 align-middle text-[18px] text-muted-foreground" aria-hidden="true">
            sum
          </span>
          {t("documentsUI.statistics")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("documentsUI.totalLines")}</span>
          <span className="font-medium tabular-nums">{editor.lines.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("documentsUI.subtotal")}</span>
          <span className="tabular-nums">{fmt(editor.totals.totalHt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("documentsUI.vat")}</span>
          <span className="tabular-nums">{fmt(editor.totals.totalTva)}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between font-semibold">
          <span>{t("documentsUI.grandTotal")}</span>
          <span className="tabular-nums">{fmt(editor.totals.totalTtc)}</span>
        </div>
        {editor.header.exchangeRate !== 1 && (
          <p className="text-xs text-muted-foreground">
            1 {currency} = {editor.header.exchangeRate} {t("documentsUI.currencyDefault")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
