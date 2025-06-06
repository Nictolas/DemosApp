import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Crown, Users, FileText, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CapodiStato() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-6xl">
        <Button 
          variant="ghost" 
          className="mb-4 flex items-center"
          onClick={() => window.location.href = "/menu"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
        </Button>
        
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full">
                <Crown className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-800 bg-clip-text text-transparent">
              Capo di Stato
            </CardTitle>
            <CardDescription className="text-lg">
              Gestione delle funzioni e responsabilità del Capo di Stato
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Funzioni Rappresentative */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Funzioni Rappresentative</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Rappresentanza dello Stato nelle relazioni internazionali e nelle cerimonie ufficiali.
              </p>
              <div className="space-y-2">
                <Badge variant="outline">Diplomatiche</Badge>
                <Badge variant="outline">Protocollo</Badge>
                <Badge variant="outline">Cerimonie</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Poteri Costituzionali */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-xl">Poteri Costituzionali</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Esercizio dei poteri previsti dalla Costituzione e dalle leggi dello Stato.
              </p>
              <div className="space-y-2">
                <Badge variant="outline">Promulgazione</Badge>
                <Badge variant="outline">Nomine</Badge>
                <Badge variant="outline">Messaggi</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Agende e Impegni */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl">Agende e Impegni</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Gestione del calendario ufficiale e degli impegni istituzionali.
              </p>
              <div className="space-y-2">
                <Badge variant="outline">Udienze</Badge>
                <Badge variant="outline">Visite</Badge>
                <Badge variant="outline">Eventi</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sezione Documenti e Atti */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-2xl">Documenti e Atti Recenti</CardTitle>
            <CardDescription>
              Ultimi documenti e atti ufficiali del Capo di Stato
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-semibold">Messaggio alle Camere</h4>
                  <p className="text-sm text-muted-foreground">Comunicazioni istituzionali</p>
                </div>
                <Badge>Recente</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-semibold">Decreto di Nomina</h4>
                  <p className="text-sm text-muted-foreground">Nomine ufficiali</p>
                </div>
                <Badge variant="secondary">In corso</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-semibold">Promulgazione Legge</h4>
                  <p className="text-sm text-muted-foreground">Atti normativi</p>
                </div>
                <Badge variant="outline">Archiviato</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}