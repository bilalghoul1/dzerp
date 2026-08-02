import Link from "next/link";
import { getServerI18n } from "@/features/i18n/server";
import { Button } from "@/components/ui/button";

const MODULE_ICONS: Record<string, string> = {
  crm: "group",
  ventes: "payments",
  achats: "shopping_cart",
  stock: "inventory_2",
  production: "factory",
  comptabilite: "account_balance",
  rh: "badge",
  rapports: "bar_chart",
  aide: "help",
  devis: "description",
};

export async function ComingSoon({
  moduleKey,
}: {
  moduleKey?: string;
}) {
  const { t } = await getServerI18n();
  const icon = moduleKey ? (MODULE_ICONS[moduleKey] ?? "construction") : "construction";

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("comingSoon.title")}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("comingSoon.description")}
        </p>
      </div>
      <Button asChild>
        <Link href="/">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          {t("comingSoon.back")}
        </Link>
      </Button>
    </div>
  );
}
