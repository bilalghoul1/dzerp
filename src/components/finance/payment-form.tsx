"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Customer = { id: string; name: string };
type Supplier = { id: string; name: string };
type Method = { id: string; name: string };
type PartyInvoice = {
  id: string;
  number: string;
  totalTtc: number;
  paidAmount: number;
  paymentStatus: string;
};

export function PaymentForm({
  customers,
  suppliers,
  methods,
  customerInvoices,
  supplierInvoices,
}: {
  customers: Customer[];
  suppliers: Supplier[];
  methods: Method[];
  customerInvoices: PartyInvoice[];
  supplierInvoices: PartyInvoice[];
}) {
  const router = useRouter();
  const [direction, setDirection] = useState<"RECEIVED" | "PAID">("RECEIVED");

  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const invoices = direction === "RECEIVED" ? customerInvoices : supplierInvoices;
  const partyId = direction === "RECEIVED" ? customerId : supplierId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const allocationField =
        direction === "RECEIVED" ? "invoiceId" : "supplierInvoiceId";
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          partyKind: direction === "RECEIVED" ? "CUSTOMER" : "SUPPLIER",
          customerId: direction === "RECEIVED" ? partyId || undefined : undefined,
          supplierId: direction === "PAID" ? partyId || undefined : undefined,
          methodId: methodId || undefined,
          amount: Number(amount),
          reference,
          notes,
          allocations: invoiceId
            ? [{ [allocationField]: invoiceId, amount: Number(amount) }]
            : [],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Échec de l'enregistrement.");
      }
      toast.success(
        direction === "RECEIVED"
          ? "Encaissement enregistré."
          : "Décaissement enregistré.",
      );
      router.refresh();
      setAmount("");
      setReference("");
      setNotes("");
      setInvoiceId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setDirection("RECEIVED");
            setInvoiceId("");
            setSupplierId("");
          }}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
            direction === "RECEIVED"
              ? "border-primary bg-primary/10 text-primary"
              : "border-input"
          }`}
        >
          Encaissement client
        </button>
        <button
          type="button"
          onClick={() => {
            setDirection("PAID");
            setInvoiceId("");
            setCustomerId("");
          }}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
            direction === "PAID"
              ? "border-primary bg-primary/10 text-primary"
              : "border-input"
          }`}
        >
          Décaissement fournisseur
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{direction === "RECEIVED" ? "Client" : "Fournisseur"}</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={partyId}
            onChange={(e) =>
              direction === "RECEIVED"
                ? setCustomerId(e.target.value)
                : setSupplierId(e.target.value)
            }
          >
            <option value="">—</option>
            {(direction === "RECEIVED" ? customers : suppliers).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>
            {direction === "RECEIVED" ? "Facture à régler" : "Facture fournisseur"}
          </Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          >
            <option value="">— (aucune)</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.number} — {inv.totalTtc.toFixed(2)} DZD
                {inv.paidAmount > 0 ? ` (payé ${inv.paidAmount.toFixed(2)})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Montant (DZD)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <Label>Mode de paiement</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
          >
            <option value="">—</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Référence</Label>
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Chèque / virement…"
        />
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting
          ? "Enregistrement…"
          : direction === "RECEIVED"
            ? "Enregistrer l'encaissement"
            : "Enregistrer le décaissement"}
      </Button>
    </form>
  );
}
