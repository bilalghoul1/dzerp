"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useCompany } from "@/features/company/company-provider";
import { computeAllLines } from "@/features/documents/engine/calculation";
import { getDocConfig } from "@/features/documents/engine/config";
import type { CommercialDocType } from "@/features/documents/engine/types";
import type { ComputedTotals } from "@/features/documents/engine/types";
import type { DocumentStatus } from "@/generated/prisma/enums";
import {
  getDocument,
  createDocument as apiCreateDocument,
  updateDocument as apiUpdateDocument,
  changeStatus,
  approveDocument,
  DocumentApiError,
} from "@/features/documents/framework/api";
import type {
  DocumentDetailModel,
  DocumentLineModel,
  EditorPermissions,
} from "@/features/documents/framework/ui-types";

export interface EditorPartyOption {
  id: string;
  name: string;
}

export interface EditorLookups {
  parties: EditorPartyOption[];
  currencies: Array<{ code: string; name: string; rate: number; isDefault?: boolean }>;
  units: Array<{ key: string; label: string }>;
  taxRates: Array<{
    key: string;
    label: string;
    rate: number;
    isDefault?: boolean;
    exempt?: boolean;
  }>;
}

export interface EditorHeaderState {
  branchId: string;
  partyId: string;
  clientId: string;
  issuedById: string;
  currency: string;
  exchangeRate: number;
  notes: string;
  issuedAt: string;
  validUntil: string;
  dueDate: string;
  customerOrderNumber: string;
  customerOrderDate: string;
  receivedDate: string;
  requestedDeliveryDate: string;
  conditions: string;
}

function blankHeader(branchId: string, currency: string): EditorHeaderState {
  return {
    branchId,
    partyId: "",
    clientId: "",
    issuedById: "",
    currency,
    exchangeRate: 1,
    notes: "",
    issuedAt: "",
    validUntil: "",
    dueDate: "",
    customerOrderNumber: "",
    customerOrderDate: "",
    receivedDate: "",
    requestedDeliveryDate: "",
    conditions: "",
  };
}

function detailToHeader(detail: DocumentDetailModel): EditorHeaderState {
  return {
    branchId: detail.branchId,
    partyId: detail.partyId ?? "",
    clientId: detail.clientId ?? "",
    issuedById: detail.issuedById ?? "",
    currency: detail.currency || "DZD",
    exchangeRate: detail.exchangeRate || 1,
    notes: detail.notes ?? "",
    issuedAt: detail.issuedAt,
    validUntil: detail.validUntil ?? "",
    dueDate: detail.dueDate ?? "",
    customerOrderNumber: detail.customerOrderNumber ?? "",
    customerOrderDate: detail.customerOrderDate ?? "",
    receivedDate: detail.receivedDate ?? "",
    requestedDeliveryDate: detail.requestedDeliveryDate ?? "",
    conditions: detail.conditions ?? "",
  };
}

function detailToLines(detail: DocumentDetailModel): DocumentLineModel[] {
  return detail.lines.length > 0 ? detail.lines : [blankLine()];
}

function blankLine(): DocumentLineModel {
  return {
    id: null,
    lineNumber: 1,
    kind: "PRODUCT",
    productId: null,
    label: "",
    unit: null,
    quantity: 1,
    unitPrice: 0,
    discountPct: 0,
    taxPct: 0,
    amountHt: 0,
    amountTva: 0,
    amountTtc: 0,
    customerSpecs: null,
  };
}

function toInputLines(lines: DocumentLineModel[]) {
  return lines.map((line) => ({
    kind: line.kind,
    productId: line.productId ?? undefined,
    label: line.label,
    unit: line.unit ?? undefined,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPct: line.discountPct,
    taxPct: line.taxPct,
    customerSpecs: line.customerSpecs ?? null,
  }));
}

function resolvePermissions(
  companyPermissions: readonly string[],
): EditorPermissions {
  return {
    create: companyPermissions.includes("documents.create"),
    update: companyPermissions.includes("documents.update"),
    delete: companyPermissions.includes("documents.delete"),
    approve: companyPermissions.includes("documents.approve"),
    convert: companyPermissions.includes("documents.convert"),
    print: companyPermissions.includes("documents.print"),
  };
}

