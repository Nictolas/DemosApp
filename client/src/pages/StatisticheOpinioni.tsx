import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart } from "lucide-react";
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

type OpinionStats = {
  [key: string]: {
    Favorevole: number;
    Contrario: number;
    Indeciso: number;
  };
};

export default function StatisticheOpinioni() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<OpinionStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Domande di opinione - assicurati che corrispondano ESATTAMENTE ai nomi delle colonne nel DB
  const opinionQuestions = {
    energia_nucleare: "Energia Nucleare",
    sperimentazione_animale: "Sperimentazione Animale",
    legalizzazione_canapa: "Legalizzazione Canapa",
    caccia: "Caccia",
    unione_europea: "Unione Europea"
  };
  
  // Log dei nomi delle chiavi per debug
  console.log("Nomi delle chiavi opinioni:", Object.keys(opinionQuestions));

  // Colori per i grafici
  const backgroundColors = {
    Favorevole: 'rgba(75, 192, 192, 0.6)',
    Indeciso: 'rgba(255, 206, 86, 0.6)',
    Contrario: 'rgba(255, 99, 132, 0.6)'
  };

  const borderColors = {
    Favorevole: 'rgba(75, 192, 192, 1)',
    Indeciso: 'rgba(255, 206, 86, 1)',
    Contrario: 'rgba(255, 99, 132, 1)'
  };

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      try {
        // Utilizza API del backend per recuperare tutte le opinioni
        // Questo ci permette di usare il client admin di Supabase lato server
        // che bypassa le restrizioni RLS
        const response = await fetch('/api/statistiche-opinioni');
        if (!response.ok) {
          throw new Error(`Errore API: ${response.statusText}`);
        }
        
        const users = await response.json();
        console.log("Dati opinioni caricati:", users);

        // Non lanciare errore se non ci sono utenti
        if (!users || users.length === 0) {
          console.warn("Nessun dato utente trovato");
        }
        
        // Utilizza un array vuoto se users è null
        const usersData = users || [];

        // Inizializza struttura dati per statistiche
        const opinionStats: OpinionStats = {};
        Object.keys(opinionQuestions).forEach(question => {
          opinionStats[question] = {
            Favorevole: 0,
            Contrario: 0,
            Indeciso: 0
          };
        });

        // Calcola statistiche
        console.log("Calcolo statistiche per", usersData.length, "utenti");
        usersData.forEach((user: Record<string, any>) => {
          Object.keys(opinionQuestions).forEach(question => {
            const opinion = user[question as keyof typeof user];
            console.log(`Utente ${user.nome} ${user.cognome}, opinione ${question}: ${opinion}`);
            if (opinion && ['Favorevole', 'Indeciso', 'Contrario'].includes(opinion)) {
              // Incrementa il contatore appropriato
              console.log(`  Incrementando contatore per ${question} - ${opinion}`);
              opinionStats[question][opinion as keyof typeof opinionStats[typeof question]]++;
            }
          });
        });
        
        // Log delle statistiche calcolate
        console.log("Statistiche calcolate:", opinionStats);

        setStats(opinionStats);
      } catch (error) {
        console.error("Errore:", error);
        setError(error instanceof Error ? error.message : "Errore durante il caricamento delle statistiche");
      } finally {
        setIsLoadingStats(false);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Prepara dati per i grafici a torta
  const preparePieChartData = (questionKey: string) => {
    if (!stats) return null;
    
    const questionStats = stats[questionKey];
    const labels = Object.keys(questionStats);
    const values = Object.values(questionStats);
    
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map(label => backgroundColors[label as keyof typeof backgroundColors]),
        borderColor: labels.map(label => borderColors[label as keyof typeof borderColors]),
        borderWidth: 1,
      }]
    };
  };

  // Prepara dati per il grafico a barre
  const prepareBarChartData = () => {
    if (!stats) return null;

    const labels = Object.keys(opinionQuestions).map(key => opinionQuestions[key as keyof typeof opinionQuestions]);
    
    // Crea un dataset per ogni opinione (Favorevole, Contrario, Indeciso)
    const datasets = [
      {
        label: 'Favorevole',
        data: Object.keys(opinionQuestions).map(key => stats[key].Favorevole),
        backgroundColor: backgroundColors.Favorevole,
        borderColor: borderColors.Favorevole,
        borderWidth: 1,
      },
      {
        label: 'Indeciso',
        data: Object.keys(opinionQuestions).map(key => stats[key].Indeciso),
        backgroundColor: backgroundColors.Indeciso,
        borderColor: borderColors.Indeciso,
        borderWidth: 1,
      },
      {
        label: 'Contrario',
        data: Object.keys(opinionQuestions).map(key => stats[key].Contrario),
        backgroundColor: backgroundColors.Contrario,
        borderColor: borderColors.Contrario,
        borderWidth: 1,
      }
    ];
    
    return { labels, datasets };
  };

  const barChartData = prepareBarChartData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      {isLoading || isLoadingStats ? (
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
                <BarChart className="mr-2 h-6 w-6 text-primary" /> Statistiche Opinioni
              </CardTitle>
              <CardDescription>
                Visualizza statistiche aggregate delle opinioni nella piattaforma DEMOS
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error ? (
                <div className="text-center text-red-500 p-4">
                  {error}
                </div>
              ) : (
                <div className="space-y-8">
                  
                  {/* Grafico a barre complessivo */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">Distribuzione complessiva delle opinioni</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {barChartData && (
                        <div style={{ height: '300px' }}>
                          <Bar 
                            data={barChartData} 
                            options={{
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

                  {/* Grafici a torta singole opinioni */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(opinionQuestions).map(([key, title]) => (
                      <Card key={key} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                        const urlMap: Record<string, string> = {
                          'energia_nucleare': '/opinioni/energia-nucleare',
                          'sperimentazione_animale': '/opinioni/sperimentazione-animale',
                          'legalizzazione_canapa': '/opinioni/legalizzazione-canapa',
                          'caccia': '/opinioni/caccia',
                          'unione_europea': '/opinioni/unione-europea'
                        };
                        window.location.href = urlMap[key];
                      }}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xl hover:text-primary transition-colors">{title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex justify-center">
                          {stats && (
                            <div style={{ height: '200px', width: '100%', maxWidth: '300px' }}>
                              <Pie 
                                data={preparePieChartData(key)!} 
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
                    ))}
                  </div>
                  
                  {/* Tabella dettagliata */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">Dati Dettagliati delle Opinioni</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-secondary/30">
                              <th className="border p-2 text-left">Argomento</th>
                              <th className="border p-2 text-center">Favorevoli</th>
                              <th className="border p-2 text-center">Indecisi</th>
                              <th className="border p-2 text-center">Contrari</th>
                              <th className="border p-2 text-center">Totale</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats && Object.entries(opinionQuestions).map(([key, title]) => {
                              const questionStats = stats[key];
                              const total = questionStats.Favorevole + questionStats.Indeciso + questionStats.Contrario;
                              
                              return (
                                <tr key={key} className="hover:bg-secondary/10">
                                  <td className="border p-2 font-medium">{title}</td>
                                  <td className="border p-2 text-center text-emerald-600">{questionStats.Favorevole}</td>
                                  <td className="border p-2 text-center text-amber-600">{questionStats.Indeciso}</td>
                                  <td className="border p-2 text-center text-red-600">{questionStats.Contrario}</td>
                                  <td className="border p-2 text-center font-medium">{total}</td>
                                </tr>
                              );
                            })}
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
      )}
    </div>
  );
}