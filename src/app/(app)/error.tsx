"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Error boundary de la zone authentifiée. Affiche un message générique sûr
 * (jamais de stack trace ni de secrets) et permet à l'utilisateur de réessayer.
 * Le détail réel de l'erreur reste dans les logs serveur (voir `error.digest`).
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Le code réel (ETIMEDOUT, etc.) est visible côté serveur via `digest` ;
    // on ne loggue que le digest ici, jamais le message brut ni le stack.
    console.error(`[app] Erreur d'application (digest: ${error.digest ?? "inconnu"})`);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Une erreur est survenue</CardTitle>
          <CardDescription>
            Le chargement de cette page a échoué. Réessayez ; si le problème
            persiste, contactez l&apos;administrateur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Référence : <code className="rounded bg-muted px-1.5 py-0.5">{error.digest ?? "—"}</code>
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => unstable_retry()}>Réessayer</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
