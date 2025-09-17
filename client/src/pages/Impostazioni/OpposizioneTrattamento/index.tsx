import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    description: 'Nome, cognome, data di nascita, indirizzo, ecc.' 
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
  },
  { 
    id: 'marketing', 
    label: 'Dati di Marketing', 
    description: 'Preferenze commerciali, interessi, comportamenti di acquisto' 
  }
];

const objectionReasons = [
  'Trattamento per finalità di marketing diretto',
  'Profilazione per decisioni automatizzate',
  'Trattamento per finalità di ricerca scientifica',
  'Trattamento per finalità storiche o statistiche',
  'Trattamento per finalità di sicurezza pubblica',
  'Trattamento per finalità di interesse legittimo',
  'Altro motivo specifico'
];

export default function OpposizioneTrattamento() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [objectionCategories, setObjectionCategories] = useState<string[]>([]);
  const [objectionReason, setObjectionReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const toggleCategory = (categoryId: string) => {
    setObjectionCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleObjection = async () => {
    if (objectionCategories.length === 0) {
      setError('Seleziona almeno una categoria di dati per l\'obiezione');
      return;
    }

    if (!objectionReason.trim()) {
      setError('Seleziona il motivo dell\'obiezione');
      return;
    }

    if (objectionReason === 'Altro motivo specifico' && !customReason.trim()) {
      setError('Inserisci il motivo specifico dell\'obiezione');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const finalReason = objectionReason === 'Altro motivo specifico' ? customReason : objectionReason;

      const response = await apiRequest.post('/user/object', {
        categories: objectionCategories,
        reason: finalReason
      });
      
      if (response.success) {
        setSuccess('Opposizione registrata con successo');
        setObjectionCategories([]);
        setObjectionReason('');
        setCustomReason('');
      } else {
        setError(response.error || 'Errore nella registrazione dell\'opposizione');
      }
    } catch (err) {
      setError('Errore nella comunicazione con il server');
      console.error('Errore opposizione:', err);
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
          
          <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                Opposizione Trattamento
              </CardTitle>
              <CardDescription className="text-purple-100 text-lg">
                Art. 21 GDPR - Opponi al trattamento per motivi legittimi
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Informazioni Legali */}
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Diritto di Opposizione (Art. 21 GDPR):</strong> Hai il diritto di opporti 
            al trattamento dei tuoi dati personali per motivi legittimi, incluso il trattamento 
            per finalità di marketing diretto.
          </AlertDescription>
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Form Opposizione */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Registra la Tua Opposizione
            </CardTitle>
            <CardDescription>
              Seleziona le categorie di dati e il motivo per cui ti opponi al trattamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Motivo Opposizione */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Motivo dell'Opposizione</Label>
              <div className="grid gap-2">
                {objectionReasons.map((reason) => (
                  <div key={reason} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`reason-${reason}`}
                      name="objectionReason"
                      value={reason}
                      checked={objectionReason === reason}
                      onChange={(e) => setObjectionReason(e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`reason-${reason}`} className="text-sm cursor-pointer">
                      {reason}
                    </Label>
                  </div>
                ))}
              </div>
              
              {objectionReason === 'Altro motivo specifico' && (
                <div className="mt-3">
                  <Label htmlFor="custom-reason" className="text-sm font-medium">
                    Specifica il motivo
                  </Label>
                  <Textarea
                    id="custom-reason"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Descrivi il motivo specifico della tua opposizione..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Categorie Dati */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Categorie di Dati</Label>
              <div className="grid gap-4">
                {dataCategories.map((category) => (
                  <div key={category.id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      id={`objection-${category.id}`}
                      checked={objectionCategories.includes(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor={`objection-${category.id}`} 
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
            </div>

            <div className="flex justify-center pt-4">
              <Button 
                onClick={handleObjection}
                disabled={loading || objectionCategories.length === 0 || !objectionReason.trim() || (objectionReason === 'Altro motivo specifico' && !customReason.trim())}
                size="lg"
                className="px-8"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registrazione Opposizione...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Registra Opposizione
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Informazioni Aggiuntive */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Cosa Significa Opporsi al Trattamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                <strong>Opposizione al trattamento</strong> significa che puoi richiedere 
                la cessazione del trattamento dei tuoi dati personali per motivi legittimi.
              </p>
              <p>
                <strong>Quando puoi opporti:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Il trattamento è basato su interesse legittimo o finalità di interesse pubblico</li>
                <li>Il trattamento è per finalità di marketing diretto</li>
                <li>Il trattamento è per finalità di ricerca scientifica o storica</li>
                <li>Il trattamento è per finalità statistiche</li>
                <li>Hai motivi legittimi per opporti al trattamento</li>
              </ul>
              <p>
                <strong>Effetti dell'opposizione:</strong> L'organizzazione deve cessare 
                il trattamento dei tuoi dati, salvo che dimostri motivi legittimi prevalenti 
                o per l'esercizio o la difesa di un diritto in sede giudiziaria.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
