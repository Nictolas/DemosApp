import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect, Link } from 'wouter';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useLocation } from "wouter"; // Aggiungi questo import

// Registra i componenti di Chart.js una sola volta
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ITALIAN_REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", 
  "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche", "Molise",
  "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana", "Trentino-Alto Adige",
  "Umbria", "Valle d'Aosta", "Veneto"
];

const formatRegionForUrl = (region: string) => 
  region.toLowerCase().replace(/ /g, '-').replace(/'/g, '');

// Definizione del tipo di dati che ci aspettiamo dal backend
interface DetailStats {
  genderDistributionByOpinion: {
    favorevole: Record<string, number>;
    contrario: Record<string, number>;
    astenuto: Record<string, number>;
  };
  ageDistributionByOpinion?: {
    favorevole: Record<string, number>;
    contrario: Record<string, number>;
    astenuto: Record<string, number>;
  };
}

// Mappa per i titoli delle pagine
const opinionTitles: Record<string, string> = {
  energia_nucleare: "Energia Nucleare",
  sperimentazione_animale: "Sperimentazione Animale",
  legalizzazione_canapa: "Legalizzazione Canapa",
  caccia: "Caccia",
  unione_europea: "Unione Europea"
};

// IL COMPONENTE REACT
  export default function DettaglioOpinione({ opinionField }: { opinionField: string }) { // Rimuovi regionName dalle props
    const { user, isLoading: isAuthLoading } = useAuth();
    const [stats, setStats] = useState<DetailStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [, setLocation] = useLocation();
    const searchParams = new URLSearchParams(window.location.search);
    const regionName = searchParams.get('regione');

  const basePageTitle = opinionTitles[opinionField] || opinionField.replace(/_/g, ' ');
  const pageTitle = regionName 
    ? `${basePageTitle} - ${regionName.charAt(0).toUpperCase() + regionName.slice(1).replace(/-/g, ' ')}` 
    : basePageTitle;

  // Funzione per recuperare i dati dal backend
    const fetchData = useCallback(async () => {
      if (!user || !opinionField) return;
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.append('opinion', opinionField); // Aggiunge ?opinion=...

        if (regionName) {
          const formattedRegionName = regionName.charAt(0).toUpperCase() + regionName.slice(1).replace(/-/g, ' ');
          params.append('regione', formattedRegionName); // Aggiunge ®ione=...
        }

        const apiUrl = `/api/opinioni-dettaglio?${params.toString()}`;

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Errore API: ${response.statusText}`);
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore sconosciuto");
      } finally {
        setIsLoading(false);
      }
    }, [user, opinionField, regionName]);

  // Esegui il fetch dei dati quando il componente si monta
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Funzione per preparare i dati per i grafici a torta
  const prepareGenderPieData = (data: Record<string, number>) => {
    if (!data || Object.keys(data).length === 0) return null;

    const labels = Object.keys(data).map(key => key.charAt(0).toUpperCase() + key.slice(1));
    const values = Object.values(data);

    const genderColors: Record<string, string> = {
      'uomo': 'rgba(54, 162, 235, 0.7)',
      'donna': 'rgba(255, 182, 193, 0.7)',
      'altro': 'rgba(255, 206, 86, 0.7)',
      'non specificato': 'rgba(201, 203, 207, 0.7)'
    };

    const backgroundColors = Object.keys(data).map(label => genderColors[label.toLowerCase()] || genderColors['non specificato']);

    return { 
      labels, 
      datasets: [{ 
        data: values, 
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map(c => c.replace('0.7', '1')),
        borderWidth: 1,
      }] 
    };
  };

  // Funzione per preparare i dati per il grafico a barre impilate per genere
  const prepareStackedBarData = () => {
    if (!stats) return null;
    const { favorevole, contrario, astenuto } = stats.genderDistributionByOpinion;
    const allGenders = [...new Set([...Object.keys(favorevole), ...Object.keys(contrario), ...Object.keys(astenuto)])];

    const genderColors: Record<string, string> = {
      'uomo': 'rgba(54, 162, 235, 0.7)',
      'donna': 'rgba(255, 182, 193, 0.7)',
      'altro': 'rgba(255, 206, 86, 0.7)',
      'non specificato': 'rgba(201, 203, 207, 0.7)'
    };

    return {
      labels: ['Favorevoli', 'Contrari', 'Astenuti'],
      datasets: allGenders.map(gender => ({
        label: gender.charAt(0).toUpperCase() + gender.slice(1),
        data: [
          favorevole[gender] || 0,
          contrario[gender] || 0,
          astenuto[gender] || 0,
        ],
        backgroundColor: genderColors[gender.toLowerCase()] || genderColors['non specificato'],
      })),
    };
  };

  // Funzione per preparare i dati per il grafico a barre per età
  const prepareAgeGroupedBarData = () => {
    if (!stats || !stats.ageDistributionByOpinion) return null;
    const { favorevole, contrario, astenuto } = stats.ageDistributionByOpinion;

    const allAgeRanges = Array.from(
      new Set([...Object.keys(favorevole), ...Object.keys(contrario), ...Object.keys(astenuto)])
    ).sort();

    if (allAgeRanges.length === 0) return null;

    return {
      labels: allAgeRanges,
      datasets: [
        {
          label: 'Favorevole',
          data: allAgeRanges.map(range => favorevole[range] || 0),
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
        },
        {
          label: 'Contrario',
          data: allAgeRanges.map(range => contrario[range] || 0),
          backgroundColor: 'rgba(255, 99, 132, 0.7)', // Colore rosso/rosa coerente
        },
        {
          label: 'Astenuto',
          data: allAgeRanges.map(range => astenuto[range] || 0),
          backgroundColor: 'rgba(201, 203, 207, 0.7)', // Colore grigio
        },
      ],
    };
  };

  const stackedBarData = prepareStackedBarData();
  const ageGroupedBarData = prepareAgeGroupedBarData();

  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href={regionName ? `/opinioni/${opinionField}` : "/statistiche-opinioni"}>
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> 
            {regionName ? `Torna a ${basePageTitle}` : "Torna alle Statistiche"}
          </Button>
        </Link>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : stats ? (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl font-bold">{pageTitle}</CardTitle>
                <CardDescription>
                  {regionName 
                    ? `Analisi dettagliata per la regione selezionata.`
                    : `Analisi dettagliata delle opinioni. Seleziona una regione per un'analisi più specifica.`}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Grafico per età */}
            {ageGroupedBarData && (
              <Card>
                <CardHeader>
                  <CardTitle>Suddivisione per Fascia d'Età</CardTitle>
                  <CardDescription>Confronto delle opinioni tra le diverse fasce d'età.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <Bar 
                      data={ageGroupedBarData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'top' } },
                        scales: {
                          y: { beginAtZero: true, title: { display: true, text: 'Numero di Voti' } },
                          x: { title: { display: true, text: "Fasce d'Età" } }
                        },
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grafici per genere */}
            {stats.genderDistributionByOpinion && (
              <Card>
                <CardHeader>
                    <CardTitle>Distribuzione per Genere e Opinione</CardTitle>
                    <CardDescription>Come si distribuiscono i generi per ogni tipo di opinione.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">Favorevoli</h3>
                    <div className="h-[250px]">
                      {prepareGenderPieData(stats.genderDistributionByOpinion.favorevole) ? <Pie data={prepareGenderPieData(stats.genderDistributionByOpinion.favorevole)!} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' }} }} /> : <p>Nessun dato</p>}
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">Contrari</h3>
                    <div className="h-[250px]">
                      {prepareGenderPieData(stats.genderDistributionByOpinion.contrario) ? <Pie data={prepareGenderPieData(stats.genderDistributionByOpinion.contrario)!} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' }} }} /> : <p>Nessun dato</p>}
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">Astenuti</h3>
                    <div className="h-[250px]">
                      {prepareGenderPieData(stats.genderDistributionByOpinion.astenuto) ? <Pie data={prepareGenderPieData(stats.genderDistributionByOpinion.astenuto)!} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' }} }} /> : <p>Nessun dato</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grafico di riepilogo per genere */}
            {stackedBarData && (
                 <Card>
                   <CardHeader><CardTitle>Riepilogo Complessivo per Genere</CardTitle></CardHeader>
                   <CardContent>
                     <div className="h-[200px]">
                       <Bar 
                         data={stackedBarData} 
                         options={{
                           indexAxis: 'y',
                           responsive: true,
                           maintainAspectRatio: false,
                           scales: { x: { stacked: true }, y: { stacked: true } }
                         }}
                       />
                     </div>
                   </CardContent>
                 </Card>
            )}

            {/* Sezione Filtra per Regione spostata qui in fondo */}
            {!regionName && (
              <Card>
                <CardHeader>
                  <CardTitle>Filtra per Regione</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {ITALIAN_REGIONS.map(region => (
                    <Link key={region} href={`/opinioni/${opinionField}?regione=${formatRegionForUrl(region)}`}>
                      <Button variant="outline">{region}</Button>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

          </div>
        ) : (
          <p>Nessun dato da mostrare.</p>
        )}
      </div>
    </div>
  );
}