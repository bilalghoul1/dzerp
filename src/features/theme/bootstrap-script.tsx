import Script from "next/script";
import { STORAGE_KEYS } from "@/lib/constants";

const script = `(function(){
  try {
    var t = localStorage.getItem("${STORAGE_KEYS.theme}");
    if (t === "dark") document.documentElement.classList.add("dark");
    var l = localStorage.getItem("${STORAGE_KEYS.locale}");
    if (l === "ar") { document.documentElement.lang = "ar"; document.documentElement.dir = "rtl"; }
    else if (l === "en") { document.documentElement.lang = "en"; document.documentElement.dir = "ltr"; }
    else { document.documentElement.lang = "fr"; document.documentElement.dir = "ltr"; }
  } catch (e) {}
})();`;

/**
 * Script de bootstrap du thème/langue/dir, exécuté après hydratation
 * (anti-FOUC partiel). En Next 16 / React 19, un <script> (littéral ou
 * next/script beforeInteractive) placé dans le RootLayout casse le rendu
 * client ("Console Error" / "Encountered a script tag"). afterInteractive
 * injecte le script côté client après hydratation : aucun élément <script>
 * dans l'arbre RSC → pas de crash. Le flash est évité car le script est
 * minuscule et exécuté immédiatement.
 */
export function BootstrapScript() {
  return (
    <Script
      id="theme-bootstrap"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
