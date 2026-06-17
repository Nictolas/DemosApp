import React, { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  const { user, isLoading, isError } = useAuth();

  const hasToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Se la richiesta /auth/me è fallita, reindirizza subito (evita loader infinito)
  if (isError) {
    return <Redirect to="/auth" />;
  }

  // Loader solo mentre carica e c'è un token (in attesa di /auth/me)
  if (isLoading && hasToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Redirect se non autenticato
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
