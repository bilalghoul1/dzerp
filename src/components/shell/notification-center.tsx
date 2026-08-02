"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  titleAr: string | null;
  actorName: string | null;
  createdAt: string;
};

const ACTIVITY_ICONS: Record<string, string> = {
  CREATE: "add_circle",
  UPDATE: "edit",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  EXPORT: "download",
  IMPORT: "upload",
  ASSIGN: "assignment",
  VIEW: "visibility",
};

export function NotificationCenter() {
  const { t, locale } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const cancelledRef = React.useRef(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      cancelledRef.current = false;
      setLoading(true);
      fetch("/api/notifications")
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (!cancelledRef.current) setItems(json?.data ?? []);
        })
        .catch(() => {
          if (!cancelledRef.current) setItems([]);
        })
        .finally(() => {
          if (!cancelledRef.current) setLoading(false);
        });
    } else {
      cancelledRef.current = true;
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("header.notifications")}
        title={t("header.notifications")}
        className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          notifications
        </span>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              cancelledRef.current = true;
              setOpen(false);
            }}
            aria-hidden="true"
          />
          <div className="absolute end-0 top-10 z-50 w-80 rounded-lg border bg-popover text-popover-foreground shadow-md">
            <div className="border-b px-4 py-2.5">
              <p className="text-sm font-semibold">{t("header.notifications")}</p>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {loading ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("common.loading")}
                </p>
              ) : items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("header.noNotifications")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                          {ACTIVITY_ICONS[item.type] ?? "info"}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">
                          {locale === "ar" && item.titleAr ? item.titleAr : item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.actorName ?? "Système"} · {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t px-4 py-2">
              <p className={cn("text-xs text-muted-foreground")}>
                {items.length} {t("common.results")}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
