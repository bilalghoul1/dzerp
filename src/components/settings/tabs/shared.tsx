"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { CompanyProfile } from "@/features/settings/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TabProps = {
  profile: CompanyProfile;
  onUpdate: (patch: Partial<CompanyProfile>) => void;
  onSave: (fields: Partial<CompanyProfile>) => Promise<void>;
  busy: boolean;
};

export function TabSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {children}
      </CardContent>
    </Card>
  );
}

export function Field({
  label,
  span,
  required,
  children,
}: {
  label: string;
  span?: number;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span === 2 ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  span,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  span?: number;
  type?: string;
}) {
  return (
    <Field label={label} required={required} span={span}>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  required,
  span,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  span?: number;
}) {
  return (
    <Field label={label} required={required} span={span}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {options.find((o) => o.value === value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function SaveBar({
  busy,
  onSave,
  label,
}: {
  busy: boolean;
  onSave: () => void;
  label?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex justify-end pt-2">
      <Button onClick={onSave} disabled={busy} size="sm">
        {busy ? t("common.saving") : (label ?? t("common.save"))}
      </Button>
    </div>
  );
}

export function MoreDetails({
  children,
  labelKey = "parametres.moreDetails",
}: {
  children: React.ReactNode;
  labelKey?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="sm:col-span-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        aria-expanded={open}
      >
        <span
          className={cn(
            "material-symbols-outlined text-[18px] transition-transform",
            open && "rotate-180",
          )}
        >
          expand_more
        </span>
        {open ? t("parametres.lessDetails") : t(labelKey as never)}
      </button>
      {open && <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>}
    </div>
  );
}
