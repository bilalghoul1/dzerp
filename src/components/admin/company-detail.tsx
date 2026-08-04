"use client";

import Link from "next/link";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/empty-state";
import type {
  CompanyAdminDetail,
  CompanyMemberView,
  CompanyStatistics,
} from "@/features/company-admin/types";
import type {
  CompanyAuditEntry,
  CompanyActivityEntry,
} from "@/features/company-admin/service";

function statusBadgeVariant(status: CompanyAdminDetail["status"]):
  | "success"
  | "secondary"
  | "warning"
  | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "warning";
    case "ARCHIVED":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

type DetailProps = {
  company: CompanyAdminDetail;
  members: CompanyMemberView[];
  branches: {
    id: string;
    code: string;
    name: string;
    nameAr: string | null;
    type: string;
    city: string | null;
    phone: string | null;
    email: string | null;
    manager: string | null;
    isActive: boolean;
    isDefault: boolean;
  }[];
  series: {
    id: string;
    docType: string;
    prefix: string;
    separator: string;
    suffix: string;
    withYear: boolean;
    padLength: number;
    step: number;
    nextValue: number;
    isActive: boolean;
  }[];
  statistics: CompanyStatistics;
  audit: CompanyAuditEntry[];
  activity: CompanyActivityEntry[];
};

