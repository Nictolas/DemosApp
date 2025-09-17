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

  // Mostra loader mentre carica l'autenticazione (solo se non siamo sul menu)
  if ((isLoading || typeof user === 'undefined') && path !== '/menu') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Redirect se non autenticato
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Controlla lo status dell'utente
  if (user.status === 'pending') {
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
