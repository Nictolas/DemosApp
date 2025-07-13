import React, { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, BarChart } from "lucide-react";
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type OpinionData = { favorevole: number; contrario: number; astenuto: number; };
type OpinionStats = Record<string, OpinionData>;

function StatisticheOpinioni() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<OpinionStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opinionQuestions, setOpinionQuestions] = useState<{id: string, text: string}[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

  const backgroundColors = { favorevole: 'rgba(75, 192, 192, 0.6)', contrario: 'rgba(255, 99, 132, 0.6)', astenuto: 'rgba(255, 206, 86, 0.6)' };
  const borderColors = { favorevole: 'rgba(75, 192, 192, 1)', contrario: 'rgba(255, 99, 132, 1)', astenuto: 'rgba(255, 206, 86, 1)' };

  // Carica le domande dinamiche da Firebase
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        const opinioniRef = collection(db, "opinioni");
        const snapshot = await getDocs(opinioniRef);
        const questions = snapshot.docs.map(doc => ({ id: doc.data().id, text: doc.data().text }));
        setOpinionQuestions(questions);
      } catch (error) {
        console.error("Errore nel caricamento delle opinioni:", error);
        setError("Impossibile caricare le opinioni disponibili.");
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    if (user) {
      fetchQuestions();
    }
  }, [user]);

  const fetchStats = useCallback(async () => {
    if (!user || opinionQuestions.length === 0) return;
    
    setIsLoadingStats(true);
    setError(null);
    try {
      // Query diretta a Firebase per ottenere tutti gli utenti
      const usersRef = collection(db, "utenti");
      const usersSnapshot = await getDocs(usersRef);

      const initialStats: OpinionStats = {};
      opinionQuestions.forEach(q => {
        initialStats[q.id] = { favorevole: 0, contrario: 0, astenuto: 0 };
      });

      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        opinionQuestions.forEach(q => {
          const opinion = userData[q.id];
          if (typeof opinion === 'string' && ['Favorevole', 'Contrario', 'Indeciso'].includes(opinion)) {
            const keyToIncrement = (opinion === 'Indeciso' ? 'astenuto' : opinion.toLowerCase()) as keyof OpinionData;
            initialStats[q.id][keyToIncrement]++;
          }
        });
      });
      setStats(initialStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento delle statistiche");
    } finally {
      setIsLoadingStats(false);
    }
  }, [opinionQuestions, user]);

  useEffect(() => {
    if (user && opinionQuestions.length > 0) {
      fetchStats();
    }
  }, [fetchStats, user, opinionQuestions]);

  const preparePieChartData = (questionKey: string) => {
    if (!stats) return null;
    const questionStats = stats[questionKey];
    const labels = ['Favorevole', 'Contrario', 'Astenuto'];
    const data = [questionStats.favorevole, questionStats.contrario, questionStats.astenuto];

    return {
      labels,
      datasets: [{ 
        data, 
        backgroundColor: [
          backgroundColors.favorevole,
          backgroundColors.contrario,
          backgroundColors.astenuto
        ], 
        borderColor: [
          borderColors.favorevole,
          borderColors.contrario,
          borderColors.astenuto
        ], 
        borderWidth: 1 
      }]
    };
  };

  const prepareBarChartData = () => {
    if (!stats) return null;
    const labels = opinionQuestions.map(q => q.text);
    return {
      labels,
      datasets: [
        { label: 'Favorevole', data: opinionQuestions.map(q => stats[q.id]?.favorevole ?? 0), backgroundColor: backgroundColors.favorevole },
        { label: 'Contrario', data: opinionQuestions.map(q => stats[q.id]?.contrario ?? 0), backgroundColor: backgroundColors.contrario },
        { label: 'Astenuto', data: opinionQuestions.map(q => stats[q.id]?.astenuto ?? 0), backgroundColor: backgroundColors.astenuto }
      ]
    };
  };

  const barChartData = prepareBarChartData();

  // Mappa per i link di dettaglio
  const detailPageLinks: Record<string, string> = Object.fromEntries(
    opinionQuestions.map(q => [q.id, `/opinioni/${q.id}`])
  );

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (error && error.toLowerCase().includes('forbidden')) {
    return <div className="text-center text-red-500 p-8">Non hai i permessi per accedere a questa pagina.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu</Button></Link>
        <Card>
          <CardHeader><CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center"><BarChart className="mr-2 h-6 w-6 text-primary" /> Statistiche Opinioni</CardTitle><CardDescription>Visualizza statistiche aggregate delle opinioni nella piattaforma DEMOS</CardDescription></CardHeader>
          <CardContent>
            {isLoadingStats && <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            {error && <div className="text-center text-red-500 p-4">{error}</div>}
            {!isLoadingStats && !error && stats && Object.keys(stats).length === 0 && (
              <div className="text-center text-gray-500 p-4">Nessun dato disponibile per le statistiche.</div>
            )}
            {!isLoadingStats && !error && stats && Object.keys(stats).length > 0 && (
              <div className="space-y-8">
                <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xl">Distribuzione complessiva</CardTitle></CardHeader><CardContent><div style={{ height: '300px' }}><Bar data={barChartData!} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div></CardContent></Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {opinionQuestions.map(q => {
                    const pieData = preparePieChartData(q.id);
                    const detailLink = detailPageLinks[q.id];
                    return pieData && (
                      <Link href={detailLink} key={q.id}>
                        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow h-full">
                          <CardHeader className="pb-2"><CardTitle className="text-xl hover:text-primary transition-colors">{q.text}</CardTitle></CardHeader>
                          <CardContent className="flex justify-center">
                            <div style={{ height: '200px', width: '100%', maxWidth: '300px' }}>
                                <Pie data={pieData} options={{ plugins: { legend: { position: 'bottom' } }, responsive: true, maintainAspectRatio: false }} />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
                <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xl">Dati Dettagliati</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr className="bg-secondary/30"><th className="border p-2 text-left">Argomento</th><th className="border p-2 text-center">Favorevoli</th><th className="border p-2 text-center">Astenuti</th><th className="border p-2 text-center">Contrari</th><th className="border p-2 text-center">Totale</th></tr></thead><tbody>{opinionQuestions.map(q => {const questionStats = stats[q.id]; const total = questionStats.favorevole + questionStats.astenuto + questionStats.contrario; return (<tr key={q.id} className="hover:bg-secondary/10"><td className="border p-2 font-medium">{q.text}</td><td className="border p-2 text-center text-emerald-600">{questionStats.favorevole}</td><td className="border p-2 text-center text-amber-600">{questionStats.astenuto}</td><td className="border p-2 text-center text-red-600">{questionStats.contrario}</td><td className="border p-2 text-center font-medium">{total}</td></tr>);})}</tbody></table></div></CardContent></Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default StatisticheOpinioni;