export function CompanyDetail({
  company,
  members,
  branches,
  series,
  statistics,
  audit,
  activity,
}: DetailProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{company.code}</p>
            <h2 className="text-xl font-semibold">{company.name}</h2>
            {company.commercialName && company.commercialName !== company.name ? (
              <p className="text-sm text-muted-foreground">{company.commercialName}</p>
            ) : null}
          </div>
          <Badge variant={statusBadgeVariant(company.status)}>
            {t(`admin.status_${company.status}` as "admin.status_ACTIVE")}
          </Badge>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/companies">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              arrow_back
            </span>
            {t("common.back")}
          </Link>
        </Button>
      </div>

      {company.status === "ARCHIVED" ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          {t("admin.readOnly")}
        </div>
      ) : null}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="general">{t("admin.tabGeneral")}</TabsTrigger>
          <TabsTrigger value="legal">{t("admin.tabLegal")}</TabsTrigger>
          <TabsTrigger value="address">{t("admin.tabAddress")}</TabsTrigger>
          <TabsTrigger value="banking">{t("admin.tabBanking")}</TabsTrigger>
          <TabsTrigger value="branding">{t("admin.tabBranding")}</TabsTrigger>
          <TabsTrigger value="printing">{t("admin.tabPrinting")}</TabsTrigger>
          <TabsTrigger value="numbering">{t("admin.tabNumbering")}</TabsTrigger>
          <TabsTrigger value="branches">{t("admin.tabBranches")}</TabsTrigger>
          <TabsTrigger value="users">{t("admin.tabUsers")}</TabsTrigger>
          <TabsTrigger value="audit">{t("admin.tabAudit")}</TabsTrigger>
          <TabsTrigger value="activity">{t("admin.tabActivity")}</TabsTrigger>
          <TabsTrigger value="statistics">{t("admin.tabStatistics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabGeneral")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label={t("admin.colCode")} value={company.code} />
                <InfoRow label={t("parametres.companyName")} value={company.name} />
                <InfoRow label={t("parties.nameAr")} value={company.nameAr ?? "—"} />
                <InfoRow
                  label={t("admin.colLegalName")}
                  value={company.legalName ?? "—"}
                />
                <InfoRow
                  label={t("parametres.legalForm")}
                  value={company.legalForm ?? "—"}
                />
                <InfoRow label={t("common.type")} value={company.type ?? "—"} />
                <InfoRow label={t("parametres.activity")} value={company.activity ?? "—"} />
                <InfoRow
                  label={t("admin.secondaryActivity")}
                  value={company.secondaryActivity ?? "—"}
                />
                <InfoRow label={t("admin.capital")} value={company.capital ?? "—"} />
                <InfoRow
                  label={t("admin.establishedAt")}
                  value={formatDate(company.establishedAt)}
                />
                <InfoRow
                  label={t("admin.expiryDate")}
                  value={formatDate(company.expiryDate)}
                />
                <InfoRow
                  label={t("parametres.defaultCurrency")}
                  value={company.currency}
                />
                <InfoRow
                  label={t("parametres.fiscalYear")}
                  value={company.fiscalYear?.toString() ?? "—"}
                />
                <InfoRow label={t("admin.language")} value={company.language} />
                <InfoRow
                  label={t("admin.defaultBranch")}
                  value={company.defaultBranch
                    ? `${company.defaultBranch.code} · ${company.defaultBranch.name}`
                    : t("admin.noDefaultBranch")}
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabLegal")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label={t("parties.taxId")} value={company.taxId ?? "—"} />
                <InfoRow label={t("parties.rc")} value={company.rc ?? "—"} />
                <InfoRow label={t("parties.nis")} value={company.nis ?? "—"} />
                <InfoRow label={t("parties.ai")} value={company.ai ?? "—"} />
                <InfoRow label={t("parties.vatNumber")} value={company.vatNumber ?? "—"} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="address">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabAddress")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label={t("parties.address")} value={company.address ?? "—"} />
                <InfoRow label={t("parties.country")} value={company.country ?? "—"} />
                <InfoRow label={t("parties.wilaya")} value={company.wilaya ?? "—"} />
                <InfoRow label={t("parties.commune")} value={company.commune ?? "—"} />
                <InfoRow
                  label={t("parties.postalCode")}
                  value={company.postalCode ?? "—"}
                />
                <InfoRow label={t("parties.phone")} value={company.phone ?? "—"} />
                <InfoRow label={t("parametres.mobile")} value={company.mobile ?? "—"} />
                <InfoRow label={t("parties.email")} value={company.email ?? "—"} />
                <InfoRow label={t("parametres.website")} value={company.website ?? "—"} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banking">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabBanking")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label={t("parametres.bank")} value={company.bank ?? "—"} />
                <InfoRow
                  label={t("parametres.bankAgency")}
                  value={company.bankAgency ?? "—"}
                />
                <InfoRow
                  label={t("parametres.bankAccount")}
                  value={company.bankAccount ?? "—"}
                />
                <InfoRow label={t("parametres.rib")} value={company.rib ?? "—"} />
                <InfoRow label={t("parametres.iban")} value={company.iban ?? "—"} />
                <InfoRow label={t("parametres.swift")} value={company.swift ?? "—"} />
                <InfoRow
                  label={t("parties.paymentTerms")}
                  value={company.paymentTerms ?? "—"}
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabBranding")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow
                  label={t("admin.colorPrimary")}
                  value={company.primaryColor ?? "—"}
                />
                <InfoRow
                  label={t("admin.colorSecondary")}
                  value={company.secondaryColor ?? "—"}
                />
              </dl>
              {company.notes ? (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">{t("parties.notes")}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {company.notes}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="printing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabPrinting")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label={t("admin.printFormat")} value={company.printFormat} />
                <InfoRow
                  label={t("admin.printMargins")}
                  value={
                    company.printMargins
                      ? `${company.printMargins.top ?? 0} / ${company.printMargins.right ?? 0} / ${company.printMargins.bottom ?? 0} / ${company.printMargins.left ?? 0} mm`
                      : "—"
                  }
                />
                <InfoRow
                  label={t("admin.qrEnabled")}
                  value={company.qrEnabled ? t("common.yes") : t("common.no")}
                />
              </dl>
              {company.printHeader ? (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">{t("admin.printHeader")}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {company.printHeader}
                  </p>
                </div>
              ) : null}
              {company.invoiceFooter ? (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">{t("admin.invoiceFooter")}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {company.invoiceFooter}
                  </p>
                </div>
              ) : null}
              {company.emailFooter ? (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">{t("admin.emailFooter")}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {company.emailFooter}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbering">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabNumbering")}</CardTitle>
            </CardHeader>
            <CardContent>
              {series.length === 0 ? (
                <EmptyState title={t("admin.noSeries")} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("parametres.seriesDoc")}</TableHead>
                      <TableHead>{t("parametres.seriesPrefix")}</TableHead>
                      <TableHead>{t("parametres.seriesSeparator")}</TableHead>
                      <TableHead>{t("parametres.seriesSuffix")}</TableHead>
                      <TableHead>{t("parametres.seriesYear")}</TableHead>
                      <TableHead>{t("parametres.seriesPad")}</TableHead>
                      <TableHead>{t("parametres.seriesNext")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {series.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {t(`docTypes.${s.docType}` as "docTypes.QUOTATION")}
                        </TableCell>
                        <TableCell className="font-mono">{s.prefix}</TableCell>
                        <TableCell className="font-mono">{s.separator}</TableCell>
                        <TableCell className="font-mono">{s.suffix}</TableCell>
                        <TableCell>
                          {s.withYear ? (s.separator || "—") : "—"}
                        </TableCell>
                        <TableCell>{s.padLength}</TableCell>
                        <TableCell className="font-mono">{s.nextValue}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabBranches")}</CardTitle>
            </CardHeader>
            <CardContent>
              {branches.length === 0 ? (
                <EmptyState title={t("admin.noBranches")} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("parametres.branchCode")}</TableHead>
                      <TableHead>{t("parametres.branchName")}</TableHead>
                      <TableHead>{t("parametres.branchType")}</TableHead>
                      <TableHead>{t("parametres.branchCity")}</TableHead>
                      <TableHead>{t("parametres.phone")}</TableHead>
                      <TableHead>{t("parametres.manager")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono font-medium">
                          {b.code}
                          {b.isDefault ? (
                            <Badge variant="success" className="ml-2">
                              {t("admin.defaultBranch")}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {b.name}
                          {b.nameAr ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {b.nameAr}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>{b.type}</TableCell>
                        <TableCell>{b.city ?? "—"}</TableCell>
                        <TableCell>{b.phone ?? "—"}</TableCell>
                        <TableCell>{b.manager ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabUsers")}</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <EmptyState title={t("admin.noMembers")} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.type")}</TableHead>
                      <TableHead>{t("search.users")}</TableHead>
                      <TableHead>{t("admin.assignRole")}</TableHead>
                      <TableHead>{t("admin.defaultBranchForUser")}</TableHead>
                      <TableHead>{t("admin.joinedAt")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.userCompanyId}>
                        <TableCell>
                          <Badge
                            variant={m.active ? "success" : "secondary"}
                          >
                            {m.active
                              ? t("admin.memberActive")
                              : t("admin.memberInactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{m.fullName || m.username}</p>
                          {m.email ? (
                            <p className="text-xs text-muted-foreground">{m.email}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {m.roles
                            .filter((r) => r.active)
                            .map((r) => r.roleName)
                            .join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          {m.defaultBranch
                            ? `${m.defaultBranch.code} · ${m.defaultBranch.name}`
                            : "—"}
                        </TableCell>
                        <TableCell>{formatDate(m.joinedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabAudit")}</CardTitle>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <EmptyState title={t("admin.noAudit")} />
              ) : (
                <ul className="space-y-3">
                  {audit.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {entry.action} · {entry.entity}
                          {entry.entityId ? ` · ${entry.entityId}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.actorName ?? "—"}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.tabActivity")}</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyState title={t("admin.noActivity")} />
              ) : (
                <ul className="space-y-3">
                  {activity.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.actorName ?? "—"} · {event.type}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label={t("admin.statBranches")} value={statistics.branches} />
            <StatCard label={t("admin.statUsers")} value={statistics.users} />
            <StatCard
              label={t("admin.statActiveMembers")}
              value={statistics.activeMembers}
            />
            <StatCard label={t("admin.statCustomers")} value={statistics.customers} />
            <StatCard label={t("admin.statSuppliers")} value={statistics.suppliers} />
            <StatCard label={t("admin.statProducts")} value={statistics.products} />
            <StatCard
              label={t("admin.statWarehouses")}
              value={statistics.warehouses}
            />
            <StatCard
              label={t("admin.lastLogin")}
              value={statistics.lastLogin ? formatDate(statistics.lastLogin) : t("admin.never")}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
