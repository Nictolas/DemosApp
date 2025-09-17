import React, { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users, Eye, EyeOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
// === INIZIO MODIFICHE ===
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
// === FINE MODIFICHE ===

interface SupporterStats {
  totalSupporters: number;
  genderDistribution: { Maschio: number; Femmina: number; Altro: number; };
  locationDistribution: Record<string, number>;
  averageAge: number;
  ageDistribution: Record<string, number>;
}

interface Supporter {
  uid: string;
  nome: string;
  cognome: string;
  email: string;
  supporterRoles: string[];
}

interface SostenitoriData {
    stats: SupporterStats;
    supporters: Supporter[];
}

const COLORS = ['#0088FE', '#FF8042', '#FFBB28'];

export default function Sostenitori() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [showSupportersList, setShowSupportersList] = useState(false);

  const { data, isLoading, isError } = useQuery<SostenitoriData>({
    queryKey: ['sostenitoriData', user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Utente non autenticato");
      const response = await apiRequest("GET", `/api/sostenitori?sostenuto_id=${user.uid}`);
      if (!response.ok) throw new Error("Errore nel caricamento dei dati dei sostenitori");
      return response.json();
    },
    enabled: !!user,
  });

  const { stats, supporters = [] } = data || {};
  
  // === INIZIO MODIFICHE LOGICA GRAFICI ===
  const genderChartData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.genderDistribution).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const ageChartData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.ageDistribution).map(([name, value]) => ({ name, 'Numero Sostenitori': value }));
  }, [stats]);
  // === FINE MODIFICHE LOGICA GRAFICI ===


  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;

  const isAuthorized = ["Politico", "Candidato", "Candidato Politico", "Admin"].includes(user.ruolo);
  if (!isAuthorized) {
    return (
        <div className="min-h-screen p-4 flex items-center justify-center">
            <Card className="text-center p-6"><CardTitle className="text-red-600">Accesso Negato</CardTitle><CardDescription>Non hai i permessi per visualizzare questa pagina.</CardDescription></Card>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-6xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><Users className="mr-2 h-6 w-6" />I Miei Sostenitori</CardTitle>
            <CardDescription>Statistiche dettagliate e lista dei tuoi sostenitori.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="flex items-center justify-center py-16"><Loader2 className="h-12 w-12 animate-spin" /></div>}
            {isError && <div className="text-center text-red-500 p-8">Errore nel caricamento dei dati.</div>}
            {stats && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.totalSupporters}</p><p className="text-sm text-muted-foreground">Sostenitori Totali</p></CardContent></Card>
                    <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.averageAge.toFixed(1)}</p><p className="text-sm text-muted-foreground">Età Media</p></CardContent></Card>
                </div>

                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setShowSupportersList(prev => !prev)}>
                    {showSupportersList ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    {showSupportersList ? 'Nascondi Lista' : `Mostra Lista (${supporters.length})`}
                  </Button>
                </div>
                
                {showSupportersList && <SupportersTable supporters={supporters} />}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* === INIZIO MODIFICHE GRAFICI === */}
                  <Card><CardHeader><CardTitle>Distribuzione per Genere</CardTitle></CardHeader><CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={genderChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                          {genderChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent></Card>
                  
                  <Card><CardHeader><CardTitle>Distribuzione per Età</CardTitle></CardHeader><CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ageChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Numero Sostenitori" fill="#82ca9d" />
                        </BarChart>
                    </ResponsiveContainer>
                  </CardContent></Card>
                  {/* === FINE MODIFICHE GRAFICI === */}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const SupportersTable = ({ supporters }: { supporters: Supporter[] }) => (
    <Card><CardHeader><CardTitle>Lista Sostenitori</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead><tr><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Ruoli Sostenuti</th></tr></thead>
                <tbody>
                    {supporters.map((s) => (
                        <tr key={s.uid}><td className="p-2">{s.nome} {s.cognome}</td><td className="p-2">{s.email}</td><td className="p-2">{s.supporterRoles.join(', ')}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    </CardContent></Card>
);
