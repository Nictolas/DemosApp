import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Vote } from "lucide-react";
import { Navbar } from "@/components/Navbar";

export default function Proponi() {
  const { user, isLoading } = useAuth();

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      {isLoading ? (
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Proponi
              </CardTitle>
              <CardDescription>
                Proponi nuove iniziative democratiche. Scegli il tipo di proposta che vuoi presentare.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
              <Link href="/iniziative-popolari">
                <Button 
                  className="h-40 text-xl font-medium flex flex-col items-center justify-center space-y-4 w-full" 
                  variant="default"
                >
                  <FileText className="h-12 w-12" />
                  <div className="text-center">
                    <div className="font-bold">Iniziative Popolari</div>
                    <div className="text-sm font-normal opacity-80 mt-1">
                      Proponi nuove leggi e iniziative
                    </div>
                  </div>
                </Button>
              </Link>
              <Link href="/referendum-abrogativi">
                <Button 
                  className="h-40 text-xl font-medium flex flex-col items-center justify-center space-y-4 w-full" 
                  variant="outline"
                >
                  <Vote className="h-12 w-12" />
                  <div className="text-center">
                    <div className="font-bold">Referendum Abrogativi</div>
                    <div className="text-sm font-normal opacity-80 mt-1">
                      Proponi l'abrogazione di leggi esistenti
                    </div>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}