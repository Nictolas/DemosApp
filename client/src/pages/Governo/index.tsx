import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useGovernoData } from "./hooks/useGovernoData";
import { useGovernoActions } from "./hooks/useGovernoActions";
import { MinisteroCard } from "./components/MinisteroCard";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { ministeri, colorMap } from "./constants/ministeri";

export default function Governo() {
  const authReady = useAuthReady();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const { data, isLoading, isError } = useGovernoData(user);
  const { handleNavigateToMinistero } = useGovernoActions();

  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
        <div className="container mx-auto max-w-4xl">
          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ministeri.map((ministero) => (
                <MinisteroCard
                  key={ministero.id}
                  ministero={ministero}
                  data={data}
                  onNavigate={handleNavigateToMinistero}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
