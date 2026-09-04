#!/usr/bin/env npx tsx
/**
 * DRY RUN — Company Settings Migration Analysis
 *
 * This script is READ-ONLY. It does NOT modify any data.
 * It reads the current state of the Setting table and Company model,
 * analyzes conflicts, and produces a migration report.
 *
 * Run: npx tsx scripts/dry-run-migration.ts
 */

import "dotenv/config";
import { prismaBase as prisma } from "../src/lib/prisma";
import type { SettingType } from "../src/generated/prisma/enums";

// ---------------------------------------------------------------------------
// COMPANY_KEY_MAP — mapping of legacy Setting keys to Company model columns
// (previously in api/settings/keys-shared.ts, now deleted)
// ---------------------------------------------------------------------------

const COMPANY_KEY_MAP: Record<string, string> = {
  "company.name": "name",
  "company.nameAr": "nameAr",
  "company.legalName": "legalName",
  "company.legalForm": "legalForm",
  "company.capital": "capital",
  "company.activity": "activity",
  "company.secondaryActivity": "secondaryActivity",
  "company.establishedAt": "establishedAt",
  "company.taxId": "taxId",
  "company.rc": "rc",
  "company.nis": "nis",
  "company.ai": "ai",
  "company.vatNumber": "vatNumber",
  "company.country": "country",
  "company.wilaya": "wilaya",
  "company.commune": "commune",
  "company.postalCode": "postalCode",
  "company.address": "address",
  "company.phone": "phone",
  "company.mobile": "mobile",
  "company.email": "email",
  "company.website": "website",
  "company.bank": "bank",
  "company.bankAgency": "bankAgency",
  "company.bankAccount": "bankAccount",
  "company.rib": "rib",
  "company.iban": "iban",
  "company.swift": "swift",
  "company.logoKey": "logoKey",
  "company.stampKey": "stampKey",
  "company.signatureKey": "signatureKey",
  "company.primaryColor": "primaryColor",
  "company.printHeader": "printHeader",
  "company.invoiceFooter": "invoiceFooter",
  "company.printFormat": "printFormat",
  "company.currency": "currency",
};

