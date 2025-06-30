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
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 