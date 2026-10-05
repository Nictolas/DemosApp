import React from "react";
import { useOpinionId } from "./hooks/useOpinionId";
import { useAccessControl } from "./hooks/useAccessControl";
import { useOpinionStats } from "./hooks/useOpinionStats";
import { useEtaStats } from "./hooks/useEtaStats";
import { useGenereStats } from "./hooks/useGenereStats";
import { Header } from "./components/Header";
import { StatsOverview } from "./components/StatsOverview";
import { RegionButtons } from "./components/RegionButtons";
import { PieChartComponent } from "./components/PieChart";
import { BarChartComponent } from "./components/BarChart";
import { LoadingState, AuthLoadingState, ErrorState, UnauthorizedState } from "./components/LoadingStates";
import { OpinionSelector } from "./components/OpinionSelector";
import { GenereChart } from "./components/GenereChart";
import { PieDataItem, BarDataItem } from "./types";

export default function StatisticheOpinione() {
  const opinionId = useOpinionId();
  const { user, isAuthLoading, hasAdvancedAccess } = useAccessControl();
  const { data, isLoading, isError } = useOpinionStats(opinionId);
  const { data: etaData } = useEtaStats(opinionId);
  const { data: genereData } = useGenereStats(opinionId);

  if (isAuthLoading) return <AuthLoadingState />;
  if (!user) return <UnauthorizedState />;
  if (!hasAdvancedAccess) return <UnauthorizedState />;

  // Se non c'è un opinionId, mostra il selettore delle opinioni
  if (!opinionId) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar" style={{ paddingBottom: '6rem' }}>
        <div className="container mx-auto max-w-7xl p-6">
          <OpinionSelector />
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const questionText = data?.questionText || 'Opinione';
  const totaleUtenti = data?.totaleUtenti || 0;

  // Calcola il totale voti correttamente (solo chi ha risposto)
  const totalVotes = (parseInt(stats.favorevole) || 0) + (parseInt(stats.contrario) || 0) + (parseInt(stats.indeciso) || 0);

  const pieData: PieDataItem[] = [
    { name: 'Favorevole', value: parseInt(stats.favorevole) || 0 },
    { name: 'Contrario', value: parseInt(stats.contrario) || 0 },
    { name: 'Indeciso', value: parseInt(stats.indeciso) || 0 },
  ];

  // Prepara dati per età (bar chart orizzontale)
  console.log('🔍 DEBUG - etaData raw:', etaData);
  const etaBarData: BarDataItem[] = etaData?.map(item => {
    console.log('🔍 DEBUG - Processing eta item:', item);
    return {
      name: item.fascia_eta,
      Favorevole: parseInt(item.favorevole) || 0,
      Indeciso: parseInt(item.indeciso) || 0,
      Contrario: parseInt(item.contrario) || 0,
      Astenuto: parseInt(item.astenuto) || 0,
    };
  }) || [];
  console.log('🔍 DEBUG - etaBarData processed:', etaBarData);

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar" style={{ paddingBottom: '6rem' }}>
      <div className="container mx-auto max-w-7xl p-6">
        {/* Header con navigazione */}
        <Header questionText={questionText} />

        {isLoading && <LoadingState />}
        {isError && <ErrorState />}

        {data && (
          <div className="space-y-8">
            {/* Statistiche generali */}
            <StatsOverview stats={stats} totaleUtenti={totaleUtenti} />

            {/* Pulsanti per statistiche regionali */}
            <RegionButtons opinionId={opinionId} />

            {/* Grafico principale - TORTA */}
            <PieChartComponent pieData={pieData} />

            {/* Grafico età - BARRE ORIZZONTALI */}
            <BarChartComponent etaBarData={etaBarData} />

            {/* Grafico genere */}
            {console.log('🔍 DEBUG - genereData raw:', genereData)}
            <GenereChart genereData={genereData} />
          </div>
        )}
      </div>
    </div>
  );
}
