import React, { useMemo } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUsers } from "./Utenti/hooks/useUsers";
// === INIZIO MODIFICHE ===
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// === FINE MODIFICHE ===

type StatisticheUtenti = {
  totalUsers: number;
  usersByRole: Record<string, number>;
  usersByGender: Record<string, number>;
  usersByCitizenship: Record<string, number>;
  usersByRegion: Record<string, number>;
  usersByCity: Record<string, number>;
};

// I colori ora sono definiti in un formato diverso per Recharts
// Colori per i grafici - più colori per evitare duplicati
// Colori specifici per genere: uomo=azzurro, donna=rosa
const COLORS = ['#87CEEB', '#FFB6C1', '#FFD700', '#98FB98', '#DDA0DD', '#F0E68C', '#FFA07A', '#20B2AA', '#FF6347', '#40E0D0', '#EE82EE', '#90EE90', '#F4A460', '#87CEFA', '#D8BFD8', '#F5DEB3'];

export default function StatisticheUtenti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  // Usa i dati degli utenti già caricati
  const {
    responseData,
    isLoadingUsers,
    isError: isErrorUsers
  } = useUsers(user);

  // Calcola le statistiche dai dati degli utenti
  const stats = useMemo<StatisticheUtenti | null>(() => {
    if (!responseData?.utenti) return null;
    
    const utenti = responseData.utenti;
    
    // Calcola distribuzioni
    const usersByRole = utenti.reduce((acc, user) => {
      const role = user.ruolo || 'N/A';
      // Filtra il ruolo "Utente" che non esiste
      if (role === 'Utente') return acc;
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const usersByGender = utenti.reduce((acc, user) => {
      const gender = user.genere || 'N/A';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const usersByCitizenship = utenti.reduce((acc, user) => {
      const citizenship = user.cittadinanza || user.paese_residenza || 'N/A';
      acc[citizenship] = (acc[citizenship] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const usersByRegion = utenti.reduce((acc, user) => {
      const region = user.regione_residenza || 'N/A';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const usersByCity = utenti.reduce((acc, user) => {
      const city = user.comune_residenza || 'N/A';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalUsers: utenti.length,
      usersByRole,
      usersByGender,
      usersByCitizenship,
      usersByRegion,
      usersByCity
    };
  }, [responseData?.utenti]);
  
  const isLoading = isLoadingUsers;
  const isError = isErrorUsers;

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  if (user.ruolo !== "AD") return <Redirect to="/menu" />;

  // === INIZIO MODIFICHE LOGICA GRAFICI ===
  // Funzione per preparare i dati per i grafici a torta di Recharts
  const preparePieData = (data: Record<string, number>) => {
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  };
  // === FINE MODIFICHE LOGICA GRAFICI ===
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><Users className="mr-2 h-6 w-6" />Statistiche Utenti</CardTitle>
            <CardDescription>Statistiche aggregate degli utenti della piattaforma DEMOS.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {isError && <div className="text-center text-red-500 p-4">Errore nel caricamento delle statistiche.</div>}
            {stats && (
              <div className="space-y-8">
                <Card>
                  <CardHeader><CardTitle>Utenti Totali</CardTitle></CardHeader>
                  <CardContent><div className="text-4xl font-bold text-primary">{stats.totalUsers}</div></CardContent>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* === INIZIO MODIFICHE GRAFICI === */}
                  <Card><CardHeader><CardTitle>Distribuzione per Ruolo</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={preparePieData(stats.usersByRole)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>{preparePieData(stats.usersByRole).map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
                  <Card><CardHeader><CardTitle>Distribuzione per Genere</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={preparePieData(stats.usersByGender)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>{preparePieData(stats.usersByGender).map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
                  <Card><CardHeader><CardTitle>Distribuzione per Cittadinanza</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={preparePieData(stats.usersByCitizenship)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>{preparePieData(stats.usersByCitizenship).map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
                  <Card><CardHeader><CardTitle>Distribuzione per Regione</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={preparePieData(stats.usersByRegion)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>{preparePieData(stats.usersByRegion).map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
                  {/* === FINE MODIFICHE GRAFICI === */}
                </div>
                <Card>
                  <CardHeader><CardTitle>Le 10 città con più utenti</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead><tr><th className="p-2 text-left">Città</th><th className="p-2 text-left">Numero Utenti</th></tr></thead>
                        <tbody>
                          {Object.entries(stats.usersByCity).sort(([,a], [,b]) => b - a).slice(0, 10).map(([city, count]) => (
                            <tr key={city}><td className="p-2 font-medium">{city}</td><td className="p-2">{count}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
