import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Crown, Building2, Scale, Users, FileText } from "lucide-react";
import { Navbar } from "@/components/Navbar";

export default function Vota() {
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
                Vota
              </CardTitle>
              <CardDescription>
                Partecipa alle votazioni democratiche. Seleziona la categoria per esprimere il tuo voto.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              <Link href="/capo-di-stato">
                <Button 
                  className="h-32 text-xl font-medium flex flex-col items-center justify-center space-y-2 w-full" 
                  variant="default"
                >
                  <Crown className="h-8 w-8" />
                  <span>Capo di Stato</span>
                </Button>
              </Link>
              <Link href="/governo">
                <Button 
                  className="h-32 text-xl font-medium flex flex-col items-center justify-center space-y-2 w-full" 
                  variant="outline"
                >
                  <Building2 className="h-8 w-8" />
                  <span>Governo</span>
                </Button>
              </Link>
              <Link href="/grazia">
                <Button 
                  className="h-32 text-xl font-medium flex flex-col items-center justify-center space-y-2 w-full" 
                  variant="default"
                >
                  <Scale className="h-8 w-8" />
                  <span>Grazia</span>
                </Button>
              </Link>
              <Link href="/amnistia">
                <Button 
                  className="h-32 text-xl font-medium flex flex-col items-center justify-center space-y-2 w-full" 
                  variant="outline"
                >
                  <FileText className="h-8 w-8" />
                  <span>Amnistia</span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}