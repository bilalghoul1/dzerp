import { getDocument } from "pdfjs-dist";
import { prepareArabicText } from "../src/features/print/fonts";
import { buildLabels } from "../src/features/print/service";
import type { PrintParty } from "../src/features/print/types";
import { mockDoc } from "./print-smoke";

// Vérifie les ancrages RTL/LTR via les positions extraites par pdf.js
// (transform[4] = x, transform[5] = y, espace PDF en points).

interface Item {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

async function extractItems(pdf: Uint8Array): Promise<Item[]> {
  const doc = await getDocument({ data: pdf }).promise;
  const items: Item[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    for (const raw of content.items) {
      const it = raw as { str: string; transform: number[]; width: number; height: number };
      items.push({
        str: it.str,
        // Les textes peuvent contenir des marqueurs invisibles (clipping) —
        // on filtre les str vides et les espaces purs.
        x: it.transform[4],
        y: it.transform[5],
        width: it.width ?? 0,
        height: it.height ?? 0,
        page: i,
      });
    }
  }
  await doc.destroy();
  return items;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const shapedWords = (phrase: string) => norm(prepareArabicText(phrase)).split(" ").filter(Boolean);

/**
 * Retrouve la ligne dessinée correspondant à `phrase` : pdf.js découpe les
 * segments par changement de police (arabe vs latin), on regroupe donc les
 * items d'une même ligne (page + y) puis on prend celui dont l'étendue x est
 * maximale. Retourne { minX, maxX } bornes exactes de la phrase complète.
 */
function spanOf(items: Item[], phrase: string): { minX: number; maxX: number; y: number; page: number } | null {
  const words = shapedWords(phrase);
  if (words.length === 0) return null;
  const hit = (str: string) => words.some((w) => norm(str).includes(w));
  const candidates = items.filter((it) => it.str.trim() !== "" && hit(it.str));
  if (candidates.length === 0) return null;

  const buckets = new Map<string, Item[]>();
  for (const it of candidates) {
    const key = `${it.page}|${Math.round(it.y / 3)}`;
    const b = buckets.get(key) ?? [];
    b.push(it);
    buckets.set(key, b);
  }
  const qualifying: Item[][] = [];
  for (const b of buckets.values()) {
    const joined = b.map((i) => norm(i.str)).join(" ");
    if (words.every((w) => joined.includes(w))) qualifying.push(b);
  }
  if (qualifying.length === 0) return null;
  let best: { minX: number; maxX: number; y: number; page: number } | null = null;
  for (const b of qualifying) {
    const minX = Math.min(...b.map((i) => i.x));
    const maxX = Math.max(...b.map((i) => i.x + i.width));
    const span = maxX - minX;
    if (!best || span > best.maxX - best.minX) {
      best = { minX, maxX, y: b[0].y, page: b[0].page };
    }
  }
  return best;
}

async function main() {
  const { render } = await import("./print-smoke");

  const ar = mockDoc(3, "A4");
  ar.company.name = "Alpha Impression";
  ar.company.nameAr = "مؤسسة ألفا للطباعة";
  ar.party = { ...ar.party, name: "مؤسسة محمد حداد للتجارة", address: "حي الصناعي", commune: "وهران" } as PrintParty;
  ar.document.notes = "ملاحظات عربية pour le rendu";
  const arLabels = buildLabels("ar", ar.document.docType, ar);

  const fr = mockDoc(3, "A4");
  fr.company.name = "Alpha Impression";
  fr.party = { ...fr.party, name: "ETB MOHAMED HADDAD" } as PrintParty;

  const arPdf = (await render(ar, "ar")).pdf;
  const frPdf = (await render(fr, "fr")).pdf;
  const arItems = await extractItems(arPdf);
  const frItems = await extractItems(frPdf);

  if (process.env.DEBUG) {
    console.log("\n-- AR items (page | x | width | y | str) --");
    for (const it of arItems) {
      if (it.str.trim() === "") continue;
      console.log(`${it.page} | x=${it.x.toFixed(0)} w=${it.width.toFixed(0)} y=${it.y.toFixed(0)} | ${JSON.stringify(it.str)}`);
    }
    process.exit(0);
  }

  const results: Array<{ ok: boolean; label: string; detail: string }> = [];
  const record = (ok: boolean, label: string, detail = "") => {
    results.push({ ok, label, detail });
    console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  console.log("\n== RTL / LTR : ancrages ==");

  // 1. Aucun texte hors page (n'importe quel curseur dépassant la page).
  for (const [name, items] of [
    ["AR", arItems],
    ["FR", frItems],
  ] as const) {
    const off = items.filter((it) => it.str.trim() !== "" && (it.x < 0 || it.x + it.width > 595.28 + 2));
    record(off.length === 0, `${name} : aucun texte hors page`, off.length > 0 ? `${off.length} item(s)` : "");
  }

  // 2. Bandeau : nom société ancré à droite en AR, à gauche en FR.
  const arBanner = spanOf(arItems, ar.company.nameAr);
  const frBanner = spanOf(frItems, fr.company.name);
  const contentLeft = 34; // 12 mm
  const contentRight = 595.28 - 34;
  record(
    !!arBanner && arBanner.maxX >= contentRight - 40 && arBanner.maxX <= contentRight - 4,
    "bandeau AR : nom société ancré à droite du bandeau",
    arBanner ? `${Math.round(arBanner.minX)} → ${Math.round(arBanner.maxX)}` : "introuvable",
  );
  record(
    !!frBanner && frBanner.minX <= contentLeft + 40,
    "bandeau FR : nom société ancré à gauche (LTR inchangé)",
    frBanner ? `x=${Math.round(frBanner.minX)}` : "introuvable",
  );

  // 3. Contrepartie (client) : carte à gauche en AR (miroir), à droite en FR.
  const arClient = spanOf(arItems, "للتجارة") ?? spanOf(arItems, "HADDAD");
  const frClient = spanOf(frItems, "HADDAD") ?? spanOf(frItems, "للتجارة");
  const cardW = (595.28 - 34 * 2 - 8) / 2; // contentWidth - gap / 2 ≈ 259
  record(
    !!arClient && arClient.minX <= contentLeft + cardW + 20,
    "carte client AR : à gauche (miroir, pas de chevauchement émetteur)",
    arClient ? `x=${Math.round(arClient.minX)}` : "introuvable",
  );
  record(
    !!frClient && frClient.minX >= contentRight - cardW - 20,
    "carte client FR : à droite (LTR inchangé)",
    frClient ? `x=${Math.round(frClient.minX)}` : "introuvable",
  );

  // 4. "Émetteur" à droite en AR, et aucune superposition émetteur/client.
  const arIssuer = spanOf(arItems, arLabels.issuer);
  record(
    !!arIssuer && arIssuer.minX >= contentRight - cardW - 20,
    "titre carte émetteur AR : à droite (miroir)",
    arIssuer ? `x=${Math.round(arIssuer.minX)}` : "introuvable",
  );
  if (arIssuer && arClient) {
    record(arIssuer.minX > arClient.maxX, "cartes AR sans chevauchement (émetteur à droite du client)", `issuer ${Math.round(arIssuer.minX)} > client ${Math.round(arClient.maxX)}`);
  }

  // 5. Totaux : le libellé du Total TTC est aligné à droite dans la zone droite en AR.
  const arTotal = spanOf(arItems, arLabels.totalTtc);
  record(
    !!arTotal && arTotal.maxX <= contentRight + 3 && arTotal.minX >= contentRight - 200,
    "totaux AR : Total TTC bord droit propre (rien ne dépasse)",
    arTotal ? `x=${Math.round(arTotal.minX)} → ${Math.round(arTotal.maxX)}` : "introuvable",
  );

  const okCount = results.filter((r) => r.ok).length;
  console.log(`\nAncrages : ${okCount}/${results.length} vérifiés`);
  process.exit(okCount === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});