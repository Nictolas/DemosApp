import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Protegge le quattro pagine delle opinioni da navigazioni involontarie.
 * Un avviso personalizzato gestisce le navigazioni SPA; per chiudere la
 * scheda/ricaricare, i browser consentono soltanto l'avviso nativo.
 */
export function useUnsavedOpinionsGuard(
  isDirty: boolean,
  navigate: (path: string) => void,
  save: () => void
) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingDestination = useRef<string | null>(null);
  const allowNavigation = useRef(false);
  const dirtyRef = useRef(isDirty);
  const navigateRef = useRef(navigate);
  const saveRef = useRef(save);

  dirtyRef.current = isDirty;
  navigateRef.current = navigate;
  saveRef.current = save;

  const askBeforeLeaving = (destination: string) => {
    if (!dirtyRef.current || allowNavigation.current) {
      navigateRef.current(destination);
      return;
    }
    pendingDestination.current = destination;
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!isDirty || allowNavigation.current) return;

    const originalUrl = window.location.pathname + window.location.search + window.location.hash;
    const originalPathAndQuery = window.location.pathname + window.location.search;
    const history = window.history;
    const previousPushState = history.pushState;
    const previousReplaceState = history.replaceState;

    const intercept = (url: string | URL | null | undefined): string | null => {
      if (allowNavigation.current || !dirtyRef.current || url == null) return null;
      const target = new URL(String(url), window.location.href);
      if (target.origin !== window.location.origin) return null;
      if (target.pathname + target.search === originalPathAndQuery) return null;
      return target.pathname + target.search + target.hash;
    };

    const guardedPushState: History["pushState"] = (state, title, url) => {
      const target = intercept(url);
      if (target) {
        pendingDestination.current = target;
        setDialogOpen(true);
        return;
      }
      previousPushState.call(history, state, title, url);
    };
    const guardedReplaceState: History["replaceState"] = (state, title, url) => {
      const target = intercept(url);
      if (target) {
        pendingDestination.current = target;
        setDialogOpen(true);
        return;
      }
      previousReplaceState.call(history, state, title, url);
    };

    history.pushState = guardedPushState;
    history.replaceState = guardedReplaceState;

    const onPopState = () => {
      if (allowNavigation.current || !dirtyRef.current) return;
      const target = window.location.pathname + window.location.search + window.location.hash;
      if (target === originalUrl) return;
      // Ripristina subito la pagina, prima di presentare il dialog.
      allowNavigation.current = true;
      try {
        previousPushState.call(history, history.state, "", originalUrl);
      } finally {
        allowNavigation.current = false;
      }
      pendingDestination.current = target;
      setDialogOpen(true);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigation.current || !dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      if (history.pushState === guardedPushState) history.pushState = previousPushState;
      if (history.replaceState === guardedReplaceState) history.replaceState = previousReplaceState;
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isDirty]);

  const onSaveSuccess = () => {
    allowNavigation.current = true;
    const destination = pendingDestination.current || "/opinioni";
    pendingDestination.current = null;
    setDialogOpen(false);
    return destination;
  };

  const onSaveError = () => {
    pendingDestination.current = null;
    setDialogOpen(false);
  };

  const discardAndLeave = () => {
    const destination = pendingDestination.current || "/opinioni";
    pendingDestination.current = null;
    allowNavigation.current = true;
    setDialogOpen(false);
    navigateRef.current(destination);
  };

  const cancelLeave = () => {
    pendingDestination.current = null;
    setDialogOpen(false);
  };

  const saveAndLeave = () => {
    setDialogOpen(false);
    saveRef.current();
    // La navigazione verrà effettuata SOLO dopo il successo del salvataggio.
  };

  const dialog = (
    <AlertDialog open={dialogOpen} onOpenChange={(open) => { if (!open) cancelLeave(); }}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Opinioni non salvate</AlertDialogTitle>
          <AlertDialogDescription>
            Hai modificato alcune opinioni senza salvarle. Vuoi salvarle prima di uscire?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-2">
          <Button type="button" variant="outline" onClick={cancelLeave}>Annulla</Button>
          <Button type="button" variant="destructive" onClick={discardAndLeave}>Esci senza salvare</Button>
          <Button type="button" onClick={saveAndLeave}>Salva ed esci</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { onBack: () => askBeforeLeaving("/opinioni"), onSaveSuccess, onSaveError, dialog };
}
