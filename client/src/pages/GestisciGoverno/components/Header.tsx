import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export function Header() {
  const [, setLocation] = useLocation();

  return (
    <>
      <Button 
        variant="ghost" 
        className="mb-4 flex items-center" 
        onClick={() => setLocation("/gestisci")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> 
        Torna a Gestisci
      </Button>
      
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-600" />
          <CardTitle className="text-2xl font-bold">
            Gestisci Ministeri del Governo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Aggiungi, modifica o elimina i ministeri disponibili per la votazione del Governo Ideale.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
