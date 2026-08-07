"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/feedback/spinner";
import type { CommercialDocType } from "@/features/documents/engine/types";
import type { PDFDocumentProxy } from "pdfjs-dist";

type FitMode = "fit-page" | "fit-width" | "custom";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docId: string;
  docType: CommercialDocType;
  title?: string;
}

interface ToolButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}

function ToolButton({ label, icon, onClick, disabled }: ToolButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        {icon}
      </span>
    </Button>
  );
}

/**
 * Aperçu PDF réutilisable.
 *
 * - Le PDF est TOUJOURS généré côté serveur (même pipeline printDocument que
 *   Download et Print) puis téléchargé via l'API `/preview`.
 * - Rendu client (pdfjs-dist) pour le zoom / l'ajustement / la pagination.
 * - Print : iframe invisible qui recharge le même PDF serveur puis appelle
 *   `contentWindow.print()` — les octets imprimés sont identiques à l'aperçu.
 */
export function DocumentPreviewDialog({
  open,
  onOpenChange,
  docId,
  docType,
  title,
}: PdfPreviewDialogProps) {
  const { t, locale } = useI18n();

  const [pdf, setPdf] = React.useState<PDFDocumentProxy | null>(null);
  const [pageSize, setPageSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [fitMode, setFitMode] = React.useState<FitMode>("fit-page");
  const [customScale, setCustomScale] = React.useState(1);
  const [containerSize, setContainerSize] = React.useState({
    width: 0,
    height: 0,
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const printFrameRef = React.useRef<HTMLIFrameElement>(null);
  const renderTaskRef = React.useRef<{ cancel: () => void } | null>(null);
  const pdfRef = React.useRef<PDFDocumentProxy | null>(null);
  const prevOpenRef = React.useRef(open);

  const previewUrl = React.useMemo(
    () => `/api/documents/${docId}/preview?type=${docType}&locale=${locale}`,
    [docId, docType, locale],
  );
  const downloadUrl = React.useMemo(
    () => `/api/documents/${docId}/pdf?type=${docType}&locale=${locale}`,
    [docId, docType, locale],
  );

  // Libère le document à la fermeture et au démontage (sans setState synchrone).
  React.useEffect(() => {
    if (prevOpenRef.current && !open) {
      pdfRef.current?.destroy();
      pdfRef.current = null;
    }
    prevOpenRef.current = open;
  }, [open]);

  React.useEffect(() => {
    return () => {
      pdfRef.current?.destroy();
      renderTaskRef.current?.cancel();
    };
  }, []);

  // Chargement du PDF serveur à l'ouverture (ou changement de locale).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        const { default: workerUrl } = await import(
          "pdfjs-dist/build/pdf.worker.min.mjs?url"
        );
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        if (cancelled) return;

        const response = await fetch(previewUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(t("documentsUI.printFailed"));
        const data = await response.arrayBuffer();
        if (cancelled) return;

        const document = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          void document.destroy();
          return;
        }

        pdfRef.current?.destroy();
        pdfRef.current = document;
        const page = await document.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        setPageSize({ width: viewport.width, height: viewport.height });
        setPdf(document);
        setCurrentPage(1);
        setFitMode("fit-page");
      } catch (cause) {
        if (!cancelled) {
          pdfRef.current?.destroy();
          pdfRef.current = null;
          setPdf(null);
          setPageSize(null);
          setError(
            cause instanceof Error ? cause.message : t("documentsUI.printFailed"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [open, previewUrl, t]);

  // Taille du conteneur (pour les modes ajustement).
  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () =>
      setContainerSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scale = React.useMemo(() => {
    if (fitMode === "custom") return customScale;
    if (!pageSize || containerSize.width === 0) return 1;
    if (fitMode === "fit-width") {
      return Math.max(0.1, containerSize.width / pageSize.width);
    }
    const padding = 16;
    const scaleW = (containerSize.width - padding) / pageSize.width;
    const scaleH = (containerSize.height - padding) / pageSize.height;
    return Math.max(0.1, Math.min(scaleW, scaleH));
  }, [fitMode, customScale, pageSize, containerSize]);

  const pageCount = pdf?.numPages ?? 0;

  // Rendu de la page courante.
  React.useEffect(() => {
    if (!pdf || !canvasRef.current || pageCount === 0) return;
    let cancelled = false;

    const render = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderTaskRef.current?.cancel();
        const task = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (cause) {
        if (
          (cause as { name?: string })?.name !== "RenderingCancelledException"
        ) {
          setError(
            cause instanceof Error ? cause.message : t("documentsUI.printFailed"),
          );
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdf, currentPage, scale, pageCount, t]);

  const zoomBy = (factor: number) => {
    setFitMode("custom");
    setCustomScale((previous) =>
      Math.min(4, Math.max(0.25, Number((previous * factor).toFixed(3)))),
    );
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(pageCount, Math.max(1, page)));
  };

  const handlePrint = () => {
    const frame = printFrameRef.current;
    if (!frame) return;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        toast.error(t("documentsUI.printFailed"));
      }
    };
    frame.src = `${previewUrl}&_print=${Date.now()}`;
  };

  const handleDownload = () => {
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{title ?? t("documentsUI.preview")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("documentsUI.preview")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
          <ToolButton
            label={t("documentsUI.zoomOut")}
            icon="zoom_out"
            onClick={() => zoomBy(1 / 1.25)}
            disabled={!pdf || loading}
          />
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <ToolButton
            label={t("documentsUI.zoomIn")}
            icon="zoom_in"
            onClick={() => zoomBy(1.25)}
            disabled={!pdf || loading}
          />
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <ToolButton
            label={t("documentsUI.fitWidth")}
            icon="width"
            onClick={() => setFitMode("fit-width")}
            disabled={!pdf || loading}
          />
          <ToolButton
            label={t("documentsUI.fitPage")}
            icon="fit_screen"
            onClick={() => setFitMode("fit-page")}
            disabled={!pdf || loading}
          />
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <ToolButton
            label={t("documentsUI.previousPage")}
            icon="chevron_left"
            onClick={() => goToPage(currentPage - 1)}
            disabled={!pdf || currentPage <= 1}
          />
          <span className="min-w-24 text-center text-xs tabular-nums text-muted-foreground">
            {t("documentsUI.pageIndicator", {
              current: currentPage,
              total: pageCount,
            })}
          </span>
          <ToolButton
            label={t("documentsUI.nextPage")}
            icon="chevron_right"
            onClick={() => goToPage(currentPage + 1)}
            disabled={!pdf || currentPage >= pageCount}
          />

          <div className="flex-1" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!pdf || loading}
          >
            <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
              download
            </span>
            {t("documentsUI.downloadPdf")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            disabled={!pdf || loading}
          >
            <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
              print
            </span>
            {t("documentsUI.print")}
          </Button>
        </div>

        <div
          ref={containerRef}
          className="relative flex-1 overflow-auto bg-muted/40 p-4"
        >
          {loading && (
            <div className="flex h-full w-full items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          )}
          {!loading && error && (
            <div className="flex h-full w-full items-center justify-center text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && pdf && (
            <div className="flex min-h-full w-full items-center justify-center">
              <canvas
                ref={canvasRef}
                className="rounded-sm bg-white shadow-lg"
                aria-label={t("documentsUI.preview")}
              />
            </div>
          )}
        </div>

        <iframe
          ref={printFrameRef}
          src={previewUrl}
          title={t("documentsUI.preview")}
          className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px border-0"
          aria-hidden="true"
        />
      </DialogContent>
    </Dialog>
  );
}
