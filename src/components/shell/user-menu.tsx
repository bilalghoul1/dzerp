"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useTheme } from "@/features/theme/theme-provider";
import { formatDateTime, cn } from "@/lib/utils";
import type { SessionUser } from "@/features/auth/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}
      title={theme === "dark" ? "Mode clair" : "Mode sombre"}
    >
      {theme === "dark" ? (
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          light_mode
        </span>
      ) : (
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          dark_mode
        </span>
      )}
    </Button>
  );
}

const LOCALE_LABELS: Record<string, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

export function LocaleToggle() {
  const { locale, setLocale, locales } = useI18n();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Changer la langue"
      title="Changer la langue"
      onClick={() => {
        const next = locales[(locales.indexOf(locale) + 1) % locales.length];
        setLocale(next);
      }}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
        language
      </span>
      <span className="sr-only">{LOCALE_LABELS[locale] ?? locale}</span>
    </Button>
  );
}

type MenuItemProps = {
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  children?: React.ReactNode;
};

function MenuRow({ icon, label, onClick, href, active, children }: MenuItemProps) {
  const className = cn(
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
    active && "bg-accent text-accent-foreground",
  );
  const iconEl = (
    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
      {icon}
    </span>
  );
  return (
    <li>
      {href ? (
        <Link href={href} onClick={onClick} className={className}>
          {iconEl}
          {label}
          {children}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={className}>
          {iconEl}
          {label}
          {children}
        </button>
      )}
    </li>
  );
}

type DialogState = "profile" | "password" | "sessions" | null;

