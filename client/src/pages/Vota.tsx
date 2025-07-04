import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Crown, Building2, Scale, FileText } from "lucide-react";

export default function Vota() {
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
              <Crown className="h-6 w-6 text-purple-600" />
              Vota
            </CardTitle>
            <CardDescription>
              Partecipa alle votazioni democratiche. Seleziona la categoria per esprimere il tuo voto.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pulsanti Voto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Capo di Stato */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600 group-hover:text-purple-700">
                <Crown className="h-5 w-5" />
                Capo di Stato
              </CardTitle>
              <CardDescription>
                Vota il Capo di Stato della Repubblica
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => window.location.href = "/capo-di-stato"}
              >
                <Crown className="mr-2 h-4 w-4" />
                Vota Capo di Stato
              </Button>
            </CardContent>
          </Card>

          {/* Governo */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-pink-600 group-hover:text-pink-700">
                <Building2 className="h-5 w-5" />
                Governo
              </CardTitle>
              <CardDescription>
                Vota i ministri del Governo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-pink-600 hover:bg-pink-700"
                onClick={() => window.location.href = "/governo"}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Vota Governo
              </Button>
            </CardContent>
          </Card>

          {/* Grazia */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 group-hover:text-green-700">
                <Scale className="h-5 w-5" />
                Grazia
              </CardTitle>
              <CardDescription>
                Vota per la grazia dei cittadini carcerati
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => window.location.href = "/grazia"}
              >
                <Scale className="mr-2 h-4 w-4" />
                Vota Grazia
              </Button>
            </CardContent>
          </Card>

          {/* Amnistia */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-600 group-hover:text-indigo-700">
                <FileText className="h-5 w-5" />
                Amnistia
              </CardTitle>
              <CardDescription>
                Vota per l'amnistia delle leggi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={() => window.location.href = "/amnistia"}
              >
                <FileText className="mr-2 h-4 w-4" />
                Vota Amnistia
              </Button>
            </CardContent>
          </Card>

          {/* Iniziativa Popolare */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600 group-hover:text-blue-700">
                <FileText className="h-5 w-5" />
                Iniziativa Popolare
              </CardTitle>
              <CardDescription>
                Vota tra le iniziative popolari che hanno raggiunto il quorum
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = "/vota-iniziativa-popolare"}
              >
                <FileText className="mr-2 h-4 w-4" />
                Vota Iniziativa Popolare
              </Button>
            </CardContent>
          </Card>

          {/* Referendum Abrogativo */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600 group-hover:text-orange-700">
                <FileText className="h-5 w-5" />
                Referendum Abrogativo
              </CardTitle>
              <CardDescription>
                Vota tra i referendum abrogativi che hanno raggiunto il quorum
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={() => window.location.href = "/vota-referendum-abrogativo"}
              >
                <FileText className="mr-2 h-4 w-4" />
                Vota Referendum Abrogativo
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}