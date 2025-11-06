import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "./components/Header";
import { IniziativeTable } from "./components/IniziativeTable";
import { ViewDialog } from "./components/ViewDialog";
import { useIniziativeData } from "./hooks/useIniziativeData";
import { useIniziativeActions } from "./hooks/useIniziativeActions";
import { IniziativeStatsChart } from "./components/IniziativeStatsChart";

export default function IniziativePopolari() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { 
    listaIniziative, 
    iniziativeUfficiali,
    mieiVoti, 
    isLoading, 
    isError
  } = useIniziativeData(user);
  const {
    state,
    startEditView,
    closeView
  } = useIniziativeActions();


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
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full rounded-2xl shadow-lg bg-white">
        <CardContent className="p-6">
          <Header />
          
          <IniziativeStatsChart listaIniziative={listaIniziative} />
          
          {/* Iniziative Ufficiali */}
          <IniziativeTable
            listaIniziative={iniziativeUfficiali}
            mieiVoti={mieiVoti}
            isLoading={isLoading}
            isError={isError}
            onView={startEditView}
          />
        </CardContent>
      </Card>

      <ViewDialog
        iniziativa={state.viewIniziativa}
        onClose={closeView}
      />
    </div>
  );
}
