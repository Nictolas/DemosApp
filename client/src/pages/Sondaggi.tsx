import React from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart as BarChartIcon } from "lucide-react";
// === INIZIO MODIFICHE ===
import { PieChart, Pie, Cell, Tooltip, Legend, Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
// === FINE MODIFICHE ===
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type OpinionData = { favorevole: number; contrario: number; astenuto: number; };
type OpinionStats = Record<string, OpinionData>;
interface Question { id: string; text: string; }
interface SondaggiData {
    stats: OpinionStats;
    questions: Question[];
}

const COLORS = ['#00C49F', '#FF8042', '#FFBB28']; // Favorevole, Contrario, Astenuto

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
    const astenuto = Math.max(0, Number(questionStats.astenuto) || 0);
    
    // Controllo che almeno un valore sia maggiore di 0
    if (favorevole === 0 && contrario === 0 && astenuto === 0) {
      console.log('⚠️ DEBUG: All values are 0 for question:', questionKey);
      return [];
    }
    
    return [
        { name: 'Favorevole', value: favorevole },
        { name: 'Contrario', value: contrario },
        { name: 'Astenuto', value: astenuto },
    ];
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
        Astenuto: Math.max(0, Number(questionStats.astenuto) || 0),
      };
      console.log('🔍 DEBUG: Bar data for question', q.id, ':', data);
      return data;
    }).filter(Boolean) as Array<{ name: string; Favorevole: number; Contrario: number; Astenuto: number; }>;
    
    console.log('🔍 DEBUG: Final bar data:', barData);
    return barData;
  };
  // === FINE MODIFICHE LOGICA GRAFICI ===

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  // Controllo più flessibile per l'accesso ai sondaggi
  if (user.role !== 'Admin' && user.role !== 'admin' && !user.hasAdvancedAccess) return <Redirect to="/menu" />;

  const barChartData = prepareBarData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card>
          <CardHeader><CardTitle className="text-2xl flex items-center"><BarChartIcon className="mr-2 h-6 w-6" />Sondaggi Aggregati</CardTitle><CardDescription>Statistiche aggregate delle opinioni degli utenti.</CardDescription></CardHeader>
          <CardContent>
            {isLoading && <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {isError && <div className="text-center text-red-500 p-4">Errore nel caricamento delle statistiche.</div>}
            {stats && (
              <div className="space-y-8">
                {/* === INIZIO MODIFICHE GRAFICI === */}
                {barChartData && barChartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Distribuzione complessiva</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={barChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false}/>
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Favorevole" fill={COLORS[0]} />
                          <Bar dataKey="Contrario" fill={COLORS[1]} />
                          <Bar dataKey="Astenuto" fill={COLORS[2]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {questions
                    .filter(q => q.text && q.text.trim() !== '') // Filtra solo domande con testo valido
                    .map(q => {
                    console.log('🔍 DEBUG: Rendering pie chart for question:', q.id, 'with text:', q.text);
                    const pieData = preparePieData(q.id);
                    console.log('🔍 DEBUG: Pie data for question', q.id, ':', pieData);
                    
                    if (pieData.length === 0) {
                      console.log('⚠️ DEBUG: Skipping pie chart for question', q.id, '- no data');
                      return null;
                    }
                    
                    return (
                      <Card key={q.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                        <CardHeader 
                          className="cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => window.location.href = `/statistiche-opinione/${q.id}`}
                        >
                          <CardTitle className="text-xl text-blue-600 hover:text-blue-800">
                            {q.text}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                    </Pie>
                                    <Tooltip/>
                                    <Legend/>
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                 {/* === FINE MODIFICHE GRAFICI === */}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}