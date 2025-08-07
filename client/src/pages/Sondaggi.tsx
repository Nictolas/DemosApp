import React from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart } from "lucide-react";
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type OpinionData = { favorevole: number; contrario: number; astenuto: number; };
type OpinionStats = Record<string, OpinionData>;
interface Question { id: string; text: string; }
interface SondaggiData {
    stats: OpinionStats;
    questions: Question[];
}

const backgroundColors = { favorevole: 'rgba(75, 192, 192, 0.6)', contrario: 'rgba(255, 99, 132, 0.6)', astenuto: 'rgba(255, 206, 86, 0.6)' };
const borderColors = { favorevole: 'rgba(75, 192, 192, 1)', contrario: 'rgba(255, 99, 132, 1)', astenuto: 'rgba(255, 206, 86, 1)' };

export default function Sondaggi() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // 1. Caricamento dati aggregati con React Query
  const { data, isLoading, isError } = useQuery<SondaggiData>({
    queryKey: ['sondaggiStats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sondaggi/stats");
      if (!response.ok) throw new Error("Errore nel caricamento delle statistiche.");
      return response.json();
    },
    enabled: !!user,
  });
  
  const { stats, questions = [] } = data || {};
  
  // Le funzioni per preparare i dati dei grafici rimangono, ma usano i dati da React Query
  const preparePieChartData = (questionKey: string) => {
    if (!stats) return null;
    const questionStats = stats[questionKey];
    return {
      labels: ['Favorevole', 'Contrario', 'Astenuto'],
      datasets: [{ 
        data: [questionStats.favorevole, questionStats.contrario, questionStats.astenuto],
        backgroundColor: [backgroundColors.favorevole, backgroundColors.contrario, backgroundColors.astenuto],
        borderColor: [borderColors.favorevole, borderColors.contrario, borderColors.astenuto],
        borderWidth: 1 
      }]
    };
  };

  const prepareBarChartData = () => {
    if (!stats || questions.length === 0) return null;
    return {
      labels: questions.map(q => q.text),
      datasets: [
        { label: 'Favorevole', data: questions.map(q => stats[q.id]?.favorevole ?? 0), backgroundColor: backgroundColors.favorevole },
        { label: 'Contrario', data: questions.map(q => stats[q.id]?.contrario ?? 0), backgroundColor: backgroundColors.contrario },
        { label: 'Astenuto', data: questions.map(q => stats[q.id]?.astenuto ?? 0), backgroundColor: backgroundColors.astenuto }
      ]
    };
  };

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  if (user.ruolo !== 'Admin') return <Redirect to="/menu" />; // Aggiunto controllo per admin

  const barChartData = prepareBarChartData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card>
          <CardHeader><CardTitle className="text-2xl flex items-center"><BarChart className="mr-2 h-6 w-6" />Sondaggi Aggregati</CardTitle><CardDescription>Statistiche aggregate delle opinioni espresse dagli utenti della piattaforma.</CardDescription></CardHeader>
          <CardContent>
            {isLoading && <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {isError && <div className="text-center text-red-500 p-4">Errore nel caricamento delle statistiche.</div>}
            {!isLoading && !isError && stats && (
              <div className="space-y-8">
                {barChartData && <Card><CardHeader><CardTitle className="text-xl">Distribuzione complessiva</CardTitle></CardHeader><CardContent><div style={{ height: '300px' }}><Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div></CardContent></Card>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {questions.map(q => {
                    const pieData = preparePieChartData(q.id);
                    return pieData && (
                      <Card key={q.id}>
                        <CardHeader><CardTitle className="text-xl">{q.text}</CardTitle></CardHeader>
                        <CardContent className="flex justify-center"><div style={{ height: '200px' }}><Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false }} /></div></CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}