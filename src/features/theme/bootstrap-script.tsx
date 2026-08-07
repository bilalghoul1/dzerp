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
 * Script inline anti-flash exécuté pendant le parsing HTML (avant le premier
 * paint). React avertit en dev quand un composant produit une balise `<script>`
 * ; le pattern documenté consiste à servir `text/javascript` côté serveur et
 * `text/plain` côté client (le script est alors ignoré à l'hydratation).
 * `suppressHydrationWarning` couvre ce changement de `type`.
 */
export function BootstrapScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
