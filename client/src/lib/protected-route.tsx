import { useAuth } from "@/hooks/use-auth-neon";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import React from "react";

export function ProtectedRoute({
  path,
  component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // === DEBUG LOGS ===
  console.log('🔍 DEBUG ProtectedRoute - path:', path);
  console.log('🔍 DEBUG ProtectedRoute - user:', user);
  console.log('🔍 DEBUG ProtectedRoute - isLoading:', isLoading);
  console.log('🔍 DEBUG ProtectedRoute - typeof user:', typeof user);

  if (isLoading || typeof user === 'undefined') {
    console.log('🔍 DEBUG ProtectedRoute - Mostrando loader per:', path);
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    console.log('🔍 DEBUG ProtectedRoute - Redirect a /auth per:', path);
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  console.log('🔍 DEBUG ProtectedRoute - Rendering componente per:', path);

  return (
    <Route path={path}>
      {(params) => (
        <PageTransition location={location}>
          {React.createElement(component, params)}
        </PageTransition>
      )}
    </Route>
  );
}