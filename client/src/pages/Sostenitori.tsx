import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users, MapPin, Calendar, User } from "lucide-react";
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

type SupporterStats = {
  totalSupporters: number;
  genderDistribution: {
    Maschio: number;
    Femmina: number;
    Altro: number;
  };
  locationDistribution: Record<string, number>;
  averageAge: number;
  ageDistribution: {
    '18-25': number;
    '26-35': number;
    '36-45': number;
    '46-55': number;
    '56-65': number;
    '65+': number;
  };
};

export default function Sostenitori() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<SupporterStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchUserDataAndStats = async () => {
      if (!user) return;
      
      console.log('🔄 Inizio caricamento dati sostenitori per utente:', user.email);
      
      try {
        // First fetch user profile to get the role
        console.log('📡 Chiamata API per dati utente...');
        const userResponse = await fetch(`/api/users/${encodeURIComponent(user.uid)}`, { credentials: 'include' });
        console.log('📡 Risposta API utente:', userResponse.status, userResponse.statusText);
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log('👤 Dati utente ricevuti:', userData);
          setUserProfile(userData);
          
          // Check if user is authorized (Politico, Candidato, or Candidato Politico)
          const isAuthorized = userData.ruolo === 'Politico' || userData.ruolo === 'Candidato' || userData.ruolo === 'Candidato Politico';
          console.log('🔐 Utente autorizzato?', isAuthorized, 'Ruolo:', userData.ruolo);
          
          if (isAuthorized) {
            // Fetch supporter stats
            console.log('📡 Chiamata API per statistiche sostenitori...');
            const statsResponse = await fetch(`/api/sostenitori/${encodeURIComponent(user.uid)}`, { credentials: 'include' });
            console.log('📡 Risposta API sostenitori:', statsResponse.status, statsResponse.statusText);
            
            if (!statsResponse.ok) {
              const errorText = await statsResponse.text();
              console.error('❌ Errore API sostenitori:', errorText);
              throw new Error(`Errore API: ${statsResponse.statusText} - ${errorText}`);
            }
            
            const supporterData = await statsResponse.json();
            console.log('📊 Dati sostenitori ricevuti:', supporterData);
            setStats(supporterData);
          } else {
            console.log('❌ Utente non autorizzato per visualizzare sostenitori');
          }
        } else {
          console.error('❌ Errore nel recuperare dati utente:', userResponse.status, userResponse.statusText);
        }
      } catch (error) {
        console.error("❌ Errore generale:", error);
        setError(error instanceof Error ? error.message : "Errore durante il caricamento delle statistiche sostenitori");
      } finally {
        setIsLoadingStats(false);
        console.log('✅ Caricamento completato');
      }
    };

    if (user) {
      fetchUserDataAndStats();
    }
  }, [user]);

  // Verifica ruolo utente
  const isAuthorized = userProfile?.ruolo === 'Politico' || userProfile?.ruolo === 'Candidato' || userProfile?.ruolo === 'Candidato Politico';

  // Redirect se non autorizzato
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (user && !isAuthorized) {
    return <Redirect to="/menu" />;
  }

  if (userProfile && userProfile.status === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-md border border-yellow-300">
          <Loader2 className="h-10 w-10 animate-spin text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-yellow-700">Profilo in fase di approvazione</h2>
          <p className="text-gray-700 mb-2">Il tuo profilo è in fase di approvazione da parte di un amministratore.</p>
          <p className="text-gray-500 text-sm">Riceverai una notifica appena il tuo account sarà attivo. Attendi la conferma prima di poter accedere alle funzionalità della piattaforma.</p>
        </div>
      </div>
    );
  }

  // Prepara dati per il grafico a torta del genere
  const prepareGenderChartData = () => {
    if (!stats) return null;
    
    const genderData = stats.genderDistribution;
    const labels = Object.keys(genderData);
    const values = Object.values(genderData);
    
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 206, 86, 0.6)'
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 1,
      }]
    };
  };

  // Prepara dati per il grafico a barre delle età
  const prepareAgeChartData = () => {
    if (!stats) return null;

    const ageData = stats.ageDistribution;
    const labels = Object.keys(ageData);
    const values = Object.values(ageData);
    
    return {
      labels,
      datasets: [{
        label: 'Numero Sostenitori',
        data: values,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      }]
    };
  };

  // Prepara dati per il grafico delle località
  const prepareLocationChartData = () => {
    if (!stats) return null;

    const locationData = stats.locationDistribution;
    const labels = Object.keys(locationData);
    const values = Object.values(locationData);
    
    return {
      labels,
      datasets: [{
        label: 'Sostenitori per Località',
        data: values,
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      }]
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
            onClick={() => window.location.href = "/menu"}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center">
                <Users className="mr-2 h-6 w-6 text-primary" /> I Miei Sostenitori
              </CardTitle>
              <CardDescription>
                Statistiche dettagliate dei tuoi sostenitori su DEMOS
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
                          <Users className="h-6 w-6 text-primary" />
                          <div>
                            <p className="text-2xl font-bold">{stats.totalSupporters}</p>
                            <p className="text-sm text-muted-foreground">Sostenitori Totali</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-6 w-6 text-primary" />
                          <div>
                            <p className="text-2xl font-bold">{stats.averageAge.toFixed(1)}</p>
                            <p className="text-sm text-muted-foreground">Età Media</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-2">
                          <User className="h-6 w-6 text-primary" />
                          <div>
                            <p className="text-2xl font-bold">
                              {Math.max(...Object.values(stats.genderDistribution)) === stats.genderDistribution.Maschio ? 'M' : 
                               Math.max(...Object.values(stats.genderDistribution)) === stats.genderDistribution.Femmina ? 'F' : 'A'}
                            </p>
                            <p className="text-sm text-muted-foreground">Genere Prevalente</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-6 w-6 text-primary" />
                          <div>
                            <p className="text-2xl font-bold">{Object.keys(stats.locationDistribution).length}</p>
                            <p className="text-sm text-muted-foreground">Località Diverse</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Grafici */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Distribuzione per Genere */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Genere</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        <div style={{ height: '300px', width: '100%', maxWidth: '400px' }}>
                          <Pie 
                            data={prepareGenderChartData()!} 
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

                    {/* Distribuzione per Età */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Età</CardTitle>
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

                  {/* Distribuzione per Località */}
                  {Object.keys(stats.locationDistribution).length > 0 && (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Distribuzione per Località</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div style={{ height: '400px' }}>
                          <Bar 
                            data={prepareLocationChartData()!} 
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  ticks: {
                                    precision: 0
                                  }
                                },
                                x: {
                                  ticks: {
                                    maxRotation: 45,
                                    minRotation: 45
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tabella dettagliata località */}
                  {Object.keys(stats.locationDistribution).length > 0 && (
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Dettaglio per Località</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-secondary/30">
                                <th className="border p-2 text-left">Località</th>
                                <th className="border p-2 text-center">Numero Sostenitori</th>
                                <th className="border p-2 text-center">Percentuale</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(stats.locationDistribution)
                                .sort(([,a], [,b]) => b - a)
                                .map(([location, count]) => (
                                <tr key={location} className="hover:bg-secondary/10">
                                  <td className="border p-2 font-medium">{location}</td>
                                  <td className="border p-2 text-center">{count}</td>
                                  <td className="border p-2 text-center">
                                    {((count / stats.totalSupporters) * 100).toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground p-8">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Non hai ancora sostenitori registrati.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}