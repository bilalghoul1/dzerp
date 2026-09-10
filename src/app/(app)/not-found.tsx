import Link from "next/link";
import { getServerI18n } from "@/features/i18n/server";
import { Button } from "@/components/ui/button";

const SUGGESTIONS: { labelKey: string; href: string; icon: string }[] = [
  { labelKey: "nav.documents", href: "/documents", icon: "description" },
  { labelKey: "nav.customers", href: "/crm/customers", icon: "group" },
  { labelKey: "nav.suppliers", href: "/crm/suppliers", icon: "handshake" },
  { labelKey: "nav.stock", href: "/stock", icon: "inventory_2" },
  { labelKey: "nav.parametres", href: "/parametres", icon: "settings" },
  { labelKey: "nav.aide", href: "/aide", icon: "help" },
];

export default async function AppNotFound() {
  const { t } = await getServerI18n();

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
          error
        </span>
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("notFound.title")}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("notFound.description")}
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          {t("notFound.back")}
        </Link>
      </Button>
      <div className="mt-2 w-full max-w-lg">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("notFound.suggested")}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                {s.icon}
              </span>
              {t(s.labelKey)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}