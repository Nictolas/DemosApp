// src/lib/protected-route.tsx

import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";

// MODIFICA 1: Aggiungiamo 'roles' alla lista delle props
export function ProtectedRoute({
  path,
  component: Component,
  roles, // Questa è la nuova prop, è opzionale
}: {
  path: string;
  component: React.ComponentType<any>; // Tipo più flessibile per i componenti
  roles?: string[]; // La prop 'roles' è un array opzionale di stringhe
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    // Questa parte rimane IDENTICA
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    // Questa parte rimane IDENTICA
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // MODIFICA 2: Aggiungiamo il controllo del ruolo QUI, prima di dare l'ok finale
  // Questo blocco viene eseguito solo se l'utente è loggato (perché ha superato l'if precedente)
  if (roles && roles.length > 0 && !roles.includes(user.ruolo)) {
    // Spiegazione:
    // 1. `roles && roles.length > 0`: Controlliamo se per questa rotta sono stati specificati dei ruoli.
    // 2. `!roles.includes(user.ruolo)`: Controlliamo se il ruolo dell'utente NON è presente nella lista dei ruoli permessi.
    // 3. Se entrambe le condizioni sono vere, l'utente non è autorizzato.

    // Lo reindirizziamo alla pagina del menu.
    return (
      <Route path={path}>
        <Redirect to="/menu" />
      </Route>
    );
  }


  // Se siamo arrivati fin qui, significa che l'utente è loggato E ha il ruolo corretto
  // (o la pagina non richiedeva un ruolo specifico).
  // Questa parte rimane IDENTICA a prima.
  return (
    <Route path={path}>
      {(params) => (
        <PageTransition location={location}>
          <Component {...params} />
        </PageTransition>
      )}
    </Route>
  );
}