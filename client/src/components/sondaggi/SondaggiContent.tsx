import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useSondaggiData } from "./useSondaggiData";
import { useSondaggiCharts } from "./useSondaggiCharts";
import { SondaggiHeader } from "./SondaggiHeader";
import { SondaggiStats } from "./SondaggiStats";
import { SondaggiFilters } from "./SondaggiFilters";
import { SondaggiCharts } from "./SondaggiCharts";
import { GenereChart } from "./GenereChart";

interface SondaggiContentProps {
  filterPath?: string; // es: "toscana", "toscana/firenze", "toscana/firenze/firenze"
}

export default function SondaggiContent({ filterPath }: SondaggiContentProps) {
  const {
    data,
    genereData,
    isLoading,
    isError,
    getProvinceForRegion,
    getComuniForProvincia,
    getPageTitle,
    getBreadcrumb,
  } = useSondaggiData(filterPath);

  const { stats, questions = [], utentiUnici = 0, filter } = data || {};
  
  const {
    COLORS,
    GENERE_COLORS,
    preparePieData,
    barChartData,
    prepareGenerePieData,
    aggregateStats,
  } = useSondaggiCharts(stats, questions);

  // Prepara dati per i filtri geografici
  const provinceForRegion = filter?.type === 'regione' && filter.value 
    ? getProvinceForRegion(filter.value) 
    : [];

  const comuniForProvincia = filter?.type === 'provincia' && filter.regione && filter.provincia
    ? getComuniForProvincia(filter.regione, filter.provincia)
    : [];

  // Prepara dati per il grafico del genere
  const generePieData = prepareGenerePieData(genereData);

  return (
    <div className={filterPath ? "min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-y-auto" : ""}>
      <div className={filterPath ? "w-full px-4 lg:px-8 py-6" : ""}>
        {/* Header con navigazione */}
        <SondaggiHeader
          filterPath={filterPath}
          pageTitle={getPageTitle()}
          breadcrumbItems={getBreadcrumb() || []}
          filter={filter}
        />

        {/* Loading e Error States */}
        {isLoading && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Caricamento statistiche...</p>
            </div>
          </div>
        )}
        
        {isError && (
          <Card className="bg-white shadow-lg border-red-200">
            <CardContent className="p-8 text-center">
              <div className="text-red-500 text-xl mb-2">⚠️</div>
              <p className="text-red-600 font-medium">Errore nel caricamento delle statistiche.</p>
              <p className="text-gray-500 mt-2">Riprova più tardi o contatta l'amministratore.</p>
            </CardContent>
          </Card>
        )}

        {/* Contenuto principale */}
        {!isLoading && !isError && stats && (
          <div className="space-y-8">
            {/* Statistiche generali - solo se c'è un filtro */}
            {filterPath && (
              <SondaggiStats
                totalQuestions={aggregateStats.totalQuestions}
                totalVotes={aggregateStats.totalVotes}
                totalUsers={utentiUnici}
              />
            )}

            {/* Filtri geografici */}
            <SondaggiFilters
              filterPath={filterPath}
              filter={filter}
              provinceForRegion={provinceForRegion}
              comuniForProvincia={comuniForProvincia}
            />

            {/* Grafici principali */}
            <SondaggiCharts
              questions={questions}
              barChartData={barChartData}
              preparePieData={preparePieData}
              colors={COLORS}
            />

            {/* Grafico a torta del genere */}
            <GenereChart
              genereData={genereData}
              colors={GENERE_COLORS}
            />
          </div>
        )}
        
        {/* Messaggio se non ci sono dati e non sta caricando */}
        {!isLoading && !isError && !stats && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">Nessun dato disponibile al momento.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
