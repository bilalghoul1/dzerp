"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentEditor } from "@/components/documents/document-editor-context";

interface CommentItem {
  id: string;
  author: string;
  text: string;
  at: string;
}

const EXAMPLE_AUTHOR = "current-user";

export function DocumentComments() {
  const { t } = useI18n();
  const editor = useDocumentEditor();
  const [items, setItems] = React.useState<CommentItem[]>([]);
  const [draft, setDraft] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        author: EXAMPLE_AUTHOR,
        text,
        at: new Date().toISOString(),
      },
    ]);
    setDraft("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <span className="material-symbols-outlined me-1.5 align-middle text-[18px] text-muted-foreground" aria-hidden="true">
            comment
          </span>
          {t("documentsUI.commentsSection")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("documentsUI.noComments")}
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{item.author}</p>
                <p className="mt-0.5">{item.text}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("documentsUI.commentPlaceholder")}
            aria-label={t("documentsUI.commentPlaceholder")}
          />
          <Button type="submit" disabled={!draft.trim() || editor.busy}>
            {t("documentsUI.addComment")}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("documentsUI.commentsHint")}
        </p>
      </CardContent>
    </Card>
  );
}
