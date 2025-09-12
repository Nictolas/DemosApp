import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, FileText } from "lucide-react";
import { useLocation } from "wouter";

export default function GDPR() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per accedere ai diritti GDPR.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation('/auth')}>
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/impostazioni')}
            className="mb-4"
          >
            ← Torna alle Impostazioni
          </Button>
          
          <Card className="border-0 shadow-lg bg-gradient-to-r from-green-600 to-blue-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                Diritti GDPR
              </CardTitle>
              <CardDescription className="text-green-100 text-lg">
                Gestisci i tuoi diritti sulla protezione dei dati personali
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Informazioni Generali */}
        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Regolamento Generale sulla Protezione dei Dati (GDPR):</strong> Hai il diritto 
            di controllare come vengono utilizzati i tuoi dati personali. Visualizza qui sotto 
            lo storico delle tue richieste relative ai diritti GDPR.
          </AlertDescription>
        </Alert>

        {/* Sezione Storico Richieste */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Storico Richieste
            </CardTitle>
            <CardDescription>
              Visualizza tutte le tue richieste relative ai diritti GDPR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation('/gdpr/storico-richieste')}
              variant="outline"
              className="w-full justify-start"
            >
              <FileText className="h-4 w-4 mr-2" />
              Visualizza Storico Richieste
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
