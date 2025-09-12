import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Header } from "./components/Header";
import { Title } from "./components/Title";
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
    <PageContainer className="bg-gradient-to-br from-purple-50 to-pink-100">
      <div className="w-full px-4 py-6 space-y-8">
        <Header />
        <Title />
        <SectionsGrid />
      </div>
    </PageContainer>
  );
}
