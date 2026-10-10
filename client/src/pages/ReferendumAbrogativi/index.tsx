import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "./components/Header";
import { ReferendumTable } from "./components/ReferendumTable";
import { ViewDialog } from "./components/ViewDialog";
import { useReferendumData } from "./hooks/useReferendumData";
import { useReferendumActions } from "./hooks/useReferendumActions";

export default function ReferendumAbrogativi() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { 
    referendumUfficiali,
    isLoading, 
    isError
  } = useReferendumData(user);
  const {
    state,
    startEditView,
    closeView
  } = useReferendumActions();


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
          
          {/* Referendum Ufficiali */}
          <ReferendumTable
            listaReferendum={referendumUfficiali}
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
  );
}
