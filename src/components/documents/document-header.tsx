"use client";

import { useI18n } from "@/features/i18n/i18n-provider";
import { useCompany } from "@/features/company/company-provider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { WorkflowSteps } from "@/components/documents/workflow-steps";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import { getDocConfig } from "@/features/documents/engine/config";
import { formatDate } from "@/lib/utils";

export function DocumentHeader() {
  const { t, locale } = useI18n();
  const company = useCompany();
  const editor = useDocumentEditor();
  const config = getDocConfig(editor.type);
  const isEditable = !editor.detail || editor.detail.status === "DRAFT";
  const dateLocale = locale === "ar" ? "ar-DZ" : locale;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <span className="material-symbols-outlined me-1.5 align-middle text-[18px] text-muted-foreground" aria-hidden="true">
            receipt_long
          </span>
          {t("documentsUI.headerSection")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{t("documentsUI.fieldNumber")}</Label>
            <Input
              value={editor.detail?.number ?? "—"}
              disabled
              readOnly
              aria-readonly="true"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("documentsUI.fieldStatus")}</Label>
            <div className="pt-1.5">
              <DocumentStatusBadge
                status={editor.detail?.status ?? "DRAFT"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-branch">{t("documentsUI.fieldBranch")} *</Label>
            {company.branches.length === 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t("documentsUI.noBranchWarning") ??
                  "Cette société ne possède aucune succursale. Créez une succursale dans les paramètres de la société avant d'enregistrer un document."}
              </div>
            ) : (
              <Select
                value={editor.header.branchId}
                onValueChange={(value) =>
                  editor.setHeaderField("branchId", value)
                }
                disabled={!isEditable || editor.busy}
              >
                <SelectTrigger id="doc-branch">
                  <SelectValue placeholder={t("common.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {company.branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-party">{t(`documentsUI.${config.partyField === "customerId" ? "fieldCustomer" : "fieldSupplier"}`)} *</Label>
            <Select
              value={editor.header.partyId}
              onValueChange={(value) =>
                editor.setHeaderField("partyId", value)
              }
              disabled={!isEditable || editor.busy}
            >
              <SelectTrigger id="doc-party">
                <SelectValue placeholder={t("common.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {editor.lookups.parties.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    {party.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {config.partyField === "customerId" && editor.detail?.partyId ? (
              <a
                href={`/crm/customers/${editor.detail.partyId}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  open_in_new
                </span>
                {t("documentsUI.crmOpenCustomer")}
              </a>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-currency">{t("documentsUI.fieldCurrency")}</Label>
            <Select
              value={editor.header.currency}
              onValueChange={(value) => {
                const currency = editor.lookups.currencies.find(
                  (c) => c.code === value,
                );
                editor.setHeaderField("currency", value);
                if (currency && currency.rate !== 1) {
                  editor.setHeaderField("exchangeRate", currency.rate);
                }
              }}
              disabled={!isEditable || editor.busy}
            >
              <SelectTrigger id="doc-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {editor.lookups.currencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} — {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-rate">{t("documentsUI.fieldExchangeRate")}</Label>
            <Input
              id="doc-rate"
              type="number"
              min={0}
              step="0.01"
              value={editor.header.exchangeRate}
              onChange={(e) =>
                editor.setHeaderField("exchangeRate", Number(e.target.value))
              }
              disabled={!isEditable || editor.busy}
              inputMode="decimal"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("documentsUI.fieldIssuedAt")}</Label>
            <Input
              value={
                editor.header.issuedAt
                  ? formatDate(editor.header.issuedAt, dateLocale)
                  : "—"
              }
              disabled
              readOnly
              aria-readonly="true"
            />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="doc-notes">{t("documentsUI.fieldNotes")}</Label>
            <Textarea
              id="doc-notes"
              rows={2}
              value={editor.header.notes}
              onChange={(e) => editor.setHeaderField("notes", e.target.value)}
              placeholder={t("documentsUI.notesPlaceholder")}
              disabled={!isEditable || editor.busy}
            />
          </div>
        </div>
      </CardContent>
      {editor.docId ? (
        <div className="border-t px-6 py-3">
          <WorkflowSteps />
        </div>
      ) : null}
    </Card>
  );
}
