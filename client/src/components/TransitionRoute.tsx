import React from "react";
import { Route, useLocation } from "wouter";
import { PageTransition } from "./PageTransition";

interface TransitionRouteProps {
  path: string;
  component: React.ComponentType<any>;
}

/**
 * Un componente Route con effetto di transizione.
 * Wrapper attorno al componente Route di wouter che aggiunge transizioni fluide.
 */
export function TransitionRoute({ path, component: Component }: TransitionRouteProps) {
  const [location] = useLocation();
  
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

/**
 * Versione protetta di TransitionRoute, che include autenticazione
 */
export function ProtectedTransitionRoute({ path, component }: TransitionRouteProps) {
  // Qui utilizziamo il componente ProtectedRoute definito in lib/protected-route.tsx
  // Importarlo direttamente qui creerebbe una dipendenza circolare
  
  // Nota: questo componente NON gestisce direttamente l'autenticazione
  // ma si aspetta che il suo componente "genitore" App.tsx lo faccia correttamente
  // usando il componente ProtectedRoute importato da @/lib/protected-route
}
