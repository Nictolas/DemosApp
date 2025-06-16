import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart } from "lucide-react";
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type OpinionData = { favorevole: number; contrario: number; astenuto: number; };
type OpinionStats = Record<string, OpinionData>;
type OpinionKey = "energia_nucleare" | "sperimentazione_animale" | "legalizzazione_canapa" | "caccia" | "unione_europea";

export default function StatisticheOpinioni() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<OpinionStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const opinionQuestions: Record<OpinionKey, string> = {
    energia_nucleare: "Energia Nucleare",
    sperimentazione_animale: "Sperimentazione Animale",
    legalizzazione_canapa: "Legalizzazione Canapa",
    caccia: "Caccia",
    unione_europea: "Unione Europea"
  };

  const backgroundColors = { favorevole: 'rgba(75, 192, 192, 0.6)', astenuto: 'rgba(255, 206, 86, 0.6)', contrario: 'rgba(255, 99, 132, 0.6)' };
  const borderColors = { favorevole: 'rgba(75, 192, 192, 1)', astenuto: 'rgba(255, 206, 86, 1)', contrario: 'rgba(255, 99, 132, 1)' };

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    setError(null);
    try {
      const response = await fetch('/api/statistiche-opinioni');
      if (!response.ok) {
        throw new Error(`Errore API: ${response.status} ${response.statusText}`);
      }

      const users: any[] = await response.json();

      const initialStats: OpinionStats = {};
      Object.keys(opinionQuestions).forEach(key => {
        initialStats[key] = { favorevole: 0, contrario: 0, astenuto: 0 };
      });

      users.forEach(user => {
        Object.keys(opinionQuestions).forEach(question => {
          const opinion = user[question as OpinionKey];

          // La condizione controlla il valore con la maiuscola, come arriva dal DB
          if (typeof opinion === 'string' && ['Favorevole', 'Contrario', 'Indeciso'].includes(opinion)) {

            // MA per aggiornare il nostro stato, usiamo la versione in minuscolo
            // e convertiamo "Indeciso" in "astenuto"
            const keyToIncrement = (opinion === 'Indeciso' ? 'astenuto' : opinion.toLowerCase()) as OpinionValue;

            initialStats[question][keyToIncrement]++;
          }
        });
      });
      setStats(initialStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento delle statistiche");
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, fetchStats]);

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;

  const preparePieChartData = (questionKey: OpinionKey) => {
    if (!stats) return null;
    const questionStats = stats[questionKey];
    const labels = ['Favorevole', 'Contrario', 'Astenuto'];
    const data = [questionStats.favorevole, questionStats.contrario, questionStats.astenuto];
    return {
      labels,
      datasets: [{ data, backgroundColor: Object.values(backgroundColors), borderColor: Object.values(borderColors), borderWidth: 1 }]
    };
  };

  const prepareBarChartData = () => {
    if (!stats) return null;
    const labels = Object.values(opinionQuestions);
    return {
      labels,
      datasets: [
        { label: 'Favorevole', data: Object.keys(opinionQuestions).map(key => stats[key].favorevole), backgroundColor: backgroundColors.favorevole },
        { label: 'Contrario', data: Object.keys(opinionQuestions).map(key => stats[key].contrario), backgroundColor: backgroundColors.contrario },
        { label: 'Astenuto', data: Object.keys(opinionQuestions).map(key => stats[key].astenuto), backgroundColor: backgroundColors.astenuto }
      ]
    };
  };

  const barChartData = prepareBarChartData();

  // Mappa per i link di dettaglio
  const detailPageLinks: Record<string, string> = {
    'energia_nucleare': '/opinioni/energia-nucleare',
    'sperimentazione_animale': '/opinioni/sperimentazione-animale',
    'legalizzazione_canapa': '/opinioni/legalizzazione-canapa',
    'caccia': '/opinioni/caccia',
    'unione_europea': '/opinioni/unione-europea'
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu</Button></Link>
        <Card>
          <CardHeader><CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center"><BarChart className="mr-2 h-6 w-6 text-primary" /> Statistiche Opinioni</CardTitle><CardDescription>Visualizza statistiche aggregate delle opinioni nella piattaforma DEMOS</CardDescription></CardHeader>
          <CardContent>
            {isLoadingStats && <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            {error && <div className="text-center text-red-500 p-4">{error}</div>}
            {!isLoadingStats && !error && stats && (
              <div className="space-y-8">
                <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xl">Distribuzione complessiva</CardTitle></CardHeader><CardContent><div style={{ height: '300px' }}><Bar data={barChartData!} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div></CardContent></Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(opinionQuestions).map(([key, title]) => {
                    const pieData = preparePieChartData(key as OpinionKey);
                    const detailLink = detailPageLinks[key];
                    return pieData && (
                      // ===== LOGICA DI NAVIGAZIONE RIPRISTINATA =====
                      <Link href={detailLink} key={key}>
                        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow h-full">
                          <CardHeader className="pb-2"><CardTitle className="text-xl hover:text-primary transition-colors">{title}</CardTitle></CardHeader>
                          <CardContent className="flex justify-center">
                            <div style={{ height: '200px', width: '100%', maxWidth: '300px' }}>
                                <Pie data={pieData} options={{ plugins: { legend: { position: 'bottom' } }, responsive: true, maintainAspectRatio: false }} />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
                <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xl">Dati Dettagliati</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr className="bg-secondary/30"><th className="border p-2 text-left">Argomento</th><th className="border p-2 text-center">Favorevoli</th><th className="border p-2 text-center">Astenuti</th><th className="border p-2 text-center">Contrari</th><th className="border p-2 text-center">Totale</th></tr></thead><tbody>{Object.entries(opinionQuestions).map(([key, title]) => {const questionStats = stats[key]; const total = questionStats.favorevole + questionStats.astenuto + questionStats.contrario; return (<tr key={key} className="hover:bg-secondary/10"><td className="border p-2 font-medium">{title}</td><td className="border p-2 text-center text-emerald-600">{questionStats.favorevole}</td><td className="border p-2 text-center text-amber-600">{questionStats.astenuto}</td><td className="border p-2 text-center text-red-600">{questionStats.contrario}</td><td className="border p-2 text-center font-medium">{total}</td></tr>);})}</tbody></table></div></CardContent></Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}