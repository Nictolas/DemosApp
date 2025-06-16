// =========================================================
// 1. BLOCCO DEGLI IMPORT (ORGANIZZATO CORRETTAMENTE)
// =========================================================
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect, Link } from 'wouter';
import { Loader2, ArrowLeft, BarChart3, Users, MapPin, PersonStanding } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, Pie } from 'react-chartjs-2';
// (Chart.js viene registrato altrove, quindi non serve qui)

// =========================================================
// 2. DEFINIZIONI DEI TIPI (FUORI DAL COMPONENTE)
// =========================================================
interface DetailStats {
  total: number;
  favorevoli: number;
  contrari: number;
  astenuti: number;
  ageDistribution: Record<string, number>;
  genderDistribution: Record<string, number>;
  locationDistribution: Record<string, number>;
}

const opinionTitles: Record<string, string> = {
  energia_nucleare: "Energia Nucleare",
  sperimentazione_animale: "Sperimentazione Animale",
  legalizzazione_canapa: "Legalizzazione Canapa",
  caccia: "Caccia",
  unione_europea: "Unione Europea"
};

// =========================================================
// 3. IL COMPONENTE REACT
// =========================================================
export default function DettaglioOpinione({ opinionField }: { opinionField: string }) {
  const { user, isLoading: isAuthLoading } = useAuth();

  // STATO CORRETTO CON IL TIPO DetailStats
  const [stats, setStats] = useState<DetailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useEffect e le altre funzioni rimangono dentro il componente
  useEffect(() => {
    if (user && opinionField) {
      const fetchDetails = async () => {
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
      };
      fetchDetails();
    }
  }, [user, opinionField]);

  if (isAuthLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const pageTitle = opinionTitles[opinionField] || opinionField.replace(/_/g, ' ');

  const prepareChartData = (distribution: Record<string, number>) => {
    const labels = Object.keys(distribution).sort();
    const data = labels.map(label => distribution[label]);
    return {
      labels,
      datasets: [{
        label: 'Numero di Utenti',
        data,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      }]
    };
  };

  const prepareGenderPieChartData = () => {
    if (!stats || !stats.genderDistribution) return null;

    const labels = Object.keys(stats.genderDistribution);
    const data = Object.values(stats.genderDistribution);

    const genderColors: Record<string, string> = {
      'uomo': 'rgba(54, 162, 235, 0.7)',
      'donna': 'rgba(255, 99, 132, 0.7)',
      'altro': 'rgba(255, 206, 86, 0.7)',
      'non specificato': 'rgba(201, 203, 207, 0.7)'
    };

    const backgroundColors = labels.map(label => genderColors[label.toLowerCase()] || genderColors['non specificato']);
    const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));

    return {
      labels,
      datasets: [{
        label: 'Distribuzione per Genere',
        data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
      }]
    };
  };

  const ageChartData = stats ? prepareChartData(stats.ageDistribution) : null;
  const locationChartData = stats ? prepareChartData(stats.locationDistribution) : null;
  const genderPieData = prepareGenderPieChartData();
  
  // Il JSX per la visualizzazione rimane qui
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/statistiche-opinioni">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna alle Statistiche
          </Button>
        </Link>

        {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : error ? (
            <p className="text-center text-red-500">{error}</p>
        ) : stats ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl font-bold">{pageTitle}</CardTitle>
                <CardDescription>Statistiche dettagliate sull'opinione riguardo {pageTitle.toLowerCase()}.</CardDescription>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <Card><CardHeader><CardTitle>{stats.favorevoli}</CardTitle><CardDescription>Favorevoli</CardDescription></CardHeader></Card>
                <Card><CardHeader><CardTitle>{stats.astenuti}</CardTitle><CardDescription>Astenuti</CardDescription></CardHeader></Card>
                <Card><CardHeader><CardTitle>{stats.contrari}</CardTitle><CardDescription>Contrari</CardDescription></CardHeader></Card>
            </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center"><PersonStanding className="mr-2"/>Distribuzione per Genere</CardTitle></CardHeader>
          <CardContent>
            {genderPieData && (
              <div style={{height: '300px', width: '100%', maxWidth: '300px', margin: 'auto'}}>
                <Pie 
                  data={genderPieData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center"><Users className="mr-2"/>Distribuzione per Età</CardTitle></CardHeader>
          {/* RIGA CORRETTA */}
          <CardContent><div style={{height: '300px'}}>{ageChartData && <Bar data={ageChartData} options={{ responsive: true, maintainAspectRatio: false }} />}</div></CardContent>
        </Card>
      </div>

            <Card>
              <CardHeader><CardTitle className="flex items-center"><MapPin className="mr-2"/>Distribuzione per Regione</CardTitle></CardHeader>
      <CardContent><div style={{height: '400px'}}>{locationChartData && <Bar data={locationChartData} options={{ responsive: true, maintainAspectRatio: false }} />}</div></CardContent>

          </div>
        ) : (
          <p>Nessun dato da mostrare.</p>
        )}
      </div>
    </div>
  );
}