interface DocumentEditorContextValue {
  type: CommercialDocType;
  docId: string | null;
  detail: DocumentDetailModel | null;
  header: EditorHeaderState;
  lines: DocumentLineModel[];
  totals: ComputedTotals;
  dirty: boolean;
  busy: boolean;
  permissions: EditorPermissions;
  lookups: EditorLookups;
  setHeaderField: <K extends keyof EditorHeaderState>(
    field: K,
    value: EditorHeaderState[K],
  ) => void;
  setLines: (lines: DocumentLineModel[]) => void;
  updateLine: (index: number, patch: Partial<DocumentLineModel>) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  duplicateLine: (index: number) => void;
  moveLine: (index: number, direction: "up" | "down") => void;
  save: () => Promise<DocumentDetailModel | null>;
  refresh: () => Promise<void>;
  applyStatus: (target: DocumentStatus) => Promise<void>;
}

const DocumentEditorContext =
  React.createContext<DocumentEditorContextValue | null>(null);

export function DocumentEditorProvider({
  type,
  docId,
  initialDetail,
  lookups,
  initialCustomerId,
  children,
}: {
  type: CommercialDocType;
  docId?: string | null;
  initialDetail?: DocumentDetailModel | null;
  lookups: EditorLookups;
  /** Client pré-sélectionné (`?customerId=`) — ignoré en mode édition. */
  initialCustomerId?: string | null;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const company = useCompany();
  const router = useRouter();

  const defaultBranchId = company.branch?.id ?? company.branches[0]?.id ?? "";
  const defaultCurrency =
    lookups.currencies.find((c) => c.isDefault)?.code ??
    company.company.currency ??
    "DZD";

  const [detail, setDetail] = React.useState<DocumentDetailModel | null>(
    initialDetail ?? null,
  );
  const [header, setHeader] = React.useState<EditorHeaderState>(() => {
    if (initialDetail) return detailToHeader(initialDetail);
    const blank = blankHeader(defaultBranchId, defaultCurrency);
    // Pré-remplissage du client : uniquement si l'id provient des lookups de la
    // société active (validé côté serveur aussi dans document-editor-page).
    if (
      initialCustomerId &&
      lookups.parties.some((party) => party.id === initialCustomerId)
    ) {
      return { ...blank, partyId: initialCustomerId };
    }
    return blank;
  });
  const [lines, setLines] = React.useState<DocumentLineModel[]>(() =>
    initialDetail ? detailToLines(initialDetail) : [blankLine()],
  );
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const totals = React.useMemo(() => computeAllLines(toInputLines(lines)), [lines]);
  const permissions = React.useMemo(
    () => resolvePermissions(company.permissions),
    [company.permissions],
  );

  const config = React.useMemo(() => getDocConfig(type), [type]);

  const markDirty = React.useCallback(() => setDirty(true), []);

  const setHeaderField = React.useCallback(
    <K extends keyof EditorHeaderState>(
      field: K,
      value: EditorHeaderState[K],
    ) => {
      setHeader((prev) => ({ ...prev, [field]: value }));
      markDirty();
    },
    [markDirty],
  );

  const setLinesAll = React.useCallback(
    (next: DocumentLineModel[]) => {
      setLines(next);
      markDirty();
    },
    [markDirty],
  );

  const updateLine = React.useCallback(
    (index: number, patch: Partial<DocumentLineModel>) => {
      setLines((prev) =>
        prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
      );
      markDirty();
    },
    [markDirty],
  );

  const addLine = React.useCallback(() => {
    setLines((prev) => [...prev, blankLine()]);
    markDirty();
  }, [markDirty]);

  const removeLine = React.useCallback(
    (index: number) => {
      setLines((prev) => {
        if (prev.length === 1) return prev;
        return prev.filter((_, i) => i !== index);
      });
      markDirty();
    },
    [markDirty],
  );

  const duplicateLine = React.useCallback(
    (index: number) => {
      setLines((prev) => {
        const next = [...prev];
        next.splice(index + 1, 0, {
          ...prev[index],
          id: null,
          lineNumber: 0,
        });
        return next;
      });
      markDirty();
    },
    [markDirty],
  );

  const moveLine = React.useCallback(
    (index: number, direction: "up" | "down") => {
      setLines((prev) => {
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        const [line] = next.splice(index, 1);
        next.splice(target, 0, line);
        return next;
      });
      markDirty();
    },
    [markDirty],
  );

  const buildPayload = React.useCallback(() => {
    const partyField = config.partyField;
    const payload: Record<string, unknown> = {
      branchId: header.branchId || undefined,
      ...(partyField === "customerId"
        ? { customerId: header.partyId || undefined }
        : { supplierId: header.partyId || undefined }),
      clientId: header.clientId || null,
      issuedById: header.issuedById || null,
      currency: header.currency || "DZD",
      exchangeRate: header.exchangeRate || 1,
      notes: header.notes || null,
      lines: toInputLines(lines),
    };
    if (type === "CUSTOMER_ORDER") {
      payload.customerOrderNumber = header.customerOrderNumber || null;
      payload.customerOrderDate = header.customerOrderDate || null;
      payload.receivedDate = header.receivedDate || null;
      payload.requestedDeliveryDate = header.requestedDeliveryDate || null;
      payload.conditions = header.conditions || null;
    }
    if (type === "PROFORMA") {
      payload.validUntil = header.validUntil || null;
      payload.conditions = header.conditions || null;
    }
    if (type === "QUOTATION") {
      payload.validUntil = header.validUntil || null;
    }
    if (type === "INVOICE" || type === "SUPPLIER_INVOICE") {
      payload.dueDate = header.dueDate || null;
    }
    if (detail?.meta) {
      payload.meta = detail.meta;
    }
    return payload;
  }, [config.partyField, header, lines, type, detail]);

  const refresh = React.useCallback(async () => {
    if (!docId) return;
    const updated = await getDocument(type, docId);
    setDetail(updated);
    setHeader(detailToHeader(updated));
    setLines(detailToLines(updated));
    setDirty(false);
  }, [docId, type]);

  const save = React.useCallback(async (): Promise<DocumentDetailModel | null> => {
    setBusy(true);
    try {
      const payload = buildPayload();

      // Contextual validation (UX continuity): before calling the API, surface
      // the missing requirement in the user's language and indicate what to do.
      // This does not weaken server-side checks (still the authority); it only
      // makes the guidance clear and actionable for the company owner.
      if (!header.branchId) {
        toast.error(t("documentsUI.missingBranch"));
        return null;
      }
      if (!header.partyId) {
        toast.error(t("documentsUI.missingParty"));
        return null;
      }
      if (lines.length === 0) {
        toast.error(t("documentsUI.missingLines"));
        return null;
      }
      const emptyLabel = lines.some(
        (line) => line.kind === "PRODUCT" || line.kind === "SERVICE"
          ? !(line.label ?? "").trim()
          : false,
      );
      if (emptyLabel) {
        toast.error(t("documentsUI.missingLineLabel"));
        return null;
      }

      const saved = docId
        ? await apiUpdateDocument(type, docId, payload)
        : await apiCreateDocument(type, payload);
      setDetail(saved);
      setHeader(detailToHeader(saved));
      setLines(detailToLines(saved));
      setDirty(false);
      if (!docId) {
        // New document created: land on its detail page with a success banner
        // (never leave the user on an empty editor).
        toast.success(t("documentsUI.saved"));
        router.push(`/documents/${type.toLowerCase()}/${saved.id}?created=1`);
      } else {
        toast.success(t("documentsUI.saved"));
      }
      return saved;
    } catch (error) {
      const message =
        error instanceof DocumentApiError && error.code === "NOT_DRAFT"
          ? t("documentsUI.onlyDraftEditable")
          : error instanceof Error
            ? error.message
            : t("documentsUI.saveError");
      toast.error(message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [buildPayload, docId, type, t, router, header.branchId, header.partyId, lines]);

  const applyStatus = React.useCallback(
    async (target: DocumentStatus) => {
      if (!docId) return;
      setBusy(true);
      try {
        if (target === "APPROVED") {
          await approveDocument(type, docId);
        } else {
          await changeStatus(type, docId, target);
        }
        await refresh();
        toast.success(t("documentsUI.saved"));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("documentsUI.saveError"),
        );
      } finally {
        setBusy(false);
      }
    },
    [docId, type, refresh, t],
  );

  const value = React.useMemo<DocumentEditorContextValue>(
    () => ({
      type,
      docId: docId ?? null,
      detail,
      header,
      lines,
      totals,
      dirty,
      busy,
      permissions,
      lookups,
      setHeaderField,
      setLines: setLinesAll,
      updateLine,
      addLine,
      removeLine,
      duplicateLine,
      moveLine,
      save,
      refresh,
      applyStatus,
    }),
    [
      type,
      docId,
      detail,
      header,
      lines,
      totals,
      dirty,
      busy,
      permissions,
      lookups,
      setHeaderField,
      setLinesAll,
      updateLine,
      addLine,
      removeLine,
      duplicateLine,
      moveLine,
      save,
      refresh,
      applyStatus,
    ],
  );

  return (
    <DocumentEditorContext.Provider value={value}>
      {children}
    </DocumentEditorContext.Provider>
  );
}

export function useDocumentEditor(): DocumentEditorContextValue {
  const ctx = React.useContext(DocumentEditorContext);
  if (!ctx) {
    throw new Error(
      "useDocumentEditor must be used within a DocumentEditorProvider",
    );
  }
  return ctx;
}
