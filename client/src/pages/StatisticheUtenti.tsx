import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users } from "lucide-react";
import { db, auth } from "@/lib/firebase";
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
import { apiRequest } from "@/lib/queryClient";

// Registra i componenti Chart.js necessari
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
    apiRequest('GET', '/api/users-stats')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setStats(data))
      .catch(() => setError('Errore nel caricamento dati'))
      .finally(() => setIsLoadingStats(false));
  }, [user]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Log temporaneo per debug
  console.log("user:", user);

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

  // Da qui in poi, NON fare redirect su errori di fetch secondarie
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

  // Prepara dati per i grafici
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

                    {/* Top 5 Cittadinanze */}
                    <Card className="shadow-sm lg:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Top 5 Cittadinanze</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        {citizenshipChartData && (
                          <div style={{ height: '250px', width: '100%' }}>
                            <Bar 
                              data={citizenshipChartData} 
                              options={{
                                plugins: {
                                  legend: {
                                    display: false,
                                  }
                                },
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    ticks: {
                                      precision: 0
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Distribuzione per Regione */}
                    <Card className="shadow-sm lg:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Regione</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        {regionChartData && (
                          <div style={{ height: '250px', width: '100%' }}>
                            <Bar 
                              data={regionChartData} 
                              options={{
                                plugins: {
                                  legend: {
                                    display: false,
                                  }
                                },
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    ticks: {
                                      precision: 0
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Top 10 Città con più iscritti */}
                    <Card className="shadow-sm lg:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Top 10 Città con più iscritti</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        {cityChartData && (
                          <div style={{ height: '250px', width: '100%' }}>
                            <Bar 
                              data={cityChartData} 
                              options={{
                                plugins: {
                                  legend: {
                                    display: false,
                                  }
                                },
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    ticks: {
                                      precision: 0
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Tabella dettagliata */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">Dati Dettagliati</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Dettagli per ruolo */}
                        <div>
                          <h3 className="font-medium mb-2 text-lg">Utenti per Ruolo:</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {stats && Object.entries(stats.usersByRole).map(([role, count]) => (
                              <div key={role} className="bg-secondary/30 p-2 rounded-md">
                                <span className="font-medium">{role}:</span> {count}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Dettagli per genere */}
                        <div>
                          <h3 className="font-medium mb-2 text-lg">Utenti per Genere:</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {stats && Object.entries(stats.usersByGender).map(([gender, count]) => (
                              <div key={gender} className="bg-secondary/30 p-2 rounded-md">
                                <span className="font-medium">{gender}:</span> {count}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Dettagli per cittadinanza */}
                        <div>
                          <h3 className="font-medium mb-2 text-lg">Top 5 Cittadinanze:</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {stats && Object.entries(stats.usersByCitizenship).map(([citizenship, count]) => (
                              <div key={citizenship} className="bg-secondary/30 p-2 rounded-md">
                                <span className="font-medium">{citizenship}:</span> {count}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Dettagli per regione */}
                        <div>
                          <h3 className="font-medium mb-2 text-lg">Utenti per Regione:</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {stats && Object.entries(stats.usersByRegion).map(([region, count]) => (
                              <div key={region} className="bg-secondary/30 p-2 rounded-md">
                                <span className="font-medium">{region}:</span> {count}
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Dettagli per città */}
                        <div>
                          <h3 className="font-medium mb-2 text-lg">Top 10 Città con più iscritti:</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {stats && Object.entries(stats.usersByCity).map(([city, count]) => (
                              <div key={city} className="bg-secondary/30 p-2 rounded-md">
                                <span className="font-medium">{city}:</span> {count}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}