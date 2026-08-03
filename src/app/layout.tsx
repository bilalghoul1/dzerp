import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { cache } from "react";
import "./globals.css";
import { ThemeProvider } from "@/features/theme/theme-provider";
import { BootstrapScript } from "@/features/theme/bootstrap-script";
import { I18nProvider } from "@/features/i18n/i18n-provider";
import { Toaster } from "@/components/ui/sonner";
import { setFallbackContextResolver } from "@/features/company/context";
import { getCompanyContextOrResolve } from "@/features/company/resolver";

// Les rendus asynchrones des pages RSC s'exécutent hors du contexte ALS du
// layout. L'extension `companyScope` s'appuie donc sur ce résolveur de secours,
// mémorisé par requête (React.cache) : une seule résolution par requête,
// aucun partage entre requêtes/utilisateurs.
setFallbackContextResolver(cache(() => getCompanyContextOrResolve()));

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-sans-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DzERP - Système de Gestion Intégré",
  description:
    "Système de Gestion Intégré pour l'entreprise algérienne (Ventes, Achats, Stock, Production, Comptabilité).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      dir="ltr"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexSansArabic.variable} h-full antialiased`}
    >
      <head>
        <BootstrapScript />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
