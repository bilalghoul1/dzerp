"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { BRANCH_COOKIE } from "@/lib/constants";
import { cn } from "@/lib/utils";

type BranchOption = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
};

export function BranchSelector({
  branches,
  activeBranch,
}: {
  branches: BranchOption[];
  activeBranch: BranchOption | null;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [open, setOpen] = React.useState(false);

  const select = (branch: BranchOption | null) => {
    if (branch) {
      document.cookie = `${BRANCH_COOKIE}=${branch.id}; path=/; max-age=31536000; samesite=lax`;
    } else {
      document.cookie = `${BRANCH_COOKIE}=; path=/; max-age=0; samesite=lax`;
    }
    setOpen(false);
    router.refresh();
  };

  const current = activeBranch;
  const currentLabel = current
    ? locale === "ar" && current.nameAr
      ? current.nameAr
      : current.name
    : t("preferences.global");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <span className="material-symbols-outlined text-[18px] text-muted-foreground" aria-hidden="true">
          storefront
        </span>
        <span className="max-w-40 truncate">{currentLabel}</span>
        <span className="material-symbols-outlined text-[16px] text-muted-foreground" aria-hidden="true">
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
            aria-label={t("header.branch")}
            className="absolute start-0 top-10 z-50 w-64 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("header.branch")}
            </p>
            <button
              type="button"
              role="option"
              aria-selected={!current}
              onClick={() => select(null)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm transition-colors hover:bg-accent"
            >
              <span className="material-symbols-outlined text-[18px] text-muted-foreground" aria-hidden="true">
                public
              </span>
              {t("preferences.global")}
            </button>
            {branches.map((branch) => {
              const selected = current?.id === branch.id;
              const label =
                locale === "ar" && branch.nameAr ? branch.nameAr : branch.name;
              return (
                <button
                  key={branch.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => select(branch)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm transition-colors hover:bg-accent",
                    selected && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="material-symbols-outlined text-[18px] text-muted-foreground" aria-hidden="true">
                    storefront
                  </span>
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="text-xs text-muted-foreground">{branch.code}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
