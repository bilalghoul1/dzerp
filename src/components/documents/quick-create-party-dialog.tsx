"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EditorPartyOption } from "@/components/documents/document-editor-context";

type PartyNature = "customer" | "supplier";

/**
 * Création rapide en ligne d'un client/fournisseur depuis un formulaire de
 * document : crée via l'API (server-side, permissions + scoping société), puis
 * sélectionne la nouvelle entité via `onCreated`.
 */
export function QuickCreatePartyDialog({
  nature,
  onCreated,
}: {
  nature: PartyNature;
  onCreated: (party: EditorPartyOption) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<"COMPANY" | "INDIVIDUAL">("COMPANY");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setName("");
    setType("COMPANY");
    setPhone("");
    setEmail("");
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error(t("common.required"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/${nature}s`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message ?? t("documentsUI.saveError"));
      }
      onCreated({ id: data.id, name: data.name });
      setOpen(false);
      reset();
      toast.success(t("parties.add"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const partyLabel =
    nature === "customer" ? t("quickCreate.customer") : t("quickCreate.supplier");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={t("documentsUI.quickCreateParty")}
          title={t("documentsUI.quickCreateParty")}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("documentsUI.quickCreateParty")}</DialogTitle>
          <DialogDescription>
            {t(
              nature === "customer"
                ? "documentsUI.quickCreateCustomerHint"
                : "documentsUI.quickCreateSupplierHint",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qcp-name">{partyLabel} *</Label>
            <Input
              id="qcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={partyLabel}
              disabled={busy}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("documentsUI.quickCreateType")}</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as "COMPANY" | "INDIVIDUAL")}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">
                    {t("documentsUI.quickCreateTypeCompany")}
                  </SelectItem>
                  <SelectItem value="INDIVIDUAL">
                    {t("documentsUI.quickCreateTypeIndividual")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qcp-phone">{t("documentsUI.quickCreatePhone")}</Label>
              <Input
                id="qcp-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qcp-email">{t("documentsUI.quickCreateEmail")}</Label>
            <Input
              id="qcp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? t("common.saving") : t("documentsUI.quickCreateSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}