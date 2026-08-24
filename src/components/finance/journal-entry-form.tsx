"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Account = { id: string; code: string; name: string };

type Line = { accountId: string; debit: string; credit: string };

export function JournalEntryForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { accountId: accounts[0]?.id ?? "", debit: "", credit: "" },
    { accountId: accounts[1]?.id ?? "", debit: "", credit: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const totalDebit = lines.reduce(
    (s, l) => s + (Number(l.debit) || 0),
    0,
  );
  const totalCredit = lines.reduce(
    (s, l) => s + (Number(l.credit) || 0),
    0,
  );

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const cleaned = lines
        .filter((l) => l.accountId)
        .map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        }));
      const res = await fetch("/api/finance/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          lines: cleaned,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Échec de l'écriture.");
      }
      toast.success("Écriture comptable enregistrée.");
      router.refresh();
      setDescription("");
      setLines([
        { accountId: accounts[0]?.id ?? "", debit: "", credit: "" },
        { accountId: accounts[1]?.id ?? "", debit: "", credit: "" },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <Label>Libellé</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Libellé de l'écriture"
          required
        />
      </div>

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_80px_auto] items-end gap-2">
            <div className="space-y-1">
              <Label>Compte</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={l.accountId}
                onChange={(e) => updateLine(i, { accountId: e.target.value })}
              >
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Débit</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={l.debit}
                onChange={(e) => updateLine(i, { debit: e.target.value, credit: "" })}
              />
            </div>
            <div className="space-y-1">
              <Label>Crédit</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={l.credit}
                onChange={(e) => updateLine(i, { credit: e.target.value, debit: "" })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setLines((prev) => prev.filter((_, idx) => idx !== i))
              }
              disabled={lines.length <= 2}
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              { accountId: accounts[0]?.id ?? "", debit: "", credit: "" },
            ])
          }
        >
          + Ligne
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Débit {totalDebit.toFixed(2)} / Crédit {totalCredit.toFixed(2)}
        </span>
        {Math.abs(totalDebit - totalCredit) > 0.0001 ? (
          <span className="text-destructive">Déséquilibré</span>
        ) : (
          <span className="text-emerald-600">Équilibré</span>
        )}
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Enregistrement…" : "Enregistrer l'écriture"}
      </Button>
    </form>
  );
}
