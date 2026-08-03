"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type { CompanyRef } from "@/features/company/types";

/**
 * Sélecteur de société (en-tête).
 * - Une seule société : nom seul (badge statique).
 * - Plusieurs sociétés : menu déroulant ; le changement persiste la société
 *   (session + cookie) puis rafraîchit le contexte, le tableau de bord, la
 *   navigation, les notifications et la recherche globale (router.refresh()).
 */
export function CompanySwitcher({
  company,
  companies,
}: {
  company: CompanyRef;
  companies: CompanyRef[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const select = async (target: CompanyRef) => {
    if (target.id === company.id) {
      setOpen(false);
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/session/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: target.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setPending(false);
    }
  };

  if (companies.length <= 1) {
    return (
      <div className="hidden items-center gap-2 md:flex">
        <span
          className="material-symbols-outlined text-[20px] text-primary"
          aria-hidden="true"
        >
          domain
        </span>
        <span className="max-w-40 truncate text-sm font-semibold tracking-tight">
          {company.name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("header.company")}
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
          pending && "opacity-60",
        )}
      >
        <span
          className="material-symbols-outlined text-[18px] text-primary"
          aria-hidden="true"
        >
          domain
        </span>
        <span className="max-w-40 truncate font-semibold tracking-tight">
          {company.name}
        </span>
        <span
          className="material-symbols-outlined text-[16px] text-muted-foreground"
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="listbox"
            aria-label={t("header.company")}
            className="absolute start-0 top-10 z-50 w-64 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("header.company")}
            </p>
            {companies.map((c) => {
              const selected = c.id === company.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={pending}
                  onClick={() => select(c)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm transition-colors hover:bg-accent",
                    selected && "bg-accent text-accent-foreground",
                    pending && "opacity-60",
                  )}
                >
                  <span
                    className="material-symbols-outlined text-[18px] text-muted-foreground"
                    aria-hidden="true"
                  >
                    domain
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {selected ? (
                    <span
                      className="material-symbols-outlined text-[16px] text-primary"
                      aria-hidden="true"
                    >
                      check
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
