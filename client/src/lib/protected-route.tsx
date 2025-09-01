import { useAuth } from "@/hooks/use-auth-neon";
import { Loader2 } from "lucide-react";
import { Redirect, useLocation } from "wouter";
import React from "react";

export function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType<any>;
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // === DEBUG LOGS ===
  console.log('🔍 DEBUG ProtectedRoute - current location:', location);
  console.log('🔍 DEBUG ProtectedRoute - user:', user);
  console.log('🔍 DEBUG ProtectedRoute - isLoading:', isLoading);
  console.log('🔍 DEBUG ProtectedRoute - typeof user:', typeof user);

  // Mostra loader mentre carica l'autenticazione
  if (isLoading || typeof user === 'undefined') {
    console.log('🔍 DEBUG ProtectedRoute - Mostrando loader per:', location);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Redirect se non autenticato
  if (!user) {
    console.log('🔍 DEBUG ProtectedRoute - Redirect a /auth per:', location);
    return <Redirect to="/auth" />;
  }

  // Renderizza il componente se autenticato
  console.log('🔍 DEBUG ProtectedRoute - Rendering componente per:', location);
  return <Component />;
}