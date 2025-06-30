import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function GestisciGoverno() {
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
            <p className="text-muted-foreground mb-4">Lista attuale dei ministeri:</p>
            <ul className="space-y-2">
              <li><b>Primo Ministro</b> <span className="text-xs text-muted-foreground">(primo_ministro)</span></li>
              <li><b>Ministro degli Esteri</b> <span className="text-xs text-muted-foreground">(esteri)</span></li>
              <li><b>Ministro dell'Interno</b> <span className="text-xs text-muted-foreground">(interno)</span></li>
              <li><b>Ministro della Giustizia</b> <span className="text-xs text-muted-foreground">(giustizia)</span></li>
              <li><b>Ministro della Difesa</b> <span className="text-xs text-muted-foreground">(difesa)</span></li>
              <li><b>Ministro dell'Economia e delle Finanze</b> <span className="text-xs text-muted-foreground">(economia)</span></li>
              <li><b>Ministro del Lavoro e delle Politiche Sociali</b> <span className="text-xs text-muted-foreground">(lavoro)</span></li>
              <li><b>Ministro dell'Istruzione</b> <span className="text-xs text-muted-foreground">(istruzione)</span></li>
              <li><b>Ministro della Salute</b> <span className="text-xs text-muted-foreground">(salute)</span></li>
              <li><b>Ministro della Cultura</b> <span className="text-xs text-muted-foreground">(cultura)</span></li>
              <li><b>Ministro dell'Ambiente della Sicurezza Energetica</b> <span className="text-xs text-muted-foreground">(ambiente_sicurezza_energetica)</span></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 