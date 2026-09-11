import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PublicLandingPage } from "@/components/landing/public-landing-page";
import { DEFAULT_LOCALE, STORAGE_KEYS } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const locale = (store.get(STORAGE_KEYS.locale)?.value as string) || DEFAULT_LOCALE;

  const titles: Record<string, string> = {
    ar: "DzERP — نظام متكامل لإدارة المؤسسات في الجزائر",
    fr: "DzERP — ERP algérien tout-en-un pour votre entreprise",
    en: "DzERP — All-in-one Algerian ERP for your business",
  };
  const descriptions: Record<string, string> = {
    ar: "Ventes, achats, stock, comptabilité, RH et fiscalité algérienne (TVA, TAP, IRG, CNAS, SCF) dans une seule plateforme.",
    fr: "Ventes, achats, stock, comptabilité, RH et fiscalité algérienne (TVA, TAP, IRG, CNAS, SCF) dans une seule plateforme.",
    en: "Sales, purchasing, inventory, accounting, HR and Algerian taxation (TVA, TAP, IRG, CNAS, SCF) in one platform.",
  };

  return {
    title: titles[locale] ?? titles.fr,
    description: descriptions[locale] ?? descriptions.fr,
  };
}

export default function Home(): React.JSX.Element {
  return <PublicLandingPage />;
}