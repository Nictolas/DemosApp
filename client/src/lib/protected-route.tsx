import React from "react";
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

  // Controlla   // Renderizza il componente se autenticato e verificato
  return <Component />;
}
