import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SectionsGrid } from "./components/SectionsGrid";
import { PageContainer } from "@/components/PageContainer";
import { hasAdminCapability, hasDpoCapability } from "@/lib/admin-access";

export default function Gestisci() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

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

  const isAdmin = hasAdminCapability(user);
  const isDpo = hasDpoCapability(user);
  if (!isAdmin && !isDpo) {
    return <Redirect to="/menu" />;
  }

  return (
    <PageContainer className="menu-page flex flex-col bg-[radial-gradient(circle_at_top_left,_#eef4ff_0%,_#f8fbff_35%,_#ffffff_70%)] select-none">
      <div className="w-full px-4 py-4 flex-1 flex flex-col">
        <div className="w-full flex-1 flex flex-col min-h-0 space-y-5">
          {!isAdmin && (
            <div className="mt-2 rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm">
              <h1 className="text-2xl font-bold text-slate-900">Area DPO</h1>
              <p className="mt-1 text-sm text-slate-600">
                Supervisione della privacy in sola lettura.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setLocation("/dpo")}
            className="group relative w-full max-w-sm rounded-2xl border border-white/60 bg-white/90 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            data-testid="gestisci-dpo"
            aria-label="Apri Pannello DPO"
          >
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="block text-base font-semibold text-slate-900">Pannello DPO</span>
            <span className="mt-2 block text-xs text-slate-600">
              Consulta il riepilogo privacy e le informazioni aggregate.
            </span>
            <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </button>
          <SectionsGrid dpoReadOnly={!isAdmin && isDpo} />
        </div>
      </div>
    </PageContainer>
  );
}
