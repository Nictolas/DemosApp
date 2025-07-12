import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users, MapPin, Calendar, User, Eye, EyeOff } from "lucide-react";
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
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

type Supporter = {
  uid: string;
  nome: string;
  cognome: string;
  email: string;
  genere?: string;
  data_nascita?: string;
  comune_residenza?: string;
  supporterRoles: string[];
  data_registrazione: string;
};

export default function Sostenitori() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<SupporterStats | null>(null);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingSupporters, setIsLoadingSupporters] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showSupportersList, setShowSupportersList] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        setIsLoadingStats(true);
        setIsLoadingSupporters(true);

        // Carica dati utente direttamente da Firestore
        const utentiRef = collection(db, "utenti");
        const utentiSnap = await getDocs(utentiRef);
        let myProfile = null;
        const supportersArr: Supporter[] = [];
        for (const doc of utentiSnap.docs) {
          const data = doc.data();
          if (doc.id === user.uid) {
            myProfile = { uid: doc.id, ...data };
          }
          // Cerca chi ha scelto l'utente loggato come rappresentante
          const supporterRoles: string[] = [];
          if (data.rappresentante_europeo === user.uid) supporterRoles.push("Rappresentante Europeo");
          if (data.rappresentante_camera === user.uid) supporterRoles.push("Rappresentante Camera");
          if (data.rappresentante_senato === user.uid) supporterRoles.push("Rappresentante Senato");
          if (data.rappresentante_regionale === user.uid) supporterRoles.push("Rappresentante Regionale");
          if (data.rappresentante_comunale === user.uid) supporterRoles.push("Rappresentante Comunale");
          if (supporterRoles.length > 0) {
            supportersArr.push({
              uid: doc.id,
              nome: data.nome,
              cognome: data.cognome,
              email: data.email,
              genere: data.genere,
              data_nascita: data.data_nascita,
              comune_residenza: data.comune_residenza,
              supporterRoles,
              data_registrazione: data.data_registrazione || doc.id
            });
          }
        }
        setUserProfile(myProfile);
        setSupporters(supportersArr);

        // Calcola statistiche
        let totalSupporters = supportersArr.length;
        let genderDistribution = { Maschio: 0, Femmina: 0, Altro: 0 };
        let locationDistribution: Record<string, number> = {};
        let ageSum = 0;
        let ageDistribution = {
          '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56-65': 0, '65+': 0
        };
        const getAge = (birthDate: string) => {
          if (!birthDate) return null;
          const birth = new Date(birthDate);
          const now = new Date();
          return now.getFullYear() - birth.getFullYear();
        };
        for (const s of supportersArr) {
          // Genere
          const genere = (s.genere || '').trim().toLowerCase();
          if (genere === 'maschio' || genere === 'uomo') genderDistribution.Maschio++;
          else if (genere === 'femmina' || genere === 'donna') genderDistribution.Femmina++;
          else genderDistribution.Altro++;
          // Località
          if (s.comune_residenza) {
            locationDistribution[s.comune_residenza] = (locationDistribution[s.comune_residenza] || 0) + 1;
          }
          // Età
          const age = getAge(s.data_nascita!);
          if (age) {
            ageSum += age;
            if (age <= 25) ageDistribution['18-25']++;
            else if (age <= 35) ageDistribution['26-35']++;
            else if (age <= 45) ageDistribution['36-45']++;
            else if (age <= 55) ageDistribution['46-55']++;
            else if (age <= 65) ageDistribution['56-65']++;
            else ageDistribution['65+']++;
          }
        }
        const averageAge = totalSupporters > 0 ? ageSum / totalSupporters : 0;
        setStats({
          totalSupporters,
          genderDistribution,
          locationDistribution,
          averageAge,
          ageDistribution
        });
      } catch (error) {
        console.error('Errore nel caricamento dei dati:', error);
        setError('Errore nel caricamento dei dati');
      } finally {
        setIsLoadingStats(false);
        setIsLoadingSupporters(false);
      }
    };
    if (user) {
      fetchData();
    }
  }, [user]);

  // Verifica ruolo utente (case-insensitive)
  const validRoles = ['politico', 'candidato', 'candidato politico'];
  const userRole = (userProfile?.ruolo || '').toLowerCase();
  const isAuthorized = validRoles.includes(userRole);

  // Redirect se non loggato
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Mostra errore se ruolo non valido
  if (user && !isAuthorized) {
    // console.error('❌ Ruolo non autorizzato o mancante:', userProfile?.ruolo, userProfile);
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-md border border-red-300">
          <h2 className="text-2xl font-bold mb-2 text-red-700">Accesso negato</h2>
          <p className="text-gray-700 mb-2">Il tuo ruolo attuale (<b>{userProfile?.ruolo || 'N/A'}</b>) non è abilitato a visualizzare la pagina Sostenitori.</p>
          <p className="text-gray-500 text-sm">Se pensi sia un errore, contatta l'amministratore.</p>
        </div>
      </div>
    );
  }

  // Messaggio di caricamento dettagliato
  if (isLoadingStats || isLoadingSupporters) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-md border border-blue-300">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-blue-700">Caricamento dati sostenitori...</h2>
          <p className="text-gray-700 mb-2">Stiamo recuperando le statistiche dei tuoi sostenitori. Se il caricamento richiede più di qualche secondo, il server potrebbe essere in fase di riattivazione. Attendi oppure <Button variant="outline" onClick={() => window.location.reload()}>Riprova</Button></p>
        </div>
      </div>
    );
  }
  // Mostra errore se presente
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-md border border-red-300">
          <h2 className="text-2xl font-bold mb-2 text-red-700">Errore</h2>
          <p className="text-gray-700 mb-2">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Riprova</Button>
        </div>
      </div>
    );
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

  // Funzione per calcolare l'età
  const getAge = (birthDate: string) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const now = new Date();
    return now.getFullYear() - birth.getFullYear();
  };

  // Funzione per formattare la data
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('it-IT');
    } catch {
      return 'N/A';
    }
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
                Statistiche dettagliate e lista dei tuoi sostenitori su DEMOS
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

                  {/* Pulsante per mostrare/nascondere la lista sostenitori */}
                  {supporters.length > 0 && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => setShowSupportersList(!showSupportersList)}
                        className="flex items-center space-x-2"
                      >
                        {showSupportersList ? (
                          <>
                            <EyeOff className="h-4 w-4" />
                            <span>Nascondi Lista Sostenitori</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            <span>Mostra Lista Sostenitori ({supporters.length})</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Lista dei sostenitori */}
                  {showSupportersList && supporters.length > 0 && (
                    <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-xl">Lista dei Sostenitori</CardTitle>
                        <CardDescription>
                          Tutti coloro che ti hanno scelto come rappresentante
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-secondary/30">
                                <th className="border p-2 text-left">Nome</th>
                                <th className="border p-2 text-left">Email</th>
                                <th className="border p-2 text-left">Genere</th>
                                <th className="border p-2 text-left">Età</th>
                                <th className="border p-2 text-left">Località</th>
                                <th className="border p-2 text-left">Ruoli</th>
                                <th className="border p-2 text-left">Data Registrazione</th>
                              </tr>
                            </thead>
                            <tbody>
                              {supporters.map((supporter) => (
                                <tr key={supporter.uid} className="hover:bg-secondary/10">
                                  <td className="border p-2 font-medium">
                                    {supporter.nome} {supporter.cognome}
                                  </td>
                                  <td className="border p-2 text-sm">{supporter.email}</td>
                                  <td className="border p-2">{supporter.genere || 'N/A'}</td>
                                  <td className="border p-2">
                                    {supporter.data_nascita ? getAge(supporter.data_nascita) : 'N/A'}
                                  </td>
                                  <td className="border p-2">{supporter.comune_residenza || 'N/A'}</td>
                                  <td className="border p-2">
                                    <div className="flex flex-wrap gap-1">
                                      {supporter.supporterRoles.map((role, index) => (
                                        <span
                                          key={index}
                                          className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
                                        >
                                          {role}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="border p-2 text-sm">
                                    {formatDate(supporter.data_registrazione)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

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