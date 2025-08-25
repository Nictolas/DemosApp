import React from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart as BarChartIcon, TrendingUp, Users } from "lucide-react";
// === INIZIO MODIFICHE ===
import { PieChart, Pie, Cell, Tooltip, Legend, Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
// === FINE MODIFICHE ===
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type OpinionData = { favorevole: number; contrario: number; indeciso: number; astenuto: number; };
type OpinionStats = Record<string, OpinionData>;
interface Question { id: string; text: string; }
interface SondaggiData {
    stats: OpinionStats;
    questions: Question[];
}

// Colori corretti per le risposte
const COLORS = {
  favorevole: '#10B981', // Verde
  contrario: '#EF4444',  // Rosso
  indeciso: '#F59E0B',   // Giallo
  astenuto: '#6B7280'    // Grigio
};

export default function Sondaggi() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data, isLoading, isError } = useQuery<SondaggiData>({
    queryKey: ['sondaggiStats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sondaggi/stats");
      if (!response.ok) throw new Error("Errore nel caricamento delle statistiche.");
      const result = await response.json();
      return result.data; // Estrai i dati dalla risposta
    },
    enabled: !!user,
  });
  
  const { stats, questions = [] } = data || {};
  
  // Debug logging
  console.log('🔍 DEBUG: Data received:', { stats, questions });
  console.log('🔍 DEBUG: Stats keys:', stats ? Object.keys(stats) : 'No stats');
  console.log('🔍 DEBUG: Questions count:', questions.length);
  
  // === INIZIO MODIFICHE LOGICA GRAFICI ===
  const preparePieData = (questionKey: string) => {
    if (!stats) return [];
    const questionStats = stats[questionKey];
    
    // Controllo di sicurezza: se non ci sono statistiche per questa domanda, ritorna array vuoto
    if (!questionStats) {
      console.log('⚠️ DEBUG: No stats for question:', questionKey);
      return [];
    }
    
    // Controllo che tutti i valori siano numeri validi e maggiori o uguali a 0
    const favorevole = Math.max(0, Number(questionStats.favorevole) || 0);
    const contrario = Math.max(0, Number(questionStats.contrario) || 0);
    const indeciso = Math.max(0, Number(questionStats.indeciso) || 0);
    const astenuto = Math.max(0, Number(questionStats.astenuto) || 0);
    
    // Controllo che almeno un valore sia maggiore di 0
    if (favorevole === 0 && contrario === 0 && indeciso === 0 && astenuto === 0) {
      console.log('⚠️ DEBUG: All values are 0 for question:', questionKey);
      return [];
    }
    
    const data = [];
    if (favorevole > 0) data.push({ name: 'Favorevole', value: favorevole, color: COLORS.favorevole });
    if (contrario > 0) data.push({ name: 'Contrario', value: contrario, color: COLORS.contrario });
    if (indeciso > 0) data.push({ name: 'Indeciso', value: indeciso, color: COLORS.indeciso });
    if (astenuto > 0) data.push({ name: 'Astenuto', value: astenuto, color: COLORS.astenuto });
    
    return data;
  };

  const prepareBarData = () => {
    if (!stats || questions.length === 0) return [];
    
    const filteredQuestions = questions.filter(q => q.text && q.text.trim() !== '');
    console.log('🔍 DEBUG: Filtered questions for bar chart:', filteredQuestions);
    
    const barData = filteredQuestions.map(q => {
      // Controllo che le statistiche esistano e siano valide
      const questionStats = stats[q.id];
      if (!questionStats) {
        console.log('⚠️ DEBUG: No stats for question:', q.id);
        return null;
      }
      
      const data = {
        name: q.text,
        Favorevole: Math.max(0, Number(questionStats.favorevole) || 0),
        Contrario: Math.max(0, Number(questionStats.contrario) || 0),
        Indeciso: Math.max(0, Number(questionStats.indeciso) || 0),
        Astenuto: Math.max(0, Number(questionStats.astenuto) || 0),
      };
      console.log('🔍 DEBUG: Bar data for question', q.id, ':', data);
      return data;
    }).filter(Boolean) as Array<{ name: string; Favorevole: number; Contrario: number; Indeciso: number; Astenuto: number; }>;
    
    console.log('🔍 DEBUG: Final bar data:', barData);
    return barData;
  };
  // === FINE MODIFICHE LOGICA GRAFICI ===

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  // Controllo più flessibile per l'accesso ai sondaggi
  const userRole = user.role || user.ruolo;
  const hasAdvancedAccess = userRole === "Politico" || userRole === "Candidato" || userRole === "Candidato Politico" || userRole === "Admin";
  if (!hasAdvancedAccess) return <Redirect to="/menu" />;

  const barChartData = prepareBarData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto max-w-7xl p-6">
        {/* Header con navigazione */}
        <div className="mb-8">
          <Link href="/menu">
            <Button variant="ghost" className="mb-4 flex items-center text-gray-600 hover:text-gray-800 hover:bg-white/50">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna al Menu
            </Button>
          </Link>
          
          {/* Titolo principale */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center">
              <BarChartIcon className="mr-3 h-10 w-10 text-blue-600" />
              Sondaggi Aggregati
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Statistiche aggregate delle opinioni degli utenti per analizzare le tendenze della comunità
            </p>
          </div>
        </div>

        {/* Loading e Error States */}
        {isLoading && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Caricamento statistiche...</p>
            </div>
          </div>
        )}
        
        {isError && (
          <Card className="bg-white shadow-lg border-red-200">
            <CardContent className="p-8 text-center">
              <div className="text-red-500 text-xl mb-2">⚠️</div>
              <p className="text-red-600 font-medium">Errore nel caricamento delle statistiche.</p>
              <p className="text-gray-500 mt-2">Riprova più tardi o contatta l'amministratore.</p>
            </CardContent>
          </Card>
        )}

        {/* Contenuto principale */}
        {stats && (
          <div className="space-y-8">
            {/* Statistiche generali */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-green-100">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Domande Totali</p>
                      <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-blue-100">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Partecipanti</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Object.values(stats).reduce((total, stat) => 
                          total + (stat.favorevole + stat.contrario + stat.indeciso + stat.astenuto), 0
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Grafico a barre principale */}
            {barChartData && barChartData.length > 0 && (
              <Card className="bg-white shadow-lg">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="text-2xl text-gray-800 flex items-center">
                    <BarChartIcon className="mr-2 h-6 w-6 text-blue-600" />
                    Distribuzione Complessiva delle Opinioni
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Panoramica generale di tutte le opinioni espresse dagli utenti
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Favorevole" fill={COLORS.favorevole} name="Favorevole" />
                      <Bar dataKey="Contrario" fill={COLORS.contrario} name="Contrario" />
                      <Bar dataKey="Indeciso" fill={COLORS.indeciso} name="Indeciso" />
                      <Bar dataKey="Astenuto" fill={COLORS.astenuto} name="Astenuto" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Grafici a torta per singole domande */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {questions
                .filter(q => q.text && q.text.trim() !== '')
                .map(q => {
                  console.log('🔍 DEBUG: Rendering pie chart for question:', q.id, 'with text:', q.text);
                  const pieData = preparePieData(q.id);
                  console.log('🔍 DEBUG: Pie data for question', q.id, ':', pieData);
                  
                  if (pieData.length === 0) {
                    console.log('⚠️ DEBUG: Skipping pie chart for question', q.id, '- no data');
                    return null;
                  }
                  
                  return (
                    <Card key={q.id} className="bg-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                      <CardHeader 
                        className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                        onClick={() => window.location.href = `/statistiche-opinione/${q.id}`}
                      >
                        <CardTitle className="text-lg text-gray-800 hover:text-blue-600 transition-colors">
                          {q.text}
                        </CardTitle>
                        <CardDescription className="text-gray-500">
                          Clicca per vedere i dettagli
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie 
                                data={pieData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                outerRadius={80} 
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'white', 
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        
                        {/* Legenda colori */}
                        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                          {pieData.map((entry, index) => (
                            <div key={index} className="flex items-center">
                              <div 
                                className="w-3 h-3 rounded-full mr-2" 
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-gray-700">{entry.name}: {entry.value}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}