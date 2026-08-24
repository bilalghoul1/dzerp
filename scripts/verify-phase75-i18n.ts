/* Vérification de parité i18n (FR/AR/EN) des clés `admin.*` utilisées par les
 * pages et composants de la Phase 7.5. */
import { readFileSync } from "node:fs";
import { dictionaries } from "../src/i18n/dictionaries";

function deepGet(dict: unknown, parts: string[]): unknown {
  let acc: unknown = dict;
  for (const part of parts) {
    if (acc === null || acc === undefined) return undefined;
    acc = (acc as Record<string, unknown>)[part];
  }
  return acc;
}

const PHASE_FILES = [
  "src/app/(app)/admin/settings/page.tsx",
  "src/app/(app)/admin/maintenance/page.tsx",
  "src/app/(app)/admin/backups/page.tsx",
  "src/app/(app)/admin/security/page.tsx",
  "src/app/(app)/admin/analytics/page.tsx",
  "src/components/admin/platform-settings-table.tsx",
];

const keys = new Set<string>();
for (const file of PHASE_FILES) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/t\(["'`]([\w.]+)["'`]/g)) {
    keys.add(m[1]);
  }
  for (const m of src.matchAll(/t\((`[^`]*\$\{[^}]*\}[^`]*`|"[^"]+")/g)) {
    // ignore dynamic templates
    void m;
  }
}

let failed = 0;
for (const key of [...keys].sort()) {
  const parts = key.split(".");
  const row = ["fr", "ar", "en"].map(
    (locale) => `${locale}:${deepGet(dictionaries[locale as keyof typeof dictionaries], parts) !== undefined ? "ok" : "MISSING"}`,
  );
  const missing = row.filter((r) => r.endsWith("MISSING"));
  if (missing.length > 0) failed++;
  console.log(`${missing.length === 0 ? "PASS" : "FAIL"}  ${key}  [${row.join(", ")}]`);
}
console.log(`\n${keys.size - failed}/${keys.size} keys present in all locales`);
if (failed > 0) process.exitCode = 1;