const PREFERENCE_KEYS: Record<string, string> = {
  "fiscal.year": "fiscalYear",
  "locale.default": "_locale",
  "theme.default": "_theme",
  "notifications.email": "_notifications",
  "print.defaultFormat": "_deprecatedPrintFormat",
  "documents.qr.enabled": "_deprecatedQrEnabled",
  "onboarding.dismissed": "_onboarding",
  "tax.rates": "_taxRates",
  "currency.list": "_currencyList",
  "units.list": "_unitsList",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSettingValue(value: string, type: SettingType): unknown {
  switch (type) {
    case "BOOLEAN": return value === "true";
    case "NUMBER": { const n = Number(value); return isNaN(n) ? value : n; }
    case "JSON": try { return JSON.parse(value); } catch { return value; }
    case "SECRET":
    case "STRING":
    default: return value;
  }
}

function companyValueToString(value: unknown): string {
  if (value === null || value === undefined) return "(empty)";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

type ConflictStatus =
  | "SAFE_MIGRATE"
  | "ALREADY_SYNCED"
  | "COMPANY_HAS_VALUE"
  | "CONFLICT"
  | "NO_COMPANY"
  | "TYPE_ERROR"
  | "NOT_IN_COMPANY";

interface MigrationRow {
  settingKey: string;
  settingValue: string;
  settingRawValue: string;
  companyField: string;
  companyId: string;
  companyName: string;
  companyFieldValue: string;
  status: ConflictStatus;
  action: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== DRY RUN: Company Settings Migration Analysis ===\n");

  // 1. Read all company.* Setting values
  const settingKeys = Object.keys(COMPANY_KEY_MAP);
  const settings = await prisma.setting.findMany({
    where: { key: { in: settingKeys } },
  });

  console.log(`Found ${settings.length} company.* settings in Setting table:\n`);
  for (const s of settings) {
    console.log(`  ${s.key} = "${s.value}" (type: ${s.type})`);
  }

  // 2. Read all preference keys
  const prefKeys = Object.keys(PREFERENCE_KEYS);
  const prefs = await prisma.setting.findMany({
    where: { key: { in: prefKeys } },
  });

  console.log(`\nFound ${prefs.length} preference settings:\n`);
  for (const p of prefs) {
    console.log(`  ${p.key} = "${p.value}" (type: ${p.type})`);
  }

  // 3. Read all non-deleted Companies
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nFound ${companies.length} active companies:\n`);
  for (const c of companies) {
    console.log(`  [${c.id}] ${c.name} (code: ${c.code})`);
  }

  // 4. Analyze each company.* Setting
  const rows: MigrationRow[] = [];
  const stats = {
    total: 0,
    safeMigrate: 0,
    alreadySynced: 0,
    companyHasValue: 0,
    conflicts: 0,
    noCompany: 0,
    typeErrors: 0,
  };

  for (const setting of settings) {
    const companyField = COMPANY_KEY_MAP[setting.key];
    if (!companyField) continue;

    const settingValue = parseSettingValue(setting.value, setting.type);
    const settingDisplay =
      typeof settingValue === "object"
        ? JSON.stringify(settingValue)
        : String(settingValue);

    stats.total++;

    if (companies.length === 0) {
      rows.push({
        settingKey: setting.key,
        settingValue: settingDisplay,
        settingRawValue: setting.value,
        companyField,
        companyId: "(none)",
        companyName: "(no companies)",
        companyFieldValue: "(n/a)",
        status: "NO_COMPANY",
        action: "BLOCK",
        reason: "No active companies. Setting value has no target.",
      });
      stats.noCompany++;
      continue;
    }

    // Check type validity for special fields
    if (companyField === "establishedAt" && settingValue !== "") {
      const d = new Date(String(settingValue));
      if (isNaN(d.getTime())) {
        for (const company of companies) {
          rows.push({
            settingKey: setting.key,
            settingValue: settingDisplay,
            settingRawValue: setting.value,
            companyField,
            companyId: company.id,
            companyName: company.name,
            companyFieldValue: companyValueToString(company[companyField as keyof typeof company]),
            status: "TYPE_ERROR",
            action: "BLOCK",
            reason: `Invalid DateTime in Setting: "${settingValue}"`,
          });
        }
        stats.typeErrors++;
        continue;
      }
    }

    if (companyField === "capital" && settingValue !== "") {
      if (isNaN(Number(settingValue))) {
        for (const company of companies) {
          rows.push({
            settingKey: setting.key,
            settingValue: settingDisplay,
            settingRawValue: setting.value,
            companyField,
            companyId: company.id,
            companyName: company.name,
            companyFieldValue: companyValueToString(company[companyField as keyof typeof company]),
            status: "TYPE_ERROR",
            action: "BLOCK",
            reason: `Invalid Decimal in Setting: "${settingValue}"`,
          });
        }
        stats.typeErrors++;
        continue;
      }
    }

    // Per-company analysis
    for (const company of companies) {
      const companyValue = company[companyField as keyof typeof company];
      const companyDisplay = companyValueToString(companyValue);

      // Normalize for comparison
      const settingStr = String(settingValue ?? "");
      const companyStr =
        companyValue === null || companyValue === undefined
          ? ""
          : String(companyValue);

      let status: ConflictStatus;
      let action: string;
      let reason: string;

      if (settingStr === companyStr || (settingStr === "" && companyStr === "")) {
        status = "ALREADY_SYNCED";
        action = "SKIP";
        reason = "Values match. No migration needed.";
        stats.alreadySynced++;
      } else if (companyStr === "" || companyValue === null || companyValue === undefined) {
        status = "SAFE_MIGRATE";
        action = "MIGRATE";
        reason = "Company field empty. Setting value will be migrated.";
        stats.safeMigrate++;
      } else if (settingStr === "" && companyStr !== "") {
        status = "COMPANY_HAS_VALUE";
        action = "SKIP";
        reason = "Setting empty, Company has value. Company preserved.";
        stats.alreadySynced++;
      } else {
        status = "CONFLICT";
        action = "BLOCK";
        reason = `CONFLICT: Company="${companyStr}" ≠ Setting="${settingStr}". Manual resolution required.`;
        stats.conflicts++;
      }

      rows.push({
        settingKey: setting.key,
        settingValue: settingDisplay,
        settingRawValue: setting.value,
        companyField,
        companyId: company.id,
        companyName: company.name,
        companyFieldValue: companyDisplay,
        status,
        action,
        reason,
      });
    }
  }

  // 5. Check preference keys
  const prefAnalysis: Array<{
    key: string;
    value: string;
    classification: string;
    action: string;
    reason: string;
  }> = [];

  for (const pref of prefs) {
    const target = PREFERENCE_KEYS[pref.key];
    if (!target) continue;

    let classification: string;
    let action: string;
    let reason: string;

    if (pref.key === "fiscal.year") {
      classification = "COMPANY_CONFIG";
      action = "MIGRATE_TO_COMPANY";
      reason = "fiscalYear already exists on Company model. Migrate Setting → Company.";
    } else if (pref.key === "print.defaultFormat") {
      classification = "DEPRECATED";
      action = "DEPRECATE";
      reason = "Duplicate of Company.printFormat. Remove from Setting.";
    } else if (pref.key === "documents.qr.enabled") {
      classification = "DEPRECATED";
      action = "DEPRECATE";
      reason = "Duplicate of Company.qrEnabled. Remove from Setting.";
    } else {
      classification = "APP_PREFERENCE";
      action = "KEEP";
      reason = "App-wide preference. Stays in Setting table.";
    }

    prefAnalysis.push({
      key: pref.key,
      value: pref.value,
      classification,
      action,
      reason,
    });
  }

  // 6. Print report
  console.log("\n" + "=".repeat(80));
  console.log("MIGRATION ANALYSIS REPORT");
  console.log("=".repeat(80));

  console.log(`\nTotal legacy company.* keys: ${stats.total}`);
  console.log(`  SAFE_MIGRATE:    ${stats.safeMigrate}`);
  console.log(`  ALREADY_SYNCED:  ${stats.alreadySynced}`);
  console.log(`  CONFLICTS:       ${stats.conflicts}`);
  console.log(`  TYPE_ERRORS:     ${stats.typeErrors}`);
  console.log(`  NO_COMPANY:      ${stats.noCompany}`);

  console.log("\n--- Detailed Analysis ---\n");
  console.log(
    "Setting Key".padEnd(30) +
    "Company Field".padEnd(20) +
    "Company".padEnd(20) +
    "Status".padEnd(18) +
    "Action".padEnd(15) +
    "Reason"
  );
  console.log("-".repeat(140));

  for (const row of rows) {
    console.log(
      row.settingKey.padEnd(30) +
      row.companyField.padEnd(20) +
      row.companyName.substring(0, 18).padEnd(20) +
      row.status.padEnd(18) +
      row.action.padEnd(15) +
      row.reason
    );
  }

  if (prefAnalysis.length > 0) {
    console.log("\n--- Preference Keys ---\n");
    console.log(
      "Key".padEnd(30) +
      "Classification".padEnd(20) +
      "Action".padEnd(20) +
      "Reason"
    );
    console.log("-".repeat(100));
    for (const p of prefAnalysis) {
      console.log(
        p.key.padEnd(30) +
        p.classification.padEnd(20) +
        p.action.padEnd(20) +
        p.reason
      );
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  if (stats.conflicts > 0) {
    console.log(`\n⚠ MIGRATION BLOCKER: ${stats.conflicts} conflict(s) detected.`);
    console.log("  Manual resolution required before safe migration.");
  }
  if (stats.typeErrors > 0) {
    console.log(`\n⚠ MIGRATION BLOCKER: ${stats.typeErrors} type error(s) detected.`);
    console.log("  Invalid values in Setting that cannot be converted.");
  }
  if (stats.noCompany > 0) {
    console.log(`\n⚠ MIGRATION BLOCKER: ${stats.noCompany} setting(s) have no target company.`);
  }
  if (stats.conflicts === 0 && stats.typeErrors === 0 && stats.noCompany === 0) {
    console.log("\n✓ No blockers detected. Migration is safe to proceed.");
    console.log(`  ${stats.safeMigrate} field(s) will be migrated.`);
    console.log(`  ${stats.alreadySynced} field(s) already in sync.`);
  }

  console.log("\n⚠ This is a dry run. No data was modified.\n");
}

main()
  .catch(console.error);
