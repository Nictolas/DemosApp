import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Users, BarChart2, PieChart } from "lucide-react";

// Funzione per fare il fetch dei dati
const fetchPersonalStats = async () => {
  const response = await fetch('/api/statistiche-personali');
  if (!response.ok) {
    throw new Error('Errore nel caricamento delle statistiche');
  }
  return response.json();
};

export default function StatistichePersonali() {
  const { user, userData } = useAuth(); // Assumiamo che useAuth restituisca anche i dati completi

  // Fetch dei dati con TanStack Query
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['statistichePersonali'],
    queryFn: fetchPersonalStats,
    enabled: !!user, // Esegui la query solo se l'utente è loggato
  });

  // --- CONTROLLO ACCESSI ---
  const userRole = userData?.ruolo;
  const allowedRoles = ["Politico", "Candidato", "Candidato Politico"];
  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Accesso Negato</AlertTitle>
            <AlertDescription>
              Questa pagina è riservata a Politici e Candidati. Il tuo ruolo attuale: {userRole || 'Non definito'}.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Le tue Statistiche Personali</h1>

        {isLoading && <div className="text-center">Caricamento statistiche...</div>}
        {isError && (
            <Alert variant="destructive" className="max-w-3xl mx-auto">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Errore</AlertTitle>
                <AlertDescription>Impossibile caricare i dati. Riprova più tardi.</AlertDescription>
            </Alert>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">

            {/* Card Totale Sostenitori */}
            <Card className="col-span-1 md:col-span-2 lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Totale Sostenitori</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalSostenitori}</div>
                <p className="text-xs text-muted-foreground">Numero totale di utenti che ti supportano</p>
              </CardContent>
            </Card>

            {/* Card Distribuzione Genere */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><PieChart className="mr-2 h-5 w-5"/>Distribuzione Genere</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {Object.entries(stats.genderDistribution).map(([gender, count]) => (
                    <li key={gender} className="flex justify-between">
                      <span>{gender}</span>
                      <span className="font-bold">{count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Card Distribuzione Età */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center"><BarChart2 className="mr-2 h-5 w-5"/>Distribuzione per Età</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                    {Object.entries(stats.ageDistribution).map(([range, count]) => (
                        <li key={range} className="flex justify-between items-center">
                            <span>Fascia: {range}</span>
                            <span className="font-bold">{count}</span>
                        </li>
                    ))}
                </ul>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
}