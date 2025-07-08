import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Settings, Users, Vote, Heart, BookOpen, ClipboardList, Trophy, Globe2 } from "lucide-react";

export default function Gestisci() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => window.location.href = "/menu"}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna al Menu
          </Button>
        </div>

        {/* Titolo */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <Settings className="h-6 w-6" />
              Gestisci
            </CardTitle>
            <CardDescription>
              Amministra utenti ed elezioni della piattaforma
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pulsanti Gestione */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gestisci Utenti */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600 group-hover:text-purple-700">
                <Users className="h-5 w-5" />
                Gestisci Utenti
              </CardTitle>
              <CardDescription>
                Amministra gli utenti registrati e le loro informazioni
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => window.location.href = "/gestisci-utenti"}
              >
                <Users className="mr-2 h-4 w-4" />
                Gestisci Utenti
              </Button>
            </CardContent>
          </Card>

          {/* Gestisci Elezioni */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-pink-600 group-hover:text-pink-700">
                <Vote className="h-5 w-5" />
                Gestisci Elezioni
              </CardTitle>
              <CardDescription>
                Crea, modifica ed elimina elezioni e candidature
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-pink-600 hover:bg-pink-700"
                onClick={() => window.location.href = "/gestisci-elezioni"}
              >
                <Vote className="mr-2 h-4 w-4" />
                Gestisci Elezioni
              </Button>
            </CardContent>
          </Card>

          {/* Gestisci Grazia */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 group-hover:text-green-700">
                <Heart className="h-5 w-5" />
                Gestisci Grazia
              </CardTitle>
              <CardDescription>
                Gestisci le richieste di grazia e i voti associati
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => window.location.href = "/gestisci-grazia"}
              >
                <Heart className="mr-2 h-4 w-4" />
                Gestisci Grazia
              </Button>
            </CardContent>
          </Card>

          {/* Gestisci Opinioni */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600 group-hover:text-blue-700">
                <BookOpen className="h-5 w-5" />
                Gestisci Opinioni
              </CardTitle>
              <CardDescription>
                Aggiungi o elimina le opinioni disponibili per gli utenti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = "/gestisci-opinioni"}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Gestisci Opinioni
              </Button>
            </CardContent>
          </Card>

          {/* Gestisci Iniziative Popolari */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-600 group-hover:text-indigo-700">
                <ClipboardList className="h-5 w-5" />
                Gestisci Iniziative Popolari
              </CardTitle>
              <CardDescription>
                Gestisci le richieste di iniziative popolari proposte dagli utenti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={() => window.location.href = "/gestisci-iniziative-popolari"}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Gestisci Iniziative Popolari
              </Button>
            </CardContent>
          </Card>

          {/* Gestisci Referendum Abrogativi */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600 group-hover:text-orange-700">
                <Vote className="h-5 w-5" />
                Gestisci Referendum Abrogativi
              </CardTitle>
              <CardDescription>
                Gestisci le richieste di referendum abrogativi proposte dagli utenti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={() => window.location.href = "/gestisci-referendum-abrogativi"}
              >
                <Vote className="mr-2 h-4 w-4" />
                Gestisci Referendum Abrogativi
              </Button>
            </CardContent>
          </Card>

          {/* Analisi Consumi */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-600 group-hover:text-cyan-700">
                <ClipboardList className="h-5 w-5" />
                Analisi Consumi
              </CardTitle>
              <CardDescription>
                Visualizza l'analisi dei consumi e delle stime di traffico dell'app
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-cyan-600 hover:bg-cyan-700"
                onClick={() => window.location.href = "/analisi-consumi"}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Analisi Consumi
              </Button>
            </CardContent>
          </Card>

          {/* Gestisci Governo */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600 group-hover:text-yellow-700">
                <Trophy className="h-5 w-5" />
                Gestisci Governo
              </CardTitle>
              <CardDescription>
                Gestisci i dati e le funzionalità relative al Governo ideale
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-yellow-600 hover:bg-yellow-700"
                onClick={() => window.location.href = "/gestisci-governo"}
              >
                <Trophy className="mr-2 h-4 w-4" />
                Gestisci Governo
              </Button>
            </CardContent>
          </Card>

          {/* Gestisci ICE */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-600 group-hover:text-cyan-700">
                <Globe2 className="h-5 w-5" />
                Gestisci ICE
              </CardTitle>
              <CardDescription>
                Gestisci le richieste di ICE proposte dagli utenti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-cyan-600 hover:bg-cyan-700"
                onClick={() => window.location.href = "/gestisci-ice"}
              >
                <Globe2 className="mr-2 h-4 w-4" />
                Gestisci ICE
              </Button>
            </CardContent>
          </Card>
        </div>

        {user?.ruolo === 'Admin' && (
          <Link href="/limiti">
            <Button className="w-full mb-4" variant="outline">
              Limiti Firebase
            </Button>
          </Link>
        )}

        <Button
          asChild
          variant="outline"
          className="w-full flex items-center justify-start gap-2 mb-4"
        >
          <a href="/gestisci-governo">
            <Trophy className="h-5 w-5 text-yellow-600" />
            Gestisci Governo
          </a>
        </Button>
      </div>
    </div>
  );
}