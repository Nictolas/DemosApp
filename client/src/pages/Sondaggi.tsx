import React from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart } from "lucide-react";
// === INIZIO MODIFICHE ===
import { PieChart, Pie, Cell, Tooltip, Legend, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
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
      return response.json();
    },
    enabled: !!user,
  });
  
  const { stats, questions = [] } = data || {};
  
  // === INIZIO MODIFICHE LOGICA GRAFICI ===
  const preparePieData = (questionKey: string) => {
    if (!stats) return [];
    const questionStats = stats[questionKey];
    return [
        { name: 'Favorevole', value: questionStats.favorevole },
        { name: 'Contrario', value: questionStats.contrario },
        { name: 'Astenuto', value: questionStats.astenuto },
    ];
  };

  const prepareBarData = () => {
    if (!stats || questions.length === 0) return [];
    return questions.map(q => ({
        name: q.text,
        Favorevole: stats[q.id]?.favorevole ?? 0,
        Contrario: stats[q.id]?.contrario ?? 0,
        Astenuto: stats[q.id]?.astenuto ?? 0,
    }));
  };
  // === FINE MODIFICHE LOGICA GRAFICI ===

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  if (user.ruolo !== 'Admin') return <Redirect to="/menu" />;

  const barChartData = prepareBarData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card>
          <CardHeader><CardTitle className="text-2xl flex items-center"><BarChart className="mr-2 h-6 w-6" />Sondaggi Aggregati</CardTitle><CardDescription>Statistiche aggregate delle opinioni degli utenti.</CardDescription></CardHeader>
          <CardContent>
            {isLoading && <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {isError && <div className="text-center text-red-500 p-4">Errore nel caricamento delle statistiche.</div>}
            {stats && (
              <div className="space-y-8">
                {/* === INIZIO MODIFICHE GRAFICI === */}
                {barChartData && <Card><CardHeader><CardTitle className="text-xl">Distribuzione complessiva</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={barChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false}/><Tooltip /><Legend /><Bar dataKey="Favorevole" fill={COLORS[0]} /><Bar dataKey="Contrario" fill={COLORS[1]} /><Bar dataKey="Astenuto" fill={COLORS[2]} /></BarChart></ResponsiveContainer></CardContent></Card>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {questions.map(q => {
                    const pieData = preparePieData(q.id);
                    return pieData.length > 0 && (
                      <Card key={q.id}>
                        <CardHeader><CardTitle className="text-xl">{q.text}</CardTitle></CardHeader>
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