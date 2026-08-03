"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/features/i18n/i18n-provider";
import { mainNav, footerNav, filterNav } from "@/components/shell/nav-config";
import type { PermissionKey } from "@/features/auth/permissions";

type SearchHit = {
  type: string;
  id: string;
  title: string;
  titleAr?: string | null;
  subtitle: string | null;
  href: string;
  icon: string;
};

const QUICK_ACTIONS: SearchHit[] = [
  { type: "action", id: "devis", title: "devis", titleAr: null, subtitle: null, href: "/devis/nouveau", icon: "note_add" },
  { type: "action", id: "client", title: "client", titleAr: null, subtitle: null, href: "/crm/customers", icon: "person_add" },
  { type: "action", id: "commande", title: "commande", titleAr: null, subtitle: null, href: "/achats/bons/nouveau", icon: "add_shopping_cart" },
];

export function CommandPalette({
  open,
  onOpenChange,
  permissions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions?: readonly PermissionKey[];
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [recent, setRecent] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  const pages = React.useMemo(() => {
    const items = [...mainNav, ...footerNav];
    const visible = permissions ? filterNav(items, permissions) : items;
    return visible.map((item) => ({
      type: "page",
      id: item.href,
      title: t(item.labelKey),
      titleAr: null,
      subtitle: null,
      href: item.href,
      icon: item.icon,
    }));
  }, [permissions, t]);

  const grouped = React.useMemo(() => {
    const groups = new Map<string, SearchHit[]>();
    const push = (label: string, item: SearchHit) => {
      const list = groups.get(label) ?? [];
      list.push(item);
      groups.set(label, list);
    };

    if (query.trim()) {
      const labelOf = (type: string) => {
        switch (type) {
          case "client":
            return t("search.clients");
          case "supplier":
            return t("search.suppliers");
          case "product":
            return t("search.products");
          case "user":
            return t("search.users");
          case "branch":
            return t("search.branches");
          case "document":
            return t("search.documents");
          case "action":
            return t("search.actions");
          default:
            return t("search.results");
        }
      };
      for (const hit of hits) push(labelOf(hit.type), hit);
    } else {
      for (const page of pages) push(t("search.pages"), page);
      const actionTitles = new Map([
        ["devis", t("quickCreate.quotation")],
        ["client", t("quickCreate.customer")],
        ["commande", t("quickCreate.purchaseOrder")],
      ]);
      for (const action of QUICK_ACTIONS) {
        push(t("search.actions"), { ...action, title: actionTitles.get(action.id) ?? action.title });
      }
      for (const doc of recent) push(t("search.recentDocuments"), doc);
    }
    return Array.from(groups.entries());
  }, [query, hits, recent, pages, t]);

  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = q
          ? `/api/search?q=${encodeURIComponent(q)}`
          : "/api/search?recent=1";
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          if (q) setHits([]);
          else setRecent([]);
          return;
        }
        const json = await res.json();
        if (q) setHits(json.data ?? []);
        else setRecent(json.data ?? []);
      } catch {
        if (!controller.signal.aborted) {
          if (q) setHits([]);
          else setRecent([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, q ? 200 : 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[18%] translate-y-0 overflow-hidden p-0 sm:max-w-xl sm:rounded-xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const input = document.querySelector<HTMLInputElement>("#command-input");
          input?.focus();
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("search.placeholder")}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-4">
          <span className="material-symbols-outlined text-[20px] text-muted-foreground" aria-hidden="true">
            search
          </span>
          <input
            id="command-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHits([]);
            }}
            placeholder={t("search.placeholder")}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-[380px] overflow-y-auto p-2">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : grouped.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {query.trim().length > 0
                ? t("search.noResults", { q: query })
                : t("search.actions")}
            </p>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-2">
                <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group}
                </p>
                {items.map((hit) => (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      router.push(hit.href);
                    }}
                    className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-start transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        {hit.icon}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {locale === "ar" && hit.titleAr ? hit.titleAr : hit.title}
                      </span>
                      {hit.subtitle ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {hit.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
