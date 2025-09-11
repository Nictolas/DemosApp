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

  console.log('🔍 ProtectedRoute - Stato auth:', {
    path,
    isLoading,
    hasUser: !!user,
    userEmail: user?.email,
    userStatus: user?.status
  });

  // Mostra loader mentre carica l'autenticazione
  if (isLoading || typeof user === 'undefined') {
    console.log('⏳ ProtectedRoute - Mostrando loader per:', path);
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
  console.log('✅ ProtectedRoute - Renderizzando componente per:', path);
  return <Component />;
}