import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart as BarChartIcon, MapPin, Users, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const COLORS = ['#00C49F', '#FF8042', '#FFBB28']; // Favorevole, Contrario, Astenuto

// Mappa delle regioni italiane
const REGIONI = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna',
  'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana',
  'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto'
];

export default function StatisticheOpinione() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Estrai l'ID dell'opinione dall'URL
  const pathParts = window.location.pathname.split('/');
  const opinionId = pathParts[pathParts.length - 1];

  const { data, isLoading, isError } = useQuery({
    queryKey: ['opinioneStats', opinionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/opinioni/stats/${opinionId}`);
      if (!response.ok) throw new Error("Errore nel caricamento delle statistiche.");
      const result = await response.json();
      return result.data; // Estrai i dati dalla risposta
    },
    enabled: !!user && !!opinionId,
  });

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <div>Non autorizzato</div>;
  if (user.role !== 'Admin') return <div>Non autorizzato</div>;

  const stats = data?.stats || {};
  const questionText = data?.questionText || 'Opinione';

  const pieData = [
    { name: 'Favorevole', value: stats.favorevole || 0 },
    { name: 'Contrario', value: stats.contrario || 0 },
    { name: 'Astenuto', value: stats.astenuto || 0 },
  ];

  const barData = [
    { name: 'Favorevole', value: stats.favorevole || 0 },
    { name: 'Contrario', value: stats.contrario || 0 },
    { name: 'Astenuto', value: stats.astenuto || 0 },
  ];

  const totalVotes = (stats.favorevole || 0) + (stats.contrario || 0) + (stats.astenuto || 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 select-none">
      <div className="container mx-auto max-w-6xl">
        <Link href="/sondaggi">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />Torna ai Sondaggi
          </Button>
        </Link>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center">
              <BarChartIcon className="mr-3 h-8 w-8" />
              {questionText}
            </CardTitle>
            <CardDescription>
              Statistiche dettagliate e analisi regionali
            </CardDescription>
          </CardHeader>
        </Card>

        {isLoading && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {isError && (
          <div className="text-center text-red-500 p-4">
            Errore nel caricamento delle statistiche.
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Statistiche generali */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Totale Voti</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalVotes}</div>
                  <p className="text-xs text-muted-foreground">Risposte totali</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Favorevoli</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.favorevole || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalVotes > 0 ? Math.round(((stats.favorevole || 0) / totalVotes) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Contrari</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.contrario || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalVotes > 0 ? Math.round(((stats.contrario || 0) / totalVotes) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Astenuti</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{stats.astenuto || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalVotes > 0 ? Math.round(((stats.astenuto || 0) / totalVotes) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Grafici */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Grafico a torta */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Distribuzione Voti</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={120} 
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Grafico a barre */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Confronto Numerico</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Pulsanti regionali */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center">
                  <MapPin className="mr-2 h-5 w-5" />
                  Analisi Regionali
                </CardTitle>
                <CardDescription>
                  Clicca su una regione per vedere le statistiche specifiche
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {REGIONI.map((regione) => (
                    <Button
                      key={regione}
                      variant="outline"
                      className="h-auto p-3 flex flex-col items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      onClick={() => setLocation(`/statistiche-opinione/${opinionId}/regione/${regione.toLowerCase().replace(/\s+/g, '-')}`)}
                    >
                      <MapPin className="h-4 w-4 mb-1 text-blue-600" />
                      <span className="text-xs text-center">{regione}</span>
                    </Button>
                  ))}
                </div>
                
                <div className="mt-6 text-center">
                  <Button
                    variant="default"
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setLocation(`/statistiche-opinione/${opinionId}/tutte-regioni`)}
                  >
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Panoramica Tutte le Regioni
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
