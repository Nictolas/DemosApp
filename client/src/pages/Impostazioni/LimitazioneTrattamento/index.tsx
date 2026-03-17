import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface DataCategory {
  id: string;
  label: string;
  description: string;
}

const dataCategories: DataCategory[] = [
  { 
    id: 'personal', 
    label: 'Dati Personali', 
    description: 'Nome, cognome, anno di nascita, indirizzo, ecc.' 
  },
  { 
    id: 'voting', 
    label: 'Dati di Voto', 
    description: 'Opinioni politiche, voti espressi, preferenze elettorali' 
  },
  { 
    id: 'technical', 
    label: 'Dati Tecnici', 
    description: 'IP, cookie, dati di navigazione, dispositivi utilizzati' 
  },
  { 
    id: 'political', 
    label: 'Opinioni Politiche', 
    description: 'Posizioni su temi politici, affiliazioni, ideologie' 
  },
  { 
    id: 'communication', 
    label: 'Dati di Comunicazione', 
    description: 'Email, notifiche, messaggi, preferenze di comunicazione' 
  }
];

export default function LimitazioneTrattamento() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [limitationCategories, setLimitationCategories] = useState<string[]>([]);

  const toggleCategory = (categoryId: string) => {
    setLimitationCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleProcessingLimitation = async () => {
    if (limitationCategories.length === 0) {
      setError('Seleziona almeno una categoria di dati da limitare');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await apiRequest.post('/user/limit-processing', {
        categories: limitationCategories
      });
      
      if (response.success) {
        setSuccess('Limitazioni di trattamento applicate con successo');
        setLimitationCategories([]);
      } else {
        setError(response.error || 'Errore nell\'applicazione delle limitazioni');
      }
    } catch (err) {
      setError('Errore nella comunicazione con il server');
      console.error('Errore limitazione trattamento:', err);
    } finally {
      setLoading(false);
    }
  };

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
            <CardDescription>Devi effettuare il login per accedere a questa pagina.</CardDescription>
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
          
          <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-600 to-red-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                Limitazione Trattamento
              </CardTitle>
              <CardDescription className="text-orange-100 text-lg">
                Art. 18 GDPR - Limita il trattamento di specifiche categorie di dati
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Informazioni Legali */}
        <Alert className="mb-6 bg-white">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Diritto di Limitazione (Art. 18 GDPR):</strong> Hai il diritto di richiedere 
            la limitazione del trattamento dei tuoi dati personali quando contesti l'esattezza 
            dei dati, il trattamento è illecito, o ti opponi al trattamento.
          </AlertDescription>
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6 bg-white">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert className="mb-6 border-green-200 bg-white">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Form Limitazione */}
        <Card className="mb-8 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Seleziona Categorie da Limitare
            </CardTitle>
            <CardDescription>
              Scegli le categorie di dati per le quali vuoi limitare il trattamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              {dataCategories.map((category) => (
                <div key={category.id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 bg-white">
                  <Checkbox
                    id={`limitation-${category.id}`}
                    checked={limitationCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor={`limitation-${category.id}`} 
                      className="text-base font-medium cursor-pointer"
                    >
                      {category.label}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {category.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center pt-4">
              <Button 
                onClick={handleProcessingLimitation}
                disabled={loading || limitationCategories.length === 0}
                size="lg"
                className="px-8"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applicazione Limitazioni...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Applica Limitazioni
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Informazioni Aggiuntive */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Cosa Significa Limitare il Trattamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                <strong>Limitazione del trattamento</strong> significa che i tuoi dati personali 
                possono essere conservati ma non possono essere utilizzati per scopi diversi 
                da quelli per cui sono stati raccolti.
              </p>
              <p>
                <strong>Quando puoi richiedere la limitazione:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Contesti l'esattezza dei dati personali</li>
                <li>Il trattamento è illecito e ti opponi alla cancellazione</li>
                <li>L'organizzazione non ha più bisogno dei dati ma tu li richiedi per azioni legali</li>
                <li>Ti sei opposto al trattamento e stai aspettando la verifica</li>
              </ul>
              <p>
                <strong>Effetti della limitazione:</strong> I tuoi dati saranno conservati 
                ma il loro utilizzo sarà limitato fino alla risoluzione della questione.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
