import React, { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "./components/Header";
import { IniziativeTable } from "./components/IniziativeTable";
import { ViewDialog } from "./components/ViewDialog";
import { useIniziativeData } from "./hooks/useIniziativeData";
import { useIniziativeActions } from "./hooks/useIniziativeActions";
import { SearchAndFilters } from "./components/SearchAndFilters";
import { IniziativaPopolare } from "./types";

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

  // Filtra e ordina le iniziative
  const filteredAndSortedIniziative = useMemo(() => {
    let filtered = [...iniziativeUfficiali];

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
        const dataFineA = a.dataFine || a.data_fine;
        const dataFineB = b.dataFine || b.data_fine;
        
        // Se una non ha data, mettila in fondo
        if (!dataFineA && !dataFineB) return 0;
        if (!dataFineA) return 1;
        if (!dataFineB) return -1;
        
        // Ordina per data di scadenza crescente (più vicine in alto)
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
    <div className="container mx-auto px-4 py-8">
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
  );
}
