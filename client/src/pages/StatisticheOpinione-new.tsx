import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  StatsHeader, 
  StatsOverview, 
  StatsPieChart, 
  StatsBarChart, 
  StatsRegionalButtons, 
  StatsLoading, 
  StatsError,
  COLORS,
  GENERE_COLORS,
  calculateTotalVotes,
  preparePieData,
  prepareGenereBarData,
  prepareEtaBarData,
  prepareGenerePieData,
  extractOpinionId,
  isRegionalPage,
  getRegionFromUrl
} from "@/components/statistiche-opinione";

export default function StatisticheOpinione() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Estrai l'ID dell'opinione dall'URL
  const opinionId = extractOpinionId();
  console.log('🔍 DEBUG StatisticheOpinione - OpinionId estratto:', opinionId);

  // Query per statistiche generali
  const { data, isLoading, isError } = useQuery({
    queryKey: ['opinioneStats', opinionId, window.location.pathname],
    queryFn: async () => {
      let endpoint = `/api/opinioni/stats/${opinionId}`;
      
      // Se l'URL contiene "regione", usa l'endpoint filtrato
      if (isRegionalPage()) {
        const regione = getRegionFromUrl();
        endpoint = `/api/opinioni/stats/${opinionId}/regione/${regione}`;
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint stats regionale:', endpoint);
      } else {
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint stats nazionale:', endpoint);
      }
      
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) throw new Error("Errore nel caricamento delle statistiche.");
      const result = await response.json();
      console.log('🔍 DEBUG StatisticheOpinione - Dati stats ricevuti:', result.data);
      return result.data;
    },
    enabled: !!user && !!opinionId,
  });

  // Query per statistiche per genere (filtrate in base al contesto)
  const { data: genereData } = useQuery({
    queryKey: ['opinioneStatsGenere', opinionId, window.location.pathname],
    queryFn: async () => {
      let endpoint = `/api/opinioni/stats/${opinionId}/genere`;
      
      // Se l'URL contiene "regione", usa l'endpoint filtrato
      if (isRegionalPage()) {
        const regione = getRegionFromUrl();
        endpoint = `/api/opinioni/stats/${opinionId}/genere/${regione}`;
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint genere regionale:', endpoint);
      } else {
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint genere nazionale:', endpoint);
      }
      
      const response = await apiRequest("GET", endpoint, null, {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      if (!response.ok) throw new Error("Errore nel caricamento statistiche genere.");
      const result = await response.json();
      console.log('🔍 DEBUG StatisticheOpinione - Dati genere ricevuti:', result.data);
      return result.data;
    },
    enabled: !!user && !!opinionId,
    staleTime: 0,
    cacheTime: 0,
  });

  // Query per statistiche per età
  const { data: etaData } = useQuery({
    queryKey: ['opinioneStatsEta', opinionId, window.location.pathname],
    queryFn: async () => {
      let endpoint = `/api/opinioni/stats/${opinionId}/eta`;
      
      // Se l'URL contiene "regione", usa l'endpoint filtrato
      if (isRegionalPage()) {
        const regione = getRegionFromUrl();
        endpoint = `/api/opinioni/stats/${opinionId}/eta/${regione}`;
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint età regionale:', endpoint);
      } else {
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint età nazionale:', endpoint);
      }
      
      const response = await apiRequest("GET", endpoint, null, {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      if (!response.ok) throw new Error("Errore nel caricamento statistiche età.");
      const result = await response.json();
      console.log('🔍 DEBUG StatisticheOpinione - Dati età ricevuti:', result.data);
      return result.data;
    },
    enabled: !!user && !!opinionId,
    staleTime: 0,
    cacheTime: 0,
  });

  // Query per il testo della domanda
  const { data: questionData } = useQuery({
    queryKey: ['opinioneQuestion', opinionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/opinioni/${opinionId}`);
      if (!response.ok) throw new Error("Errore nel caricamento della domanda.");
      const result = await response.json();
      return result.data;
    },
    enabled: !!user && !!opinionId,
  });

  // Calcoli e preparazione dati
  const stats = data?.stats || {};
  const totaleUtenti = data?.totale_utenti || 0;
  const totalVotes = calculateTotalVotes(stats);
  
  // Prepara i dati per i grafici
  const pieData = preparePieData(stats);
  const genereBarData = prepareGenereBarData(genereData);
  const etaBarData = prepareEtaBarData(etaData);
  const generePieData = prepareGenerePieData(genereData);

  const questionText = questionData?.text || "Statistiche Opinione";

  const handleBack = () => {
    setLocation("/sondaggi");
  };

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar" style={{ paddingBottom: '6rem' }}>
      <div className="container mx-auto max-w-7xl p-6">
        {/* Header con navigazione */}
        <StatsHeader questionText={questionText} onBack={handleBack} />

        {/* Stati di caricamento e errore */}
        <StatsLoading isLoading={isLoading} />
        <StatsError isError={isError} />

        {data && (
          <div className="space-y-8">
            {/* Statistiche generali */}
            <StatsOverview 
              stats={stats}
              totaleUtenti={totaleUtenti}
              totalVotes={totalVotes}
            />

            {/* Pulsanti per statistiche regionali */}
            <StatsRegionalButtons 
              opinionId={opinionId}
              onNavigate={handleNavigate}
            />

            {/* Grafico principale - TORTA */}
            <StatsPieChart 
              data={pieData}
              title="Distribuzione Voti"
              colors={COLORS}
            />

            {/* Grafico per genere - BARRE ORIZZONTALI */}
            <StatsBarChart 
              data={genereBarData}
              title="Distribuzione per Genere"
              dataKeys={["uomo", "donna", "altro"]}
              colors={GENERE_COLORS}
              layout="horizontal"
            />

            {/* Grafico per età */}
            <StatsBarChart 
              data={etaBarData}
              title="Distribuzione per Età"
              dataKeys={["Favorevole", "Indeciso", "Contrario", "Astenuto"]}
              colors={COLORS}
              layout="horizontal"
            />

            {/* Grafico a torta del genere */}
            {generePieData.length > 0 && (
              <StatsPieChart 
                data={generePieData}
                title="Distribuzione per Genere"
                colors={GENERE_COLORS}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
