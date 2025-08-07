import React from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users, BarChart } from "lucide-react";
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type StatisticheUtenti = {
  totalUsers: number;
  usersByRole: Record<string, number>;
  usersByGender: Record<string, number>;
  usersByCitizenship: Record<string, number>;
  usersByRegion: Record<string, number>;
  usersByCity: Record<string, number>;
};

const backgroundColors = ['rgba(54, 162, 235, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)'];
const borderColors = ['rgba(54, 162, 235, 1)', 'rgba(255, 99, 132, 1)', 'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'];

export default function StatisticheUtenti() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // 1. Caricamento dati aggregati con React Query
  const { data: stats, isLoading, isError } = useQuery<StatisticheUtenti>({
    queryKey: ['statisticheUtenti'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/statistiche/utenti");
      if (!response.ok) throw new Error("Errore nel caricamento delle statistiche");
      return response.json();
    },
    enabled: !!user && user.ruolo === "Admin", // Esegui solo se l'utente è loggato ed è un Admin
  });

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  if (user.ruolo !== "Admin") return <Redirect to="/menu" />;

  const prepareChartData = (data: Record<string, number>) => {
    const labels = Object.keys(data);
    const values = Object.values(data);
    return {
      labels,
      datasets: [{ data: values, backgroundColor: backgroundColors.slice(0, labels.length), borderColor: borderColors.slice(0, labels.length), borderWidth: 1 }]
    };
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><Users className="mr-2 h-6 w-6" />Statistiche Utenti</CardTitle>
            <CardDescription>Statistiche aggregate degli utenti della piattaforma DEMOS.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {isError && <div className="text-center text-red-500 p-4">Errore nel caricamento delle statistiche.</div>}
            {stats && (
              <div className="space-y-8">
                <Card>
                  <CardHeader><CardTitle>Utenti Totali</CardTitle></CardHeader>
                  <CardContent><div className="text-4xl font-bold text-primary">{stats.totalUsers}</div></CardContent>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card><CardHeader><CardTitle>Distribuzione per Ruolo</CardTitle></CardHeader><CardContent className="h-80 flex justify-center"><Pie data={prepareChartData(stats.usersByRole)} options={{ responsive: true, maintainAspectRatio: false }} /></CardContent></Card>
                  <Card><CardHeader><CardTitle>Distribuzione per Genere</CardTitle></CardHeader><CardContent className="h-80 flex justify-center"><Pie data={prepareChartData(stats.usersByGender)} options={{ responsive: true, maintainAspectRatio: false }} /></CardContent></Card>
                  <Card><CardHeader><CardTitle>Distribuzione per Cittadinanza</CardTitle></CardHeader><CardContent className="h-80 flex justify-center"><Pie data={prepareChartData(stats.usersByCitizenship)} options={{ responsive: true, maintainAspectRatio: false }} /></CardContent></Card>
                  <Card><CardHeader><CardTitle>Distribuzione per Regione</CardTitle></CardHeader><CardContent className="h-80 flex justify-center"><Pie data={prepareChartData(stats.usersByRegion)} options={{ responsive: true, maintainAspectRatio: false }} /></CardContent></Card>
                </div>
                <Card>
                  <CardHeader><CardTitle>Le 10 città con più utenti</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead><tr><th className="p-2 text-left">Città</th><th className="p-2 text-left">Numero Utenti</th></tr></thead>
                        <tbody>
                          {Object.entries(stats.usersByCity).sort(([,a], [,b]) => b - a).slice(0, 10).map(([city, count]) => (
                            <tr key={city}><td className="p-2 font-medium">{city}</td><td className="p-2">{count}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}