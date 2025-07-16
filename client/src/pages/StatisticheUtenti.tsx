import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { 
  Chart as ChartJS, 
  ArcElement, 
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend 
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { useAuthReady } from "@/hooks/use-auth-ready";

ChartJS.register(
  ArcElement, 
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type StatisticheUtenti = {
  totalUsers: number;
  usersByRole: Record<string, number>;
  usersByGender: Record<string, number>;
  usersByCitizenship: Record<string, number>;
  usersByRegion: Record<string, number>;
  usersByCity: Record<string, number>;
};

export default function StatisticheUtenti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const authReady = useAuthReady();
  const [stats, setStats] = useState<StatisticheUtenti | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Colori per i grafici
  const backgroundColors = [
    'rgba(54, 162, 235, 0.6)',
    'rgba(255, 99, 132, 0.6)',
    'rgba(255, 206, 86, 0.6)',
    'rgba(75, 192, 192, 0.6)',
    'rgba(153, 102, 255, 0.6)',
    'rgba(255, 159, 64, 0.6)',
    'rgba(199, 199, 199, 0.6)',
  ];
  const borderColors = [
    'rgba(54, 162, 235, 1)',
    'rgba(255, 99, 132, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)',
    'rgba(199, 199, 199, 1)',
  ];

  useEffect(() => {
    if (!user) return;
    setIsLoadingStats(true);
    getDocs(collection(db, "utenti"))
      .then(snap => {
        const utenti = snap.docs.map(doc => doc.data());
        // Calcola le statistiche
        const byRole: Record<string, number> = {};
        const byGender: Record<string, number> = {};
        const byCitizenship: Record<string, number> = {};
        const byRegion: Record<string, number> = {};
        const byCity: Record<string, number> = {};
        utenti.forEach(u => {
          if (u.ruolo) byRole[u.ruolo] = (byRole[u.ruolo] || 0) + 1;
          if (u.genere) byGender[u.genere] = (byGender[u.genere] || 0) + 1;
          if (u.cittadinanza) byCitizenship[u.cittadinanza] = (byCitizenship[u.cittadinanza] || 0) + 1;
          if (u.regione_residenza) byRegion[u.regione_residenza] = (byRegion[u.regione_residenza] || 0) + 1;
          if (u.comune_residenza) byCity[u.comune_residenza] = (byCity[u.comune_residenza] || 0) + 1;
        });
        setStats({
          totalUsers: utenti.length,
          usersByRole: byRole,
          usersByGender: byGender,
          usersByCitizenship: byCitizenship,
          usersByRegion: byRegion,
          usersByCity: byCity,
        });
      })
      .catch(() => setError('Errore nel caricamento dati'))
      .finally(() => setIsLoadingStats(false));
  }, [user]);

  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>Caricamento autenticazione...</div>
      </div>
    );
  }
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="text-center text-red-500 p-8 bg-yellow-100 border border-yellow-400 rounded-md">
        <h2 className="text-lg font-bold mb-2">[DEBUG] Accesso negato: utente non autenticato</h2>
        <pre className="text-left text-xs bg-white p-2 rounded border overflow-x-auto">
{JSON.stringify({
  user,
  isAuthLoading,
  error,
  motivo: "user null/undefined"
}, null, 2)}
        </pre>
      </div>
    );
  }
  if (user.ruolo !== "Admin") {
    return (
      <div className="text-center text-red-500 p-8 bg-yellow-100 border border-yellow-400 rounded-md">
        <h2 className="text-lg font-bold mb-2">[DEBUG] Accesso negato: ruolo richiesto 'Admin'</h2>
        <pre className="text-left text-xs bg-white p-2 rounded border overflow-x-auto">
{JSON.stringify({
  user,
  ruolo: user.ruolo,
  isAuthLoading,
  error,
  motivo: "ruolo non admin"
}, null, 2)}
        </pre>
      </div>
    );
  }
  if (isLoadingStats) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (error) {
    return <div className="text-center text-red-500 p-8">{error}</div>;
  }
  if (!stats) {
    return <div className="text-center text-gray-500 p-8">Nessun dato disponibile per le statistiche utenti.</div>;
  }
  const prepareChartData = (data: Record<string, number>) => {
    const labels = Object.keys(data);
    const values = Object.values(data);
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: backgroundColors.slice(0, labels.length),
        borderColor: borderColors.slice(0, labels.length),
        borderWidth: 1,
      }]
    };
  };
  const roleChartData = stats ? prepareChartData(stats.usersByRole) : null;
  const genderChartData = stats ? prepareChartData(stats.usersByGender) : null;
  const citizenshipChartData = stats ? prepareChartData(stats.usersByCitizenship) : null;
  const regionChartData = stats ? prepareChartData(stats.usersByRegion) : null;
  const cityChartData = stats ? prepareChartData(stats.usersByCity) : null;
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      {isLoadingStats ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto max-w-5xl">
          <Button 
            variant="ghost" 
            className="mb-4 flex items-center"
            onClick={() => window.location.href = "/menu"}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center">
                <Users className="mr-2 h-6 w-6 text-primary" /> Statistiche Utenti
              </CardTitle>
              <CardDescription>
                Visualizza statistiche aggregate degli utenti nella piattaforma DEMOS
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="text-center text-red-500 p-4">
                  {error}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Numero totale utenti */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">Numero Totale Utenti</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-primary">
                        {stats?.totalUsers || 0}
                      </div>
                    </CardContent>
                  </Card>
                  {/* Grafici */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Distribuzione per ruolo */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Ruolo</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        {roleChartData && (
                          <div style={{ height: '250px', width: '100%', maxWidth: '300px' }}>
                            <Pie 
                              data={roleChartData} 
                              options={{
                                plugins: {
                                  legend: {
                                    position: 'bottom',
                                  }
                                },
                                responsive: true,
                                maintainAspectRatio: false,
                              }}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    {/* Distribuzione per genere */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Genere</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        {genderChartData && (
                          <div style={{ height: '250px', width: '100%', maxWidth: '300px' }}>
                            <Pie 
                              data={genderChartData} 
                              options={{
                                plugins: {
                                  legend: {
                                    position: 'bottom',
                                  }
                                },
                                responsive: true,
                                maintainAspectRatio: false,
                              }}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    {/* Distribuzione per cittadinanza */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Cittadinanza</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        {citizenshipChartData && (
                          <div style={{ height: '250px', width: '100%', maxWidth: '300px' }}>
                            <Pie 
                              data={citizenshipChartData} 
                              options={{
                                plugins: { legend: { position: 'bottom' } },
                                responsive: true,
                                maintainAspectRatio: false,
                              }}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    {/* Distribuzione per regione */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Regione</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        {regionChartData && (
                          <div style={{ height: '250px', width: '100%', maxWidth: '300px' }}>
                            <Pie 
                              data={regionChartData} 
                              options={{
                                plugins: { legend: { position: 'bottom' } },
                                responsive: true,
                                maintainAspectRatio: false,
                              }}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    {/* Distribuzione per città */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Le 10 città con più utenti</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {stats && Object.keys(stats.usersByCity).length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="bg-blue-100">
                                  <th className="px-3 py-2 text-left">Città</th>
                                  <th className="px-3 py-2 text-left">Numero Utenti</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(stats.usersByCity)
                                  .sort((a, b) => b[1] - a[1])
                                  .slice(0, 10)
                                  .map(([city, count]) => (
                                    <tr key={city} className="hover:bg-blue-50">
                                      <td className="px-3 py-2 font-medium">{city}</td>
                                      <td className="px-3 py-2">{count}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground">Nessun dato disponibile.</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}