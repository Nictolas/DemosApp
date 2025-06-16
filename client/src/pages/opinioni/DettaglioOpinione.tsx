import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect, Link } from 'wouter';
import { Loader2, ArrowLeft, PersonStanding } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

// Registra i componenti di Chart.js una sola volta
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Definizione del tipo di dati che ci aspettiamo dal backend
type OpinionBreakdown = Record<string, { favorevole: number; contrario: number; astenuto: number }>;
interface DetailStats {
  gender: OpinionBreakdown;
  age: OpinionBreakdown;
  location: OpinionBreakdown;
}

// Mappa per i titoli delle pagine
const opinionTitles: Record<string, string> = {
  energia_nucleare: "Energia Nucleare",
  sperimentazione_animale: "Sperimentazione Animale",
  legalizzazione_canapa: "Legalizzazione Canapa",
  caccia: "Caccia",
  unione_europea: "Unione Europea"
};

// =========================================================
// IL COMPONENTE REACT
// =========================================================
export default function DettaglioOpinione({ opinionField }: { opinionField: string }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [stats, setStats] = useState<DetailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageTitle = opinionTitles[opinionField] || opinionField.replace(/_/g, ' ');

  // Funzione per recuperare i dati dal backend
  const fetchData = useCallback(async () => {
    if (!user || !opinionField) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/opinioni-dettaglio/${opinionField}`);
      if (!response.ok) {
        throw new Error(`Errore API: ${response.statusText}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setIsLoading(false);
    }
  }, [user, opinionField]);

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
      'donna': 'rgba(255, 99, 132, 0.7)',
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

  // Funzione per preparare i dati per il grafico a barre impilate
  const prepareGroupedBarData = (distribution: OpinionBreakdown | undefined) => {
    if (!distribution) return null;

    const labels = Object.keys(distribution).sort();
    const colors = {
      favorevole: 'rgba(75, 192, 192, 0.7)',
      contrario: 'rgba(255, 99, 132, 0.7)',
      astenuto: 'rgba(255, 206, 86, 0.7)',
    };

    return {
      labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [
        {
          label: 'Favorevoli',
          data: labels.map(key => distribution[key]?.favorevole || 0),
          backgroundColor: colors.favorevole,
        },
        {
          label: 'Contrari',
          data: labels.map(key => distribution[key]?.contrario || 0),
          backgroundColor: colors.contrario,
        },
        {
          label: 'Astenuti',
          data: labels.map(key => distribution[key]?.astenuto || 0),
          backgroundColor: colors.astenuto,
        }
      ]
    };
  };

  
  // Gestione degli stati di caricamento e autenticazione
  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-6xl">
        <Link href="/statistiche-opinioni"><Button variant="ghost" className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Torna alle Statistiche</Button></Link>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : stats ? (
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">{pageTitle}</CardTitle>
            <CardDescription>Visualizzazione dettagliata delle opinioni per demografia.</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader><CardTitle>Suddivisione per Genere</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Favorevoli</h3>
              <div style={{ height: '250px' }}>
                {stats.gender && prepareGenderPieData(stats.gender.favorevole) ? <Pie data={prepareGenderPieData(stats.gender.favorevole)!} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' }} }} /> : <p>Nessun dato</p>}
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-semibold mb-2">Contrari</h3>
              <div style={{ height: '250px' }}>
                {stats.gender && prepareGenderPieData(stats.gender.contrario) ? <Pie data={prepareGenderPieData(stats.gender.contrario)!} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' }} }} /> : <p>Nessun dato</p>}
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-semibold mb-2">Astenuti</h3>
              <div style={{ height: '250px' }}>
                {stats.gender && prepareGenderPieData(stats.gender.astenuto) ? <Pie data={prepareGenderPieData(stats.gender.astenuto)!} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' }} }} /> : <p>Nessun dato</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center"><PersonStanding className="mr-2 h-5 w-5"/>Riepilogo per Genere (Raggruppato)</CardTitle></CardHeader>
          <CardContent><div style={{height: '250px'}}><Bar data={prepareGroupedBarData(stats.gender)!} options={{ responsive: true, maintainAspectRatio: false }} /></div></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5"/>Distribuzione per Fascia d'Età</CardTitle></CardHeader>
          <CardContent><div style={{height: '300px'}}><Bar data={prepareGroupedBarData(stats.age)!} options={{ responsive: true, maintainAspectRatio: false }} /></div></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5"/>Distribuzione per Regione</CardTitle></CardHeader>
          <CardContent>
            <div style={{height: '400px'}}>
              <Bar data={prepareGroupedBarData(stats.location)!} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>

        </div> // <--- Il div principale si chiude qui
        ) : (
        <p>Nessun dato da mostrare.</p>
        )}
        </div>
        </div>
  );
}