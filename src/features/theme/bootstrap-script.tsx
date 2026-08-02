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

export function BootstrapScript() {
  return (
    <script dangerouslySetInnerHTML={{ __html: script }} />
  );
}
