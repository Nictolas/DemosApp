import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, Download, Trash2, Settings, FileText, Info } from "lucide-react";
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
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Regolamento Generale sulla Protezione dei Dati (GDPR):</strong> Hai il diritto 
            di controllare come vengono utilizzati i tuoi dati personali. Utilizza le funzionalità 
            qui sotto per esercitare i tuoi diritti.
          </AlertDescription>
        </Alert>

        {/* Sezione Gestione Dati */}
        <Card className="mb-6">
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
        <Card className="mb-6">
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
        <Card className="mb-6">
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

        {/* Informazioni Legali */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Informazioni sui Diritti GDPR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-3">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Diritto di Accesso (Art. 15 GDPR)</h4>
                <p>Hai il diritto di ottenere una copia dei tuoi dati personali e informazioni su come vengono utilizzati.</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-2">Diritto di Cancellazione (Art. 17 GDPR)</h4>
                <p>Hai il diritto di richiedere la cancellazione dei tuoi dati personali in determinate circostanze.</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-2">Diritto di Limitazione (Art. 18 GDPR)</h4>
                <p>Hai il diritto di limitare il trattamento dei tuoi dati personali in determinate circostanze.</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-2">Diritto di Opposizione (Art. 21 GDPR)</h4>
                <p>Hai il diritto di opporti al trattamento dei tuoi dati personali per motivi legittimi.</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-2">Diritto di Portabilità (Art. 20 GDPR)</h4>
                <p>Hai il diritto di ricevere i tuoi dati in un formato strutturato e leggibile.</p>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-blue-700">
                  Per ulteriori informazioni, consulta la nostra <a href="/privacy-policy" className="underline">Privacy Policy</a>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
