#!/usr/bin/env npx tsx
/**
 * Company Settings Migration Script
 *
 * Migrates company.* identity data from the global Setting table to the
 * per-company Company model. After migration, Company is the sole source
 * of truth for company identity.
 *
 * SAFETY:
 * - Always starts with a dry run (read-only analysis).
 * - Requires explicit --execute flag to modify data.
 * - Idempotent: safe to run multiple times.
 * - Transactional: Company update + AuditLog in same transaction.
 * - Validates all type conversions before writing.
 * - Never overwrites non-empty Company fields.
 *
 * Usage:
 *   npx tsx scripts/migrate-company-settings.ts              # dry run
 *   npx tsx scripts/migrate-company-settings.ts --execute    # execute migration
 *   npx tsx scripts/migrate-company-settings.ts --verify     # verify migration
 */

import "dotenv/config";
import { prismaBase as prisma } from "../src/lib/prisma";
import type { SettingType } from "../src/generated/prisma/enums";
import { Prisma } from "../src/generated/prisma/client";

const MIGRATION_VERSION = "2026-09-04-v1";

// ---------------------------------------------------------------------------
// COMPANY_KEY_MAP
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

function normalizeForDb(key: string, value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;

  switch (key) {
    case "capital": {
      const s = String(value).trim();
      if (s === "" || isNaN(Number(s))) return null;
      return s;
    }
    case "establishedAt": {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return null;
      return d;
    }
    case "fiscalYear": {
      const n = Number(value);
      if (isNaN(n) || n < 2000 || n > 2100) return null;
      return Math.round(n);
    }
    case "qrEnabled": return Boolean(value);
    default: return String(value).trim() || null;
  }
}

type MigrationAction = "MIGRATE" | "SKIP" | "BLOCK" | "CONFLICT";

interface MigrationPlanItem {
  settingKey: string;
  companyField: string;
  settingValue: unknown;
  normalizedValue: unknown;
  companyId: string;
  companyName: string;
  companyCurrentValue: unknown;
  action: MigrationAction;
  reason: string;
}

// ---------------------------------------------------------------------------
// Dry Run Analysis
// ---------------------------------------------------------------------------

