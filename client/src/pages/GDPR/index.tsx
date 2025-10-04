import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Download, Trash2, Settings, FileText, Database } from "lucide-react";
import { useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";

export default function GDPR() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <PageContainer className="bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer className="bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
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
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-b from-blue-50 to-white">
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
        <Alert className="mb-6 bg-white">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Regolamento Generale sulla Protezione dei Dati (GDPR):</strong> Hai il diritto 
            di controllare come vengono utilizzati i tuoi dati personali. Utilizza le funzionalità 
            qui sotto per esercitare i tuoi diritti.
          </AlertDescription>
        </Alert>

        {/* Sezione Gestione Dati */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Gestione Dati
            </CardTitle>
            <CardDescription>
              Controlla e gestisci i tuoi dati personali
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => setLocation('/impostazioni/scarica-dati')}
              variant="outline"
              className="w-full justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Scarica i Tuoi Dati
            </Button>
            
            <Button 
              onClick={() => setLocation('/impostazioni/gestione-privacy')}
              variant="outline"
              className="w-full justify-start"
            >
              <Settings className="h-4 w-4 mr-2" />
              Gestione Privacy
            </Button>
          </CardContent>
        </Card>

        {/* Sezione Diritti Specifici GDPR */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Diritti Specifici GDPR
            </CardTitle>
            <CardDescription>
              Esercita i tuoi diritti specifici secondo il GDPR
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => setLocation('/impostazioni/limitazione-trattamento')}
              variant="outline"
              className="w-full justify-start"
            >
              <Shield className="h-4 w-4 mr-2" />
              Limitazione Trattamento (Art. 18)
            </Button>
            
            <Button 
              onClick={() => setLocation('/impostazioni/opposizione-trattamento')}
              variant="outline"
              className="w-full justify-start"
            >
              <FileText className="h-4 w-4 mr-2" />
              Opposizione Trattamento (Art. 21)
            </Button>
          </CardContent>
        </Card>

        {/* Sezione Account */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Account
            </CardTitle>
            <CardDescription>
              Gestisci il tuo account e i dati associati
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation('/impostazioni/cancella-account')}
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cancella Account
            </Button>
          </CardContent>
        </Card>

        {/* Sezione Documenti */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documenti Legali
            </CardTitle>
            <CardDescription>
              Consulta i documenti relativi alla protezione dei dati
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => setLocation('/privacy-policy')}
              variant="outline"
              className="w-full justify-start"
            >
              <FileText className="h-4 w-4 mr-2" />
              Privacy Policy
            </Button>
            
            <Button 
              onClick={() => setLocation('/data-retention')}
              variant="outline"
              className="w-full justify-start"
            >
              <Database className="h-4 w-4 mr-2" />
              Data Retention
            </Button>
          </CardContent>
        </Card>

      </div>
    </PageContainer>
  );
}
