"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useTheme } from "@/features/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/feedback/spinner";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale, locales } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // First-login obligation: après une connexion réussie sur un compte qui doit
  // changer son mot de passe (Super Admin initial, Propriétaire temporaire),
  // on bloque la navigation vers l'application tant que le mot de passe n'est pas changé.
  const [mustChange, setMustChange] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changing, setChanging] = React.useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t("changePassword.mismatch"));
      return;
    }
    setChanging(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? t("auth.loginError"));
        return;
      }
      toast.success(t("changePassword.success"));
      setMustChange(false);
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(t("auth.loginError"));
    } finally {
      setChanging(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? t("auth.loginError"));
        toast.error(json?.error?.message ?? t("auth.loginError"));
        return;
      }
      const json = await res.json().catch(() => null);
      if (json?.data?.mustChangePassword) {
        setMustChange(true);
        return;
      }
      toast.success(t("auth.submit"));
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("auth.loginError"));
      toast.error(t("auth.loginError"));
    } finally {
      setBusy(false);
    }
  };

  const localeLabels: Record<string, string> = {
    fr: "Français (FR)",
    ar: "العربية (AR)",
    en: "English (EN)",
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent" />
      </div>

      <main className="relative z-10 w-full max-w-md">
        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
                domain
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("common.appName")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.title")}</p>
          </div>

          {mustChange ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              {t("auth.mustChangePassword")}
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                error
              </span>
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={mustChange ? changePassword : handleSubmit} className="space-y-4">
            {mustChange ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="pw-new">{t("changePassword.new")}</Label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground" aria-hidden="true">
                      lock
                    </span>
                    <Input
                      id="pw-new"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="ps-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw-confirm">{t("changePassword.confirm")}</Label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground" aria-hidden="true">
                      lock
                    </span>
                    <Input
                      id="pw-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="ps-9"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={changing}>
                  {changing ? <Spinner className="py-0" /> : t("changePassword.save")}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username">{t("auth.username")}</Label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground" aria-hidden="true">
                      person
                    </span>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      required
                      autoComplete="username"
                      className="ps-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <button type="button" className="text-xs text-primary hover:underline">
                      {t("auth.forgot")}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground" aria-hidden="true">
                      lock
                    </span>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="ps-9 pe-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Afficher le mot de passe"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Spinner className="py-0" /> : t("auth.submit")}
                </Button>
              </>
            )}
          </form>

          <div className="mt-5 flex flex-col gap-3 border-t pt-4 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                verified_user
              </span>
              <span className="text-xs">{t("auth.secure")}</span>
            </div>
            <div className="flex items-center justify-between gap-1 sm:justify-end">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded p-1.5 hover:bg-accent"
                aria-label="Changer le thème"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  {theme === "dark" ? "light_mode" : "dark_mode"}
                </span>
              </button>
              <select
                aria-label="Langue"
                value={locale}
                onChange={(e) => setLocale(e.target.value as typeof locale)}
                className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {localeLabels[l]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          © 2024-2026 DzERP Algérie. Tous droits réservés.
        </p>
      </main>
    </div>
  );
}
