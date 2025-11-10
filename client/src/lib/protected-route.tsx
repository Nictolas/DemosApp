import React, { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  const { user, isLoading } = useAuth();

  // Debug logging rimosso per evitare re-render

  // Mostra loader mentre carica l'autenticazione
  // Controlla anche se c'è un token nel localStorage per evitare di mostrare il loader se non c'è token
  const hasToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  
  if (isLoading || (typeof user === 'undefined' && hasToken)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Redirect se non autenticato (solo se non c'è token e non sta caricando)
  if (!user && !hasToken) {
    return <Redirect to="/auth" />;
  }

  // Controlla lo status dell'utente (solo se user è definito)
  if (user && user.status === 'pending') {
    // Salva l'email per la verifica
    localStorage.setItem('user_email', user.email);
    localStorage.setItem('user_status', 'pending');
    localStorage.setItem('user_id', user.id);
    
    // Reindirizza alla verifica email
    window.location.href = `/verifica-email?email=${encodeURIComponent(user.email)}`;
    return null;
  }

  // Renderizza il componente se autenticato e verificato
  return <Component />;
}
