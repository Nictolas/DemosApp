import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { SectionsGrid } from "./components/SectionsGrid";
import { PageContainer } from "@/components/PageContainer";
import { hasAdminCapability, hasDpoCapability } from "@/lib/admin-access";

export default function Gestisci() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </PageContainer>
    );
  }

  if (!user) return <Redirect to="/auth" />;

  const isAdmin = hasAdminCapability(user);
  const isDpo = hasDpoCapability(user);

  if (!isAdmin && !isDpo) return <Redirect to="/preferiti" />;

  return (
    <PageContainer className="menu-page flex flex-col bg-[radial-gradient(circle_at_top_left,_#eef4ff_0%,_#f8fbff_35%,_#ffffff_70%)]">
      <div className="w-full px-4 py-4 flex-1 flex flex-col">
        <SectionsGrid dpoReadOnly={!isAdmin && isDpo} />
      </div>
    </PageContainer>
  );
}
