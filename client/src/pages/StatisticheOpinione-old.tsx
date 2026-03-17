import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart as BarChartIcon, Users, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const COLORS = ['#10B981', '#EF4444', '#FCD34D', '#6B7280']; // Favorevole, Contrario, Indeciso, Astenuto

// Mappa delle regioni italiane (come in Sondaggi.tsx)
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
  let opinionId = pathParts[pathParts.length - 1];
  
  // Se siamo in una pagina regionale, l'opinionId è prima di "regione"
  if (pathParts.includes('regione')) {
    const regioneIndex = pathParts.indexOf('regione');
    opinionId = pathParts[regioneIndex - 1];
  }
  
  console.log('🔍 DEBUG StatisticheOpinione - OpinionId estratto:', opinionId);

  // Query per statistiche generali
  const { data, isLoading, isError } = useQuery({
    queryKey: ['opinioneStats', opinionId, window.location.pathname],
    queryFn: async () => {
      // Controlla se siamo in una pagina regionale
      const pathParts = window.location.pathname.split('/');
      let endpoint = `/api/opinioni/stats/${opinionId}`;
      
      // Se l'URL contiene "regione", usa l'endpoint filtrato
      if (pathParts.includes('regione') && pathParts.length > 3) {
        const regioneIndex = pathParts.indexOf('regione');
        const regione = pathParts[regioneIndex + 1];
        endpoint = `/api/opinioni/stats/${opinionId}/regione/${regione}`;
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint stats regionale:', endpoint);
      } else {
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint stats nazionale:', endpoint);
      }
      
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) throw new Error("Errore nel caricamento delle statistiche.");
      const result = await response.json();
      console.log('🔍 DEBUG StatisticheOpinione - Dati stats ricevuti:', result.data);
      return result.data;
    },
    enabled: !!user && !!opinionId,
  });

  // Query per statistiche per genere (filtrate in base al contesto)
  const { data: genereData } = useQuery({
    queryKey: ['opinioneStatsGenere', opinionId, window.location.pathname],
    queryFn: async () => {
      // Controlla se siamo in una pagina regionale
      const pathParts = window.location.pathname.split('/');
      let endpoint = `/api/opinioni/stats/${opinionId}/genere`;
      
      // Se l'URL contiene "regione", usa l'endpoint filtrato
      if (pathParts.includes('regione') && pathParts.length > 3) {
        const regioneIndex = pathParts.indexOf('regione');
        const regione = pathParts[regioneIndex + 1];
        endpoint = `/api/opinioni/stats/${opinionId}/genere/${regione}`;
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint genere regionale:', endpoint);
      } else {
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint genere nazionale:', endpoint);
      }
      
      const response = await apiRequest("GET", endpoint, null, {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      if (!response.ok) throw new Error("Errore nel caricamento statistiche genere.");
      const result = await response.json();
      console.log('🔍 DEBUG StatisticheOpinione - Dati genere ricevuti:', result.data);
      return result.data;
    },
    enabled: !!user && !!opinionId,
    staleTime: 0,
    cacheTime: 0,
  });

  // Query per statistiche per età
  const { data: etaData } = useQuery({
    queryKey: ['opinioneStatsEta', opinionId, window.location.pathname],
    queryFn: async () => {
      // Controlla se siamo in una pagina regionale
      const pathParts = window.location.pathname.split('/');
      let endpoint = `/api/opinioni/stats/${opinionId}/eta`;
      
      // Se l'URL contiene "regione", usa l'endpoint filtrato
      if (pathParts.includes('regione') && pathParts.length > 3) {
        const regioneIndex = pathParts.indexOf('regione');
        const regione = pathParts[regioneIndex + 1];
        endpoint = `/api/opinioni/stats/${opinionId}/eta/regione/${regione}`;
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint età regionale:', endpoint);
      } else {
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint età nazionale:', endpoint);
      }
      
      const response = await apiRequest("GET", endpoint, null, {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      if (!response.ok) throw new Error("Errore nel caricamento statistiche età.");
      const result = await response.json();
      console.log('🔍 DEBUG StatisticheOpinione - Dati età ricevuti:', result.data);
      return result.data;
    },
    enabled: !!user && !!opinionId,
    staleTime: 0,
    cacheTime: 0,
  });

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <div>Non autorizzato</div>;
  
  // Controllo più flessibile per l'accesso alle statistiche
  const userRole = user.role || user.ruolo;
  const hasAdvancedAccess = userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD";
  if (!hasAdvancedAccess) return <div>Non autorizzato</div>;

  const stats = data?.stats || {};
  const questionText = data?.questionText || 'Opinione';
  const totaleUtenti = data?.totaleUtenti || 0;





  // Calcola il totale voti correttamente (solo chi ha risposto)
  const totalVotes = (parseInt(stats.favorevole) || 0) + (parseInt(stats.contrario) || 0) + (parseInt(stats.indeciso) || 0);

  const pieData = [
    { name: 'Favorevole', value: parseInt(stats.favorevole) || 0 },
    { name: 'Contrario', value: parseInt(stats.contrario) || 0 },
    { name: 'Indeciso', value: parseInt(stats.indeciso) || 0 },
    { name: 'Astenuto', value: parseInt(stats.astenuto) || 0 },
  ];



  // Debug: log dei dati ricevuti per genere
  console.log('🔍 DEBUG - genereData ricevuto:', genereData);

  // Prepara dati per genere (bar chart orizzontale)
  const genereBarData = [
    {
      name: 'Favorevole',
      uomo: parseInt(genereData?.find(item => item.genere === 'uomo')?.favorevole) || 0,
      donna: parseInt(genereData?.find(item => item.genere === 'donna')?.favorevole) || 0,
      altro: parseInt(genereData?.find(item => item.genere === 'altro')?.favorevole) || 0,
    },
    {
      name: 'Indeciso',
      uomo: parseInt(genereData?.find(item => item.genere === 'uomo')?.indeciso) || 0,
      donna: parseInt(genereData?.find(item => item.genere === 'donna')?.indeciso) || 0,
      altro: parseInt(genereData?.find(item => item.genere === 'altro')?.indeciso) || 0,
    },
    {
      name: 'Contrario',
      uomo: parseInt(genereData?.find(item => item.genere === 'uomo')?.contrario) || 0,
      donna: parseInt(genereData?.find(item => item.genere === 'donna')?.contrario) || 0,
      altro: parseInt(genereData?.find(item => item.genere === 'altro')?.contrario) || 0,
    },
    {
      name: 'Astenuto',
      uomo: parseInt(genereData?.find(item => item.genere === 'uomo')?.astenuto) || 0,
      donna: parseInt(genereData?.find(item => item.genere === 'donna')?.astenuto) || 0,
      altro: parseInt(genereData?.find(item => item.genere === 'altro')?.astenuto) || 0,
    },
  ];

  console.log('🔍 DEBUG - genereBarData preparato:', genereBarData);

  // Prepara dati per il grafico a torta del genere (distribuzione generale)
  const generePieData = genereData ? [
    { name: 'Uomo', value: parseInt(genereData?.find(item => item.genere === 'uomo')?.favorevole || 0) + parseInt(genereData?.find(item => item.genere === 'uomo')?.contrario || 0) + parseInt(genereData?.find(item => item.genere === 'uomo')?.indeciso || 0) + parseInt(genereData?.find(item => item.genere === 'uomo')?.astenuto || 0) },
    { name: 'Donna', value: parseInt(genereData?.find(item => item.genere === 'donna')?.favorevole || 0) + parseInt(genereData?.find(item => item.genere === 'donna')?.contrario || 0) + parseInt(genereData?.find(item => item.genere === 'donna')?.indeciso || 0) + parseInt(genereData?.find(item => item.genere === 'donna')?.astenuto || 0) },
    { name: 'Altro', value: parseInt(genereData?.find(item => item.genere === 'altro')?.favorevole || 0) + parseInt(genereData?.find(item => item.genere === 'altro')?.contrario || 0) + parseInt(genereData?.find(item => item.genere === 'altro')?.indeciso || 0) + parseInt(genereData?.find(item => item.genere === 'altro')?.astenuto || 0) },
  ].filter(item => item.value > 0) : [];

  const GENERE_COLORS = ['#3B82F6', '#EC4899', '#FCD34D']; // Blu, Rosa, Giallo



  // Prepara dati per età (bar chart orizzontale)
  const etaBarData = etaData?.map(item => ({
    name: item.fascia_eta,
    Favorevole: parseInt(item.favorevole) || 0,
    Indeciso: parseInt(item.indeciso) || 0,
    Contrario: parseInt(item.contrario) || 0,
    Astenuto: parseInt(item.astenuto) || 0,
  })) || [];



     return (
     <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar" style={{ paddingBottom: '6rem' }}>
      <div className="container mx-auto max-w-7xl p-6">
        {/* Header con navigazione */}
        <div className="mb-8">
          <Link href="/sondaggi">
            <Button variant="ghost" className="mb-4 flex items-center text-gray-600 hover:text-gray-800 hover:bg-white/50">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna ai Sondaggi
            </Button>
          </Link>
          
          {/* Titolo principale */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center">
              <BarChartIcon className="mr-3 h-10 w-10 text-blue-600" />
              {questionText}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Statistiche dettagliate e analisi regionali
            </p>
          </div>
        </div>

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
          <div className="space-y-8">
            {/* Statistiche generali */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-purple-100">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Totale Utenti</p>
                      <p className="text-2xl font-bold text-gray-900">{totaleUtenti}</p>
                      <p className="text-xs text-muted-foreground">Utenti registrati</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-blue-100">
                      <BarChartIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Favorevoli</p>
                                             <p className="text-2xl font-bold text-green-600">{parseInt(stats.favorevole) || 0}</p>
                      <p className="text-xs text-muted-foreground">
                                                 {totalVotes > 0 ? Math.round(((parseInt(stats.favorevole) || 0) / totalVotes) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-red-100">
                      <BarChartIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Contrari</p>
                                             <p className="text-2xl font-bold text-red-600">{parseInt(stats.contrario) || 0}</p>
                      <p className="text-xs text-muted-foreground">
                                                 {totalVotes > 0 ? Math.round(((parseInt(stats.contrario) || 0) / totalVotes) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pulsanti per statistiche regionali (come in Sondaggi.tsx) */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {REGIONI.map((regione) => (
                    <Button
                      key={regione}
                      variant="outline"
                      className="w-full h-16 text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      onClick={() => setLocation(`/statistiche-opinione/${opinionId}/regione/${regione.toLowerCase().replace(/\s+/g, '-')}`)}
                    >
                      {regione}
                    </Button>
                  ))}
                  <Button
                    variant="default"
                    className="w-full h-16 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setLocation(`/statistiche-opinione/${opinionId}/tutte-regioni`)}
                  >
                    Italia
                  </Button>
                </div>
              </CardContent>
            </Card>

                         {/* Grafico principale - TORTA */}
             <Card className="bg-white shadow-lg">
               <CardHeader>
                 <CardTitle className="text-xl">Distribuzione Voti</CardTitle>
               </CardHeader>
               <CardContent className="h-80">
                 {pieData.some(item => item.value > 0) ? (
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
                     </PieChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="flex items-center justify-center h-full text-gray-500">
                     Nessun dato disponibile
                   </div>
                 )}
               </CardContent>
             </Card>

                         {/* Grafico per genere */}
             <div className="grid grid-cols-1 gap-6">
                             {/* Grafico per genere - BARRE ORIZZONTALI */}
               <Card className="bg-white shadow-lg">
                 <CardHeader>
                   <CardTitle className="text-xl">Distribuzione per Genere</CardTitle>
                 </CardHeader>
                 <CardContent className="h-80">
                   {genereBarData.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={genereBarData} layout="horizontal">
                         <CartesianGrid strokeDasharray="3 3" />
                         <XAxis type="number" allowDecimals={false} />
                         <YAxis dataKey="name" type="category" />
                         <Tooltip />
                         <Bar dataKey="uomo" fill="#3B82F6" />
                         <Bar dataKey="donna" fill="#EC4899" />
                         <Bar dataKey="altro" fill="#FCD34D" />
                       </BarChart>
                     </ResponsiveContainer>
                   ) : (
                     <div className="flex items-center justify-center h-full text-gray-500">
                       Nessun dato disponibile
                     </div>
                   )}
                 </CardContent>
               </Card>
             </div>

             {/* Grafico per età */}
             <div className="grid grid-cols-1 gap-6">
               <Card className="bg-white shadow-lg">
                 <CardHeader>
                   <CardTitle className="text-xl">Distribuzione per Età</CardTitle>
                 </CardHeader>
                 <CardContent className="h-80">
                   {etaBarData.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={etaBarData} layout="horizontal">
                         <CartesianGrid strokeDasharray="3 3" />
                         <XAxis type="number" allowDecimals={false} />
                         <YAxis dataKey="name" type="category" />
                         <Tooltip />
                         <Bar dataKey="Favorevole" fill="#10B981" />
                         <Bar dataKey="Indeciso" fill="#FCD34D" />
                         <Bar dataKey="Contrario" fill="#EF4444" />
                         <Bar dataKey="Astenuto" fill="#6B7280" />
                       </BarChart>
                     </ResponsiveContainer>
                   ) : (
                     <div className="flex items-center justify-center h-full text-gray-500">
                       Nessun dato disponibile
                     </div>
                   )}
                 </CardContent>
               </Card>
             </div>

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
