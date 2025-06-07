import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BarChart3, Users, MessageSquare } from "lucide-react";

export default function Statistiche() {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
              <BarChart3 className="h-6 w-6" />
              Statistiche
            </CardTitle>
            <CardDescription>
              Visualizza statistiche dettagliate su utenti e opinioni
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pulsanti Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Statistiche Utenti */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600 group-hover:text-blue-700">
                <Users className="h-5 w-5" />
                Statistiche Utenti
              </CardTitle>
              <CardDescription>
                Visualizza dati demografici e statistiche degli utenti registrati
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = "/statistiche-utenti"}
              >
                <Users className="mr-2 h-4 w-4" />
                Visualizza Statistiche Utenti
              </Button>
            </CardContent>
          </Card>

          {/* Statistiche Opinioni */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 group-hover:text-green-700">
                <MessageSquare className="h-5 w-5" />
                Statistiche Opinioni
              </CardTitle>
              <CardDescription>
                Analizza le opinioni politiche degli utenti e le tendenze
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => window.location.href = "/statistiche-opinioni"}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Visualizza Statistiche Opinioni
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}