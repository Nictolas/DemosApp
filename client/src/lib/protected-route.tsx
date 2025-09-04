import { useAuth } from "@/hooks/use-auth-neon";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";
import React from "react";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  const { user, isLoading } = useAuth();

  // === DEBUG LOGS ===
  // console.log('🔍 DEBUG ProtectedRoute - path prop:', path);
  // console.log('🔍 DEBUG ProtectedRoute - user:', user);
  // console.log('🔍 DEBUG ProtectedRoute - isLoading:', isLoading);
  // console.log('🔍 DEBUG ProtectedRoute - typeof user:', typeof user);

  // Mostra loader mentre carica l'autenticazione
  if (isLoading || typeof user === 'undefined') {
    // console.log('🔍 DEBUG ProtectedRoute - Mostrando loader per:', path);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Redirect se non autenticato
  if (!user) {
    // console.log('🔍 DEBUG ProtectedRoute - Redirect a /auth per:', path);
    return <Redirect to="/auth" />;
  }

  // Controlla lo status dell'utente
  if (user.status === 'pending') {
    // Salva l'email per la verifica
    localStorage.setItem('user_email', user.email);
    localStorage.setItem('user_status', 'pending');
    localStorage.setItem('user_id', user.id);
    
    // Reindirizza alla verifica email
    return <Redirect to={`/verifica-email?email=${encodeURIComponent(user.email)}`} />;
  }

  // Renderizza il componente se autenticato e verificato
  // console.log('🔍 DEBUG ProtectedRoute - Rendering componente per:', path);
  return <Component />;
}