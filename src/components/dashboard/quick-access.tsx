import Link from "next/link";

export interface QuickActionItem {
  key: string;
  label: string;
  href: string;
  icon: string;
  permission?: string;
}

interface QuickAccessProps {
  items: QuickActionItem[];
  title: string;
}

/**
 * Zone D — Hub d'accès rapide : grille de boutons d'action pour les tâches
 * les plus fréquentes [Créer facture, Ajouter client, Ajouter produit, ...].
 */
export function QuickAccess({ items, title }: QuickAccessProps) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((action) => (
          <Link
            key={action.key}
            href={action.href}
            className="group flex flex-col items-start gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:bg-accent hover:shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {action.icon}
              </span>
            </span>
            <span className="text-sm font-medium leading-tight">{action.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