function ProfileDialog({ user, open, onClose }: { user: SessionUser; open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const roles = user.roles
    .map((r) => (locale === "ar" && r.role.nameAr ? r.role.nameAr : r.role.name))
    .join(", ");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("profile.title")}</DialogTitle>
          <DialogDescription>{t("profile.description")}</DialogDescription>
        </DialogHeader>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("profile.username")}</dt>
            <dd className="font-medium">{user.username}</dd>
          </div>
          {user.fullName ? (
            <div>
              <dt className="text-muted-foreground">{t("common.appName")}</dt>
              <dd className="font-medium">{user.fullName}</dd>
            </div>
          ) : null}
          {user.email ? (
            <div>
              <dt>{t("parametres.email")}</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">{t("profile.role")}</dt>
            <dd className="font-medium">{roles || "—"}</dd>
          </div>
          {user.branch ? (
            <div>
              <dt className="text-muted-foreground">{t("header.branch")}</dt>
              <dd className="font-medium">
                {locale === "ar" && user.branch.nameAr
                  ? user.branch.nameAr
                  : user.branch.name}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">{t("profile.lastLogin")}</dt>
            <dd className="font-medium">
              {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
            </dd>
          </div>
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (next !== confirm) {
      toast.error(t("changePassword.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      toast.success(t("changePassword.success"));
      setCurrent("");
      setNext("");
      setConfirm("");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("changePassword.title")}</DialogTitle>
          <DialogDescription>{t("changePassword.weak")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="pw-current">{t("changePassword.current")}</Label>
            <Input
              id="pw-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-new">{t("changePassword.new")}</Label>
            <Input
              id="pw-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-confirm">{t("changePassword.confirm")}</Label>
            <Input
              id="pw-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !current || !next || next.length < 8}>
            {busy ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SessionRow = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  current: boolean;
};

function SessionsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [sessions, setSessions] = React.useState<SessionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/sessions")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setSessions(json?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const revoke = async (sessionId: string) => {
    setBusyId(sessionId);
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, revokedAt: new Date().toISOString() } : s,
        ),
      );
      toast.success(t("sessions.revoked"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sessions.title")}</DialogTitle>
          <DialogDescription>{t("sessions.description")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("sessions.empty")}
            </p>
          ) : (
            sessions.map((session) => {
              const device = session.userAgent
                ? session.userAgent.slice(0, 60)
                : t("sessions.device");
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {device}
                      {session.current ? (
                        <span className="ms-2 text-xs font-normal text-primary">
                          {t("sessions.current")}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {session.ip ?? "—"} · {formatDateTime(session.createdAt)}
                    </p>
                  </div>
                  {session.revokedAt ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("sessions.revoked")}
                    </span>
                  ) : session.current ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === session.id}
                      onClick={() => revoke(session.id)}
                    >
                      {t("sessions.revoke")}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { t, locale, setLocale, locales } = useI18n();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [submenu, setSubmenu] = React.useState<"language" | "appearance" | null>(null);
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [busy, setBusy] = React.useState(false);

  const initials = (user.fullName ?? user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const closeAll = () => {
    setMenuOpen(false);
    setSubmenu(null);
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success(t("auth.logoutSuccess"));
      router.push("/login");
      router.refresh();
    } catch {
      // ignorer — la session expire côté serveur de toute façon
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Menu utilisateur"
        onClick={() => {
          setMenuOpen((v) => !v);
          setSubmenu(null);
        }}
        className="rounded-full"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials || "?"}
        </span>
      </Button>
      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={closeAll} aria-hidden="true" />
          <div className="absolute end-0 top-11 z-50 w-64 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
            <div className="border-b px-3 py-2">
              <p className="truncate text-sm font-medium">
                {user.fullName ?? user.username}
              </p>
              {user.title ? (
                <p className="truncate text-xs text-muted-foreground">{user.title}</p>
              ) : null}
              {user.email ? (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              ) : null}
            </div>

            {submenu === "language" ? (
              <ul className="mt-1">
                {locales.map((l) => (
                  <li key={l}>
                    <button
                      type="button"
                      onClick={() => {
                        setLocale(l);
                        closeAll();
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                        l === locale && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        {l === locale ? "radio_button_checked" : "radio_button_unchecked"}
                      </span>
                      {LOCALE_LABELS[l] ?? l}
                    </button>
                  </li>
                ))}
              </ul>
            ) : submenu === "appearance" ? (
              <ul className="mt-1">
                {(["light", "dark"] as const).map((tone) => (
                  <li key={tone}>
                    <button
                      type="button"
                      onClick={() => {
                        setTheme(tone);
                        closeAll();
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                        tone === theme && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        {tone === "light" ? "light_mode" : "dark_mode"}
                      </span>
                      {tone === "light" ? t("preferences.light") : t("preferences.dark")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="mt-1 space-y-0.5">
                <MenuRow icon="person" label={t("userMenu.profile")} onClick={() => setDialog("profile")} />
                <MenuRow
                  icon="account_circle"
                  label={t("account.title")}
                  href="/compte"
                  onClick={closeAll}
                />
                <MenuRow
                  icon="settings"
                  label={t("userMenu.preferences")}
                  href="/parametres/preferences"
                  onClick={closeAll}
                />
                <MenuRow
                  icon="language"
                  label={t("userMenu.language")}
                  onClick={() => setSubmenu("language")}
                >
                  <span className="ms-auto text-xs text-muted-foreground">
                    {LOCALE_LABELS[locale] ?? locale}
                  </span>
                </MenuRow>
                <MenuRow
                  icon="contrast"
                  label={t("userMenu.appearance")}
                  onClick={() => setSubmenu("appearance")}
                >
                  <span className="ms-auto text-xs text-muted-foreground">
                    {theme === "dark" ? t("preferences.dark") : t("preferences.light")}
                  </span>
                </MenuRow>
                <li className="my-1 border-t" aria-hidden="true" />
                <MenuRow icon="lock" label={t("userMenu.changePassword")} onClick={() => setDialog("password")} />
                <MenuRow icon="devices" label={t("userMenu.activeSessions")} onClick={() => setDialog("sessions")} />
                <li className="my-1 border-t" aria-hidden="true" />
                <MenuRow icon={busy ? "progress_activity" : "logout"} label={busy ? t("auth.loggingOut") : t("auth.logout")} onClick={handleLogout} />
              </ul>
            )}
          </div>
        </>
      ) : null}

      <ProfileDialog user={user} open={dialog === "profile"} onClose={() => setDialog(null)} />
      <ChangePasswordDialog open={dialog === "password"} onClose={() => setDialog(null)} />
      {dialog === "sessions" ? <SessionsDialog onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
