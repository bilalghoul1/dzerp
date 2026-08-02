import { prisma } from "@/lib/prisma";
import type { SettingType } from "@/generated/prisma/enums";

export type SettingValue = string | number | boolean | object;

function parseValue(value: string, type: SettingType): SettingValue {
  switch (type) {
    case "BOOLEAN":
      return value === "true";
    case "NUMBER": {
      const n = Number(value);
      return Number.isNaN(n) ? value : n;
    }
    case "JSON":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    case "SECRET":
    case "STRING":
    default:
      return value;
  }
}

function stringifyValue(value: SettingValue): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

export async function getSetting(key: string): Promise<SettingValue | undefined> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  if (!setting) return undefined;
  return parseValue(setting.value, setting.type);
}

export async function getPublicSettings(): Promise<Record<string, SettingValue>> {
  const settings = await prisma.setting.findMany({
    where: { isPublic: true },
  });
  return Object.fromEntries(
    settings.map((s) => [s.key, parseValue(s.value, s.type)]),
  );
}

export async function setSetting(input: {
  key: string;
  value: SettingValue;
  type?: SettingType;
  description?: string | null;
  isPublic?: boolean;
  updatedById?: string | null;
}): Promise<void> {
  await prisma.setting.upsert({
    where: { key: input.key },
    update: {
      value: stringifyValue(input.value),
      type: input.type,
      description: input.description,
      isPublic: input.isPublic,
      updatedById: input.updatedById ?? null,
    },
    create: {
      key: input.key,
      value: stringifyValue(input.value),
      type: input.type ?? "STRING",
      description: input.description ?? null,
      isPublic: input.isPublic ?? false,
      updatedById: input.updatedById ?? null,
    },
  });
}

export async function listSettings(): Promise<
  {
    key: string;
    value: SettingValue;
    type: SettingType;
    description: string | null;
    isPublic: boolean;
    updatedAt: Date;
  }[]
> {
  const settings = await prisma.setting.findMany({
    orderBy: { key: "asc" },
  });
  return settings.map((s) => ({
    key: s.key,
    value: parseValue(s.value, s.type),
    type: s.type,
    description: s.description,
    isPublic: s.isPublic,
    updatedAt: s.updatedAt,
  }));
}
