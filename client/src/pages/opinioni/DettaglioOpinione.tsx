import React from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
// === INIZIO MODIFICHE ===
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
// === FINE MODIFICHE ===
import { ITALY_DATA } from "@/data/italyData";

interface DetailStats {
  genderDistributionByOpinion: {
    favorevole: Record<string, number>;
    contrario: Record<string, number>;
    astenuto: Record<string, number>;
  };
  ageDistributionByOpinion?: Record<string, Record<string, number>>;
}

const COLORS = ['#0088FE', '#FF8042', '#FFBB28', '#00C49F'];

export default function DettaglioOpinione({ opinionField, regionName, provinceName, comuneName }: { opinionField: string, regionName?: string, provinceName?: string, comuneName?: string }) {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data, isLoading, isError } = useQuery<{ stats: DetailStats; title: string }>({
    queryKey: ['dettaglioOpinione', opinionField, regionName, provinceName, comuneName],
    queryFn: async () => {
      let apiUrl = `/api/opinioni-dettaglio/${opinionField}`;
      const params = new URLSearchParams();
      if (regionName) params.append('regione', regionName);
      if (provinceName) params.append('provincia', provinceName);
      if (comuneName) params.append('comune', comuneName);
      
      const queryString = params.toString();
      if (queryString) apiUrl += `?${queryString}`;
      
      const response = await apiRequest("GET", apiUrl);
      if (!response.ok) throw new Error("Errore nel caricamento delle statistiche di dettaglio");
      return response.json();
    },
    enabled: !!user,
  });

  const { stats, title: dynamicTitle } = data || {};

  const pageTitle = (() => {
    let title = dynamicTitle || opinionField.replace(/_/g, ' ');
    if (regionName) title += ` - ${regionName.replace(/-/g, ' ')}`;
    if (provinceName) title += ` - ${provinceName.replace(/-/g, ' ')}`;
    if (comuneName) title += ` - ${comuneName.replace(/-/g, ' ')}`;
    return title;
  })();

  const preparePieData = (data: Record<string, number> = {}) => Object.entries(data).map(([name, value]) => ({ name, value }));
  
  const prepareAgeBarData = () => {
    if (!stats?.ageDistributionByOpinion) return [];
    const ageData = stats.ageDistributionByOpinion;
    const allRanges = Array.from(new Set(Object.values(ageData).flatMap(Object.keys))).sort();
    return allRanges.map(range => ({
        name: range,
        Favorevole: ageData.favorevole?.[range] || 0,
        Contrario: ageData.contrario?.[range] || 0,
        Astenuto: ageData.astenuto?.[range] || 0,
    }));
  };

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;

  return (
    <div className="min-h-screen bg-gray-50 p-4 page-with-navbar">
      <div className="container mx-auto max-w-5xl">
        <Link href={regionName ? `/sondaggi/${opinionField}` : "/sondaggi"}><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna Indietro</Button></Link>
        
        {/* Navigazione per Province e Comuni (invariata) */}

        {isLoading && <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>}
        {isError && <p className="text-center text-red-500">Errore nel caricamento dei dati.</p>}
        
        {stats && (
          <div className="space-y-8">
            <Card><CardHeader><CardTitle className="text-3xl font-bold capitalize">{pageTitle}</CardTitle></CardHeader></Card>

            {stats.ageDistributionByOpinion && (
              <Card>
                <CardHeader><CardTitle>Suddivisione per Fascia d'Età</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={prepareAgeBarData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Favorevole" fill={COLORS[3]} />
                      <Bar dataKey="Contrario" fill={COLORS[1]} />
                      <Bar dataKey="Astenuto" fill={COLORS[2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {stats.genderDistributionByOpinion && (
              <Card>
                <CardHeader><CardTitle>Distribuzione per Genere e Opinione</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['favorevole', 'contrario', 'astenuto'].map((opinionType, idx) => (
                    <div className="text-center" key={opinionType}>
                      <h3 className="font-semibold mb-2 capitalize">{opinionType}</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={preparePieData(stats.genderDistributionByOpinion[opinionType as keyof typeof stats.genderDistributionByOpinion])} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                              {preparePieData(stats.genderDistributionByOpinion[opinionType as keyof typeof stats.genderDistributionByOpinion]).map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
