import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useOpinioniData } from "./hooks";
import { OpinioniProposte, ListaOpinioni } from "./components";

export default function GestisciOpinioni() {
  const [, setLocation] = useLocation();
  const { opinioni, proposte, isLoading, isLoadingProposte, isOpinioniError, isProposteError } = useOpinioniData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-full px-4">
        <Button 
          variant="ghost" 
          className="mb-4 flex items-center" 
          onClick={() => setLocation("/gestisci")}
        > 
          <ArrowLeft className="mr-2 h-4 w-4" /> 
          Torna a Gestisci 
        </Button>
        
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-center mb-2">Gestisci Opinioni</h1>
          <p className="text-center text-muted-foreground">
            Le Opinioni ufficiali si modificano tramite codice e release. Qui puoi consultarle e gestire le proposte degli utenti.
          </p>
        </div>
        
        {/* Layout a due colonne */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonna sinistra: Opinion Proposte */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">Opinioni proposte dagli utenti</CardTitle>
            </CardHeader>
            <CardContent>
              <OpinioniProposte 
                proposte={proposte} 
                isLoading={isLoadingProposte} 
                isError={isProposteError} 
              />
            </CardContent>
          </Card>
          
          {/* Colonna destra: Opinion Ufficiali */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">Opinioni ufficiali</CardTitle>
            </CardHeader>
            <CardContent>
              <ListaOpinioni 
                opinioni={opinioni} 
                isLoading={isLoading} 
                isError={isOpinioniError} 
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
