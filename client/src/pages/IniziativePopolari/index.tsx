import React, { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { Header } from "./components/Header";
import { IniziativeTable } from "./components/IniziativeTable";
import { ViewDialog } from "./components/ViewDialog";
import { useIniziativeData } from "./hooks/useIniziativeData";
import { useIniziativeActions } from "./hooks/useIniziativeActions";
import { SearchAndFilters } from "./components/SearchAndFilters";
import { IniziativaPopolare } from "./types";
import { getDisplayableDate } from "@/utils/dateUtils";

type SortOption = "firme" | "scadenza" | null;

export default function IniziativePopolari() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("firme");

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

  // Filtra e ordina le iniziative (data_fine già salvata in DB)
  const filteredAndSortedIniziative = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    let filtered = iniziativeUfficiali.filter((iniziativa) => {
      const dataScadenza = getDisplayableDate(
        iniziativa.dataFine || iniziativa.data_fine
      );
      if (!dataScadenza) return false;
      const scadenzaStr =
        typeof dataScadenza === "string"
          ? dataScadenza.slice(0, 10)
          : new Date(dataScadenza).toISOString().slice(0, 10);
      // Nasconde le scadute: scadenza < oggi
      return scadenzaStr >= todayStr;
    });

    // Applica la ricerca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (iniziativa) =>
          iniziativa.nome?.toLowerCase().includes(query) ||
          iniziativa.descrizione?.toLowerCase().includes(query)
      );
    }

    // Applica l'ordinamento
    if (sortBy === "firme") {
      filtered.sort((a, b) => {
        const firmeA = a.firme || a.firme_raccolte || 0;
        const firmeB = b.firme || b.firme_raccolte || 0;
        return firmeB - firmeA; // Decrescente (più firme in alto)
      });
    } else if (sortBy === "scadenza") {
      filtered.sort((a, b) => {
        const dataFineA = getDisplayableDate(a.dataFine || a.data_fine);
        const dataFineB = getDisplayableDate(b.dataFine || b.data_fine);
        
        if (!dataFineA && !dataFineB) return 0;
        if (!dataFineA) return 1;
        if (!dataFineB) return -1;
        
        return new Date(dataFineA).getTime() - new Date(dataFineB).getTime();
      });
    }

    return filtered;
  }, [iniziativeUfficiali, searchQuery, sortBy]);


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
    <div className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain iniziative-popolari-page container mx-auto px-4 py-8" role="region" aria-label="Elenco iniziative popolari" tabIndex={0}>
      <Card className="w-full rounded-2xl shadow-lg bg-white">
        <CardContent className="p-6">
          <Header />
          
          {/* Barra di ricerca e filtri */}
          <SearchAndFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
          
          {/* Iniziative Ufficiali */}
          <IniziativeTable
            listaIniziative={filteredAndSortedIniziative}
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
    </PageContainer>
  );
}
