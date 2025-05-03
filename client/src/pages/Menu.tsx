import React, { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function Menu() {
  const { user, isLoading } = useAuth();

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
      {isLoading ? (
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Menu Principale
              </CardTitle>
              <CardDescription>
                Benvenuto nell'applicazione DEMOS. Seleziona un'opzione per continuare.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
              <Button 
                className="h-24 text-lg font-medium" 
                variant="default"
                onClick={() => window.location.href = "/profilo"}
              >
                Profilo
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="outline"
                onClick={() => window.location.href = "/gestisci-utenti"}
              >
                Gestisci Utenti
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}