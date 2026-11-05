import React, { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { Header } from "./components/Header";
import { ReferendumTable } from "./components/ReferendumTable";
import { ViewDialog } from "./components/ViewDialog";
import { useReferendumData } from "./hooks/useReferendumData";
import { useReferendumActions } from "./hooks/useReferendumActions";

export default function ReferendumAbrogativi() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const deepLinkHandled = useRef(false);

  const { 
    listaReferendum,
    referendumUfficiali,
    mieiVoti, 
    isLoading, 
    isError
  } = useReferendumData(user);
  const {
    state,
    startEditView,
    closeView
  } = useReferendumActions();


  // Dopo un tap FCM apre il dettaglio ufficiale, oppure resta sull'elenco.
  useEffect(() => {
    if (deepLinkHandled.current || isLoading || isError || !user) return;
    const id = new URLSearchParams(window.location.search).get("initiative");
    if (!id) return;
    deepLinkHandled.current = true;
    const item = referendumUfficiali.find(
      entry => String(entry.id_ministero ?? entry.id) === id
    );
    if (item) startEditView(item);
  }, [referendumUfficiali, isLoading, isError, user]);

  // Redirect se non autenticato
  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <PageContainer className="overflow-hidden">
    <div className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain container mx-auto px-4 py-8" role="region" aria-label="Elenco referendum abrogativi" tabIndex={0}>
      <Card className="w-full rounded-2xl shadow-lg bg-white">
        <CardContent className="p-6">
          <Header />
          
          {/* Referendum Ufficiali */}
          <ReferendumTable
            listaReferendum={referendumUfficiali}
            mieiVoti={mieiVoti}
            isLoading={isLoading}
            isError={isError}
            onView={startEditView}
          />
        </CardContent>
      </Card>

      <ViewDialog
        referendum={state.viewReferendum}
        onClose={closeView}
      />
    </div>
    </PageContainer>
  );
}
