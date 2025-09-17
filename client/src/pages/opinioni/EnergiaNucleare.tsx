import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Zap, User, Calendar } from "lucide-react";
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



ChartJS.register(
  ArcElement, 
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type OpinionDetailStats = {
  total: number;
  favorevoli: number;
  contrari: number;
  indecisi: number;
  genderDistribution: {
    Maschio: { Favorevole: number; Contrario: number; Indeciso: number; };
    Femmina: { Favorevole: number; Contrario: number; Indeciso: number; };
    Altro: { Favorevole: number; Contrario: number; Indeciso: number; };
  };
  averageAge: {
    Favorevole: number;
    Contrario: number;
    Indeciso: number;
  };
  ageDistribution: {
    '18-25': { Favorevole: number; Contrario: number; Indeciso: number; };
    '26-35': { Favorevole: number; Contrario: number; Indeciso: number; };
    '36-45': { Favorevole: number; Contrario: number; Indeciso: number; };
    '46-55': { Favorevole: number; Contrario: number; Indeciso: number; };
    '56-65': { Favorevole: number; Contrario: number; Indeciso: number; };
    '65+': { Favorevole: number; Contrario: number; Indeciso: number; };
  };
};

// Funzione helper per calcolare l'età da data di nascita
const calculateAge = (birthDate: string) => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// Funzione helper per determinare la fascia d'età
const getAgeGroup = (age: number) => {
  if (age < 26) return '18-25';
  if (age < 36) return '26-35';
  if (age < 46) return '36-45';
  if (age < 56) return '46-55';
  if (age < 66) return '56-65';
  return '65+';
};

export default function EnergiaNucleare() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<OpinionDetailStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpinionStats = async () => {
      if (!user) return;
      try {
        const utentiRef = collection(db, "utenti");
        const utentiSnapshot = await getDocs(utentiRef);
        let favorevoli = 0, contrari = 0, indecisi = 0, total = 0;
        utentiSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.energia_nucleare === "Favorevole") favorevoli++;
          else if (data.energia_nucleare === "Contrario") contrari++;
          else if (data.energia_nucleare === "Indeciso") indecisi++;
          if (["Favorevole", "Contrario", "Indeciso"].includes(data.energia_nucleare)) total++;
        });
        setStats({ favorevoli, contrari, indecisi, total });
        setError(null);
      } catch (error) {
        setError("Errore durante il caricamento delle statistiche");
      } finally {
        setIsLoadingStats(false);
      }
    };
    if (user) fetchOpinionStats();
  }, [user]);

  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Prepara dati per il grafico principale
  const prepareMainChartData = () => {
    if (!stats) return null;
    
    return {
      labels: ['Favorevoli', 'Indecisi', 'Contrari'],
      datasets: [{
        data: [stats.favorevoli, stats.indecisi, stats.contrari],
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(255, 99, 132, 0.6)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 1,
      }]
    };
  };

  // Prepara dati per il grafico per genere
  const prepareGenderChartData = () => {
    if (!stats) return null;

    const labels = ['Maschio', 'Femmina', 'Altro'];
    
    return {
      labels,
      datasets: [
        {
          label: 'Favorevoli',
          data: labels.map(gender => stats.genderDistribution[gender as keyof typeof stats.genderDistribution]?.Favorevole || 0),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
        {
          label: 'Indecisi',
          data: labels.map(gender => stats.genderDistribution[gender as keyof typeof stats.genderDistribution]?.Indeciso || 0),
          backgroundColor: 'rgba(255, 206, 86, 0.6)',
          borderColor: 'rgba(255, 206, 86, 1)',
          borderWidth: 1,
        },
        {
          label: 'Contrari',
          data: labels.map(gender => stats.genderDistribution[gender as keyof typeof stats.genderDistribution]?.Contrario || 0),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        }
      ]
    };
  };

  // Prepara dati per il grafico per età
  const prepareAgeChartData = () => {
    if (!stats) return null;

    const labels = ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'];
    
    return {
      labels,
      datasets: [
        {
          label: 'Favorevoli',
          data: labels.map(age => stats.ageDistribution[age as keyof typeof stats.ageDistribution]?.Favorevole || 0),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
        {
          label: 'Indecisi',
          data: labels.map(age => stats.ageDistribution[age as keyof typeof stats.ageDistribution]?.Indeciso || 0),
          backgroundColor: 'rgba(255, 206, 86, 0.6)',
          borderColor: 'rgba(255, 206, 86, 1)',
          borderWidth: 1,
        },
        {
          label: 'Contrari',
          data: labels.map(age => stats.ageDistribution[age as keyof typeof stats.ageDistribution]?.Contrario || 0),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        }
      ]
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      {isLoading || isLoadingStats ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto max-w-6xl">
          <Button 
            variant="ghost" 
            className="mb-4 flex items-center"
            onClick={() => window.location.href = "/sondaggi"}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna alle Statistiche
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center">
                <Zap className="mr-2 h-6 w-6 text-primary" /> Energia Nucleare
              </CardTitle>
              <CardDescription>
                Statistiche dettagliate sull'opinione riguardo l'energia nucleare
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error ? (
                <div className="text-center text-red-500 p-4">
                  {error}
                </div>
              ) : stats ? (
                <div className="space-y-8">
                  
                  {/* Statistiche generali */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-2">
                          <User className="h-6 w-6 text-primary" />
                          <div>
                            <p className="text-2xl font-bold">{stats.total}</p>
                            <p className="text-sm text-muted-foreground">Totale Risposte</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-2">
                          <div className="h-6 w-6 bg-emerald-500 rounded"></div>
                          <div>
                            <p className="text-2xl font-bold text-emerald-600">{stats.favorevoli}</p>
                            <p className="text-sm text-muted-foreground">Favorevoli</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-2">
                          <div className="h-6 w-6 bg-amber-500 rounded"></div>
                          <div>
                            <p className="text-2xl font-bold text-amber-600">{stats.indecisi}</p>
                            <p className="text-sm text-muted-foreground">Indecisi</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-2">
                          <div className="h-6 w-6 bg-red-500 rounded"></div>
                          <div>
                            <p className="text-2xl font-bold text-red-600">{stats.contrari}</p>
                            <p className="text-sm text-muted-foreground">Contrari</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Grafico principale */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">Distribuzione Generale</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                      <div style={{ height: '300px', width: '100%', maxWidth: '400px' }}>
                        <Pie 
                          data={prepareMainChartData()!} 
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
                    </CardContent>
                  </Card>

                  {/* Età media per opinione */}
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl flex items-center">
                        <Calendar className="mr-2 h-5 w-5" />
                        Età Media per Opinione
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-emerald-600">{stats.averageAge.Favorevole.toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Anni - Favorevoli</p>
                        </div>
                        <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-amber-600">{stats.averageAge.Indeciso.toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Anni - Indecisi</p>
                        </div>
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{stats.averageAge.Contrario.toFixed(1)}</p>
                          <p className="text-sm text-muted-foreground">Anni - Contrari</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Grafici per genere e età */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Distribuzione per Genere */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Genere</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div style={{ height: '300px' }}>
                          <Bar 
                            data={prepareGenderChartData()!} 
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
                      </CardContent>
                    </Card>

                    {/* Distribuzione per Età */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Fascia d'Età</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div style={{ height: '300px' }}>
                          <Bar 
                            data={prepareAgeChartData()!} 
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
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground p-8">
                  <Zap className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Nessun dato disponibile per questa opinione.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
