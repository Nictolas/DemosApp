import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Vote, MessageSquare, Globe2 } from "lucide-react";

export default function Proponi() {
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
              <FileText className="h-6 w-6 text-purple-600" />
              Proponi
            </CardTitle>
            <CardDescription>
              Proponi nuove iniziative democratiche. Scegli il tipo di proposta che vuoi presentare.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pulsanti Proposta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Iniziative Popolari */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-600 group-hover:text-indigo-700">
                <FileText className="h-5 w-5" />
                Iniziative Popolari
              </CardTitle>
              <CardDescription>
                Proponi nuove leggi e iniziative
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={() => window.location.href = "/iniziative-popolari"}
              >
                <FileText className="mr-2 h-4 w-4" />
                Proponi Iniziativa Popolare
              </Button>
            </CardContent>
          </Card>

          {/* Referendum Abrogativi */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600 group-hover:text-orange-700">
                <Vote className="h-5 w-5" />
                Referendum Abrogativi
              </CardTitle>
              <CardDescription>
                Proponi l'abrogazione di leggi esistenti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={() => window.location.href = "/referendum-abrogativi"}
              >
                <Vote className="mr-2 h-4 w-4" />
                Proponi Referendum Abrogativo
              </Button>
            </CardContent>
          </Card>

          {/* Opinioni */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-fuchsia-600 group-hover:text-fuchsia-700">
                <MessageSquare className="h-5 w-5" />
                Opinioni
              </CardTitle>
              <CardDescription>
                Esprimi la tua opinione su temi importanti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
                onClick={() => window.location.href = "/opinioni"}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Esprimi Opinione
              </Button>
            </CardContent>
          </Card>

          {/* ICE */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-600 group-hover:text-cyan-700">
                <Globe2 className="h-5 w-5" />
                ICE
              </CardTitle>
              <CardDescription>
                Proposta di Iniziativa dei Cittadini Europei (ICE)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-cyan-600 hover:bg-cyan-700"
                onClick={() => window.location.href = "/ice"}
              >
                <Globe2 className="mr-2 h-4 w-4" />
                Proponi ICE
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}