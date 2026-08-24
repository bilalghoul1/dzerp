import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/features/theme/theme-provider";
import { I18nProvider } from "@/features/i18n/i18n-provider";
import { Toaster } from "@/components/ui/sonner";
import { getDirection, normalizeLocale } from "@/i18n";
import { STORAGE_KEYS } from "@/lib/constants";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = await cookies();
  const locale = normalizeLocale(store.get(STORAGE_KEYS.locale)?.value);
  const dir = getDirection(locale);
  const themeClass = store.get(STORAGE_KEYS.theme)?.value === "dark" ? "dark" : "";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexSansArabic.variable} ${themeClass} h-full antialiased`}
    >
      <head>
        <meta
          name="theme-color"
          content={themeClass === "dark" ? "#1a202c" : "#f7fafc"}
        />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