async function analyzeDryRun(): Promise<MigrationPlanItem[]> {
  const settingKeys = Object.keys(COMPANY_KEY_MAP);
  const settings = await prisma.setting.findMany({
    where: { key: { in: settingKeys } },
  });

  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const plan: MigrationPlanItem[] = [];

  for (const setting of settings) {
    const companyField = COMPANY_KEY_MAP[setting.key];
    if (!companyField) continue;

    const rawValue = parseSettingValue(setting.value, setting.type);

    if (companies.length === 0) {
      plan.push({
        settingKey: setting.key,
        companyField,
        settingValue: rawValue,
        normalizedValue: null,
        companyId: "(none)",
        companyName: "(no companies)",
        companyCurrentValue: null,
        action: "BLOCK",
        reason: "No active companies. Cannot migrate.",
      });
      continue;
    }

    for (const company of companies) {
      const companyValue = company[companyField as keyof typeof company];
      const normalized = normalizeForDb(companyField, rawValue);

      // Compare
      const settingStr = normalized === null ? "" : String(normalized);
      const companyStr = companyValue === null || companyValue === undefined
        ? ""
        : String(companyValue);

      let action: MigrationAction;
      let reason: string;

      if (settingStr === companyStr || (settingStr === "" && companyStr === "")) {
        action = "SKIP";
        reason = "Already in sync.";
      } else if (companyStr === "" || companyValue === null || companyValue === undefined) {
        // Check if normalized value is valid
        if (normalized === null && rawValue !== "" && rawValue !== null) {
          action = "BLOCK";
          reason = `Invalid value in Setting: "${rawValue}" cannot be converted to ${companyField}.`;
        } else {
          action = "MIGRATE";
          reason = "Company field empty. Setting value will be migrated.";
        }
      } else if (settingStr === "" && companyStr !== "") {
        action = "SKIP";
        reason = "Setting empty. Company value preserved.";
      } else {
        action = "CONFLICT";
        reason = `CONFLICT: Company="${companyStr}" ≠ Setting="${settingStr}". Manual resolution required.`;
      }

      plan.push({
        settingKey: setting.key,
        companyField,
        settingValue: rawValue,
        normalizedValue: normalized,
        companyId: company.id,
        companyName: company.name,
        companyCurrentValue: companyValue,
        action,
        reason,
      });
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Execute Migration
// ---------------------------------------------------------------------------

async function executeMigration(plan: MigrationPlanItem[]): Promise<{
  migrated: number;
  skipped: number;
  blocked: number;
  conflicted: number;
}> {
  const stats = { migrated: 0, skipped: 0, blocked: 0, conflicted: 0 };

  const migrateable = plan.filter((p) => p.action === "MIGRATE");
  const blocked = plan.filter((p) => p.action === "BLOCK");
  const conflicted = plan.filter((p) => p.action === "CONFLICT");

  if (blocked.length > 0) {
    console.error(`\n✗ BLOCKED: ${blocked.length} item(s) have type errors or no target.`);
    for (const b of blocked) {
      console.error(`  ${b.settingKey} → ${b.companyName}: ${b.reason}`);
    }
    stats.blocked = blocked.length;
    return stats;
  }

  if (conflicted.length > 0) {
    console.error(`\n✗ BLOCKED: ${conflicted.length} conflict(s) require manual resolution.`);
    for (const c of conflicted) {
      console.error(`  ${c.settingKey} → ${c.companyName}: ${c.reason}`);
    }
    stats.conflicted = conflicted.length;
    return stats;
  }

  if (migrateable.length === 0) {
    console.log("\n✓ Nothing to migrate. All values are in sync.");
    return stats;
  }

  console.log(`\nMigrating ${migrateable.length} field(s)...\n`);

  // Group by company for transactional updates
  const byCompany = new Map<string, MigrationPlanItem[]>();
  for (const item of migrateable) {
    const existing = byCompany.get(item.companyId) || [];
    existing.push(item);
    byCompany.set(item.companyId, existing);
  }

  for (const [companyId, items] of byCompany) {
    const data: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const item of items) {
      data[item.companyField] = item.normalizedValue;
      changes[item.companyField] = {
        from: item.companyCurrentValue ?? null,
        to: item.normalizedValue,
      };
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: companyId },
          data: { ...data, updatedById: null }, // SYSTEM migration
        });

        await tx.auditLog.create({
          data: {
            action: "UPDATE",
            entity: "Company",
            entityId: companyId,
            actorId: null, // SYSTEM
            companyId,
            changes: changes as unknown as Prisma.InputJsonValue,
          },
        });
      });

      console.log(`  ✓ ${items[0].companyName}: ${items.length} field(s) migrated`);
      stats.migrated += items.length;
    } catch (error) {
      console.error(`  ✗ ${items[0].companyName}: Transaction failed — ${error}`);
      stats.blocked += items.length;
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Verify Migration
// ---------------------------------------------------------------------------

async function verifyMigration(plan: MigrationPlanItem[]): Promise<boolean> {
  console.log("\n=== Verification ===\n");

  let allGood = true;

  for (const item of plan) {
    if (item.action !== "MIGRATE" && item.action !== "SKIP") continue;

    const company = await prisma.company.findUnique({ where: { id: item.companyId } });
    if (!company) {
      console.error(`  ✗ Company ${item.companyId} not found`);
      allGood = false;
      continue;
    }

    const actual = company[item.companyField as keyof typeof company];
    const expected = item.normalizedValue;

    const actualStr = actual === null || actual === undefined ? "" : String(actual);
    const expectedStr = expected === null || expected === undefined ? "" : String(expected);

    if (actualStr !== expectedStr) {
      console.error(
        `  ✗ ${item.companyName}.${item.companyField}: expected "${expectedStr}", got "${actualStr}"`,
      );
      allGood = false;
    }
  }

  if (allGood) {
    console.log("  ✓ All migrated values verified.");
  } else {
    console.error("\n  ✗ Verification failed!");
  }

  return allGood;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const isVerify = args.includes("--verify");

  console.log(`Company Settings Migration ${MIGRATION_VERSION}`);
  console.log(`Mode: ${isExecute ? "EXECUTE" : isVerify ? "VERIFY" : "DRY RUN"}`);
  console.log("=".repeat(60));

  const plan = await analyzeDryRun();

  // Print plan
  console.log("\n--- Migration Plan ---\n");
  for (const item of plan) {
    const marker =
      item.action === "MIGRATE" ? "→ MIGRATE" :
      item.action === "SKIP" ? "  skip" :
      item.action === "CONFLICT" ? "! CONFLICT" :
      "✗ BLOCK";
    console.log(
      `  ${marker}  ${item.settingKey} → ${item.companyName}.${item.companyField}` +
      `  (${item.reason})`,
    );
  }

  const stats = {
    migrate: plan.filter((p) => p.action === "MIGRATE").length,
    skip: plan.filter((p) => p.action === "SKIP").length,
    conflict: plan.filter((p) => p.action === "CONFLICT").length,
    block: plan.filter((p) => p.action === "BLOCK").length,
  };

  console.log(`\n--- Summary ---`);
  console.log(`  Migrate:    ${stats.migrate}`);
  console.log(`  Skip:       ${stats.skip}`);
  console.log(`  Conflicts:  ${stats.conflict}`);
  console.log(`  Blocked:    ${stats.block}`);

  if (!isExecute && !isVerify) {
    console.log("\n⚠ This is a DRY RUN. No data was modified.");
    console.log("  Run with --execute to perform the migration.\n");
    // prismaBase is a shared singleton — no $disconnect needed
    return;
  }

  if (isVerify) {
    const ok = await verifyMigration(plan);
    process.exit(ok ? 0 : 1);
  }

  if (isExecute) {
    if (stats.conflict > 0 || stats.block > 0) {
      console.error("\n✗ Cannot execute: conflicts or blocks detected.");
      console.error("  Resolve them first, then re-run.\n");
      // prismaBase is a shared singleton — no $disconnect needed
      process.exit(1);
    }

    const result = await executeMigration(plan);
    console.log(`\n--- Execution Result ---`);
    console.log(`  Migrated:  ${result.migrated}`);
    console.log(`  Skipped:   ${result.skipped}`);
    console.log(`  Blocked:   ${result.blocked}`);
    console.log(`  Conflicts: ${result.conflicted}`);

    if (result.blocked === 0 && result.conflicted === 0) {
      console.log("\n✓ Migration completed successfully.");
      console.log("  Run with --verify to confirm.\n");
    } else {
      console.error("\n✗ Migration incomplete. See errors above.\n");
    }
  }

  // prismaBase is a shared singleton — no $disconnect needed
}

main().catch(async (error) => {
  console.error("Migration failed:", error);
  // prismaBase is a shared singleton — no $disconnect needed
  process.exit(1);
});
