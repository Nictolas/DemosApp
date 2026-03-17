import React from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart as BarChartIcon, TrendingUp, Users, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import SondaggiContent from "@/components/SondaggiContent";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

type OpinionData = { favorevole: number; contrario: number; indeciso: number; astenuto: number; };
type OpinionStats = Record<string, OpinionData>;
interface Question { id: string; text: string; }
interface SondaggiData {
    stats: OpinionStats;
    questions: Question[];
    utentiUnici?: number;
}

// Colori corretti per le risposte
const COLORS = {
  favorevole: '#10B981', // Verde
  contrario: '#EF4444',  // Rosso
  indeciso: '#FCD34D',   // Giallo (corretto)
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
      return result.data;
    },
    enabled: !!user,
  });

  // Query per statistiche del genere
  const { data: genereData } = useQuery({
    queryKey: ['sondaggiGenere'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sondaggi/genere");
      if (!response.ok) throw new Error("Errore nel caricamento statistiche genere.");
      const result = await response.json();
      return result.data;
    },
    enabled: !!user,
  });
  
  const { stats, questions = [], utentiUnici = 0 } = data || {};

  // Prepara dati per il grafico a torta del genere
  const generePieData = genereData ? [
    { name: 'Uomo', value: parseInt(genereData.uomo) || 0 },
    { name: 'Donna', value: parseInt(genereData.donna) || 0 },
    { name: 'Altro', value: parseInt(genereData.altro) || 0 },
  ].filter(item => item.value > 0) : [];

  const GENERE_COLORS = ['#3B82F6', '#EC4899', '#FCD34D']; // Blu, Rosa, Giallo

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  
  // Controllo più flessibile per l'accesso ai sondaggi
  const userRole = user.role || user.ruolo;
  const hasAdvancedAccess = userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD";
  if (!hasAdvancedAccess) return <Redirect to="/menu" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar">
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
              Sondaggi
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
                      <p className="text-sm font-medium text-gray-600">Voti Totali</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Object.values(stats).reduce((total, stat) => 
                          total + (stat.favorevole + stat.contrario + stat.indeciso + stat.astenuto), 0
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-purple-100">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                                         <div className="ml-4">
                       <p className="text-sm font-medium text-gray-600">Utenti Totali</p>
                       <p className="text-2xl font-bold text-gray-900">
                         {utentiUnici}
                       </p>
                     </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pulsanti per statistiche regionali */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {['Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto'].map((regione) => (
                    <Link key={regione} href={`/sondaggi/${regione.toLowerCase().replace(/\s+/g, '-')}`}>
                      <Button 
                        variant="outline" 
                        className="w-full h-16 text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        {regione}
                      </Button>
                    </Link>
                  ))}
                  <Link href="/sondaggi/italia">
                    <Button 
                      variant="default" 
                      className="w-full h-16 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Italia
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Contenuto dei sondaggi nazionali */}
            <SondaggiContent />

            {/* Grafico a torta del genere */}
            {generePieData.length > 0 && (
              <Card className="bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl">Distribuzione per Genere</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={generePieData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={120} 
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {generePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={GENERE_COLORS[index % GENERE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
