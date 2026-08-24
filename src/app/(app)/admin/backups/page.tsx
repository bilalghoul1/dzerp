import { getAdminActor } from "@/features/company-admin/api";
import { getDatabaseBackupStats } from "@/features/company-admin/service";
import { getServerI18n } from "@/features/i18n/server";
import { formatNumber } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminBackupsPage() {
  const actor = await getAdminActor();
  if (!actor) return null;

  const [stats, { t, locale }] = await Promise.all([
    getDatabaseBackupStats(actor),
    getServerI18n(),
  ]);

  const totalRows = stats.reduce((sum, s) => sum + s.rows, 0);
  const totalTables = stats.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("admin.backupsTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.backupsSubtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                database
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none">
                {formatNumber(totalTables, locale)}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {t("admin.bkTables")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                table_rows
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none">
                {formatNumber(totalRows, locale)}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {t("admin.bkRows")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                info
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none">0</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {t("admin.bkAvailable")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.bkInventoryTitle")}</CardTitle>
              <CardDescription>{t("admin.bkInventoryDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.bkColTable")}</TableHead>
                      <TableHead>{t("admin.bkColRows")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((stat) => (
                      <TableRow key={stat.table}>
                        <TableCell className="font-mono text-xs">
                          {stat.table}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatNumber(stat.rows, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.bkActionsTitle")}</CardTitle>
            <CardDescription>{t("admin.bkActionsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3">
              <span className="material-symbols-outlined mt-0.5 text-[20px] text-muted-foreground" aria-hidden="true">
                lock
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("admin.bkUnavailable")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("admin.bkUnavailableDesc")}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button disabled className="w-full">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  save
                </span>
                {t("admin.bkCreate")}
              </Button>
              <Button disabled variant="outline" className="w-full">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  restore
                </span>
                {t("admin.bkRestore")}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{t("admin.bkNotConfigured")}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
