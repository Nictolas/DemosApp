import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useOpinioniData } from "./hooks";
import { OpinioniProposte, FormAggiungiOpinione, ListaOpinioni } from "./components";

export default function GestisciOpinioni() {
  const [, setLocation] = useLocation();
  const { opinioni, proposte, isLoading, isLoadingProposte, isOpinioniError, isProposteError } = useOpinioniData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-3xl">
        <Button 
          variant="ghost" 
          className="mb-4 flex items-center" 
          onClick={() => setLocation("/gestisci")}
        > 
          <ArrowLeft className="mr-2 h-4 w-4" /> 
          Torna a Gestisci 
        </Button>
        
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Gestisci Opinioni</CardTitle>
            <CardDescription>
              Aggiungi, modifica o elimina le opinioni ufficiali e gestisci le proposte degli utenti.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {/* Sezione Opinion Proposte */}
            <OpinioniProposte 
              proposte={proposte} 
              isLoading={isLoadingProposte} 
              isError={isProposteError} 
            />
            
            {/* Sezione Opinion Ufficiali */}
            <FormAggiungiOpinione />
            
            <ListaOpinioni 
              opinioni={opinioni} 
              isLoading={isLoading} 
              isError={isOpinioniError} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
