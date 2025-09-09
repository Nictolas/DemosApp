import { useAuth } from "@/hooks/use-auth-neon";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";
import React from "react";

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  // === DEBUG LOGS ===
  console.log('🔍 DEBUG ProtectedRoute - children:', !!children);
  console.log('🔍 DEBUG ProtectedRoute - user:', !!user);
  console.log('🔍 DEBUG ProtectedRoute - isLoading:', isLoading);

  // Mostra loader mentre carica l'autenticazione
  if (isLoading || typeof user === 'undefined') {
    console.log('🔍 DEBUG ProtectedRoute - Mostrando loader');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Redirect se non autenticato
  if (!user) {
    console.log('🔍 DEBUG ProtectedRoute - Redirect a /auth');
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

  // Renderizza i children se autenticato e verificato
  console.log('🔍 DEBUG ProtectedRoute - Rendering children');
  return <>{children}</>;
}