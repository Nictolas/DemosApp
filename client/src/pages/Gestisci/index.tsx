import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { SectionsGrid } from "./components/SectionsGrid";
import { PageContainer } from "@/components/PageContainer";

export default function Gestisci() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="menu-page flex flex-col bg-gradient-to-b from-blue-50 to-white select-none">
      <div className="w-full px-4 py-4 flex-1 flex flex-col">
        <div className="w-full flex-1 flex flex-col min-h-0">
          <div className="mt-4">
            <SectionsGrid />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
