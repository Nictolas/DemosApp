import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";

interface Ministero {
  id: string;
  nome: string;
  categoria: string;
  descrizione?: string;
}

export default function GestisciGoverno() {
  const [ministeri, setMinisteri] = useState<Ministero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ministeri")
      .then((res) => res.json())
      .then((data) => {
        setMinisteri(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Errore nel caricamento dei ministeri");
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Card className="mb-6">
          <CardHeader className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-600" />
            <CardTitle className="text-2xl font-bold">Gestisci Governo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Qui potrai gestire i dati e le funzionalità relative al Governo ideale.</p>
            <p className="text-muted-foreground mb-4">Lista attuale dei ministeri (letti da Firestore):</p>
            {loading && <p>Caricamento...</p>}
            {error && <p className="text-red-600">{error}</p>}
            {!loading && !error && (
              <ul className="space-y-2">
                {ministeri.length === 0 && <li>Nessun ministero presente.</li>}
                {ministeri.map((m) => (
                  <li key={m.id}>
                    <b>{m.nome}</b> <span className="text-xs text-muted-foreground">({m.categoria})</span>
                    {m.descrizione && <div className="text-xs text-muted-foreground">{m.descrizione}</div>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 