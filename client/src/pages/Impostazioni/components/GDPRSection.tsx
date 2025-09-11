import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  FileText, 
  CheckCircle, 
  XCircle,
  Info
} from 'lucide-react';
import apiRequest from '../../../lib/api-request';

interface GDPRSectionProps {
  // Props per eventuali callback
}

const GDPRSection: React.FC<GDPRSectionProps> = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [limitationCategories, setLimitationCategories] = useState<string[]>([]);
  const [objectionCategories, setObjectionCategories] = useState<string[]>([]);
  const [objectionReason, setObjectionReason] = useState('');

  const dataCategories = [
    { id: 'personal', label: 'Dati Personali' },
    { id: 'voting', label: 'Dati di Voto' },
    { id: 'technical', label: 'Dati Tecnici' },
    { id: 'political', label: 'Opinioni Politiche' },
    { id: 'communication', label: 'Dati di Comunicazione' },
    { id: 'marketing', label: 'Dati di Marketing' }
  ];


  const handleProcessingLimitation = async () => {
    if (limitationCategories.length === 0) {
      setError('Seleziona almeno una categoria di dati da limitare');
      return;
    }

    try {
      setLoading('limitation');
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
      setLoading(null);
    }
  };

  const handleObjection = async () => {
    if (objectionCategories.length === 0) {
      setError('Seleziona almeno una categoria di dati per l\'obiezione');
      return;
    }

    if (!objectionReason.trim()) {
      setError('Inserisci il motivo dell\'obiezione');
      return;
    }

    try {
      setLoading('objection');
      setError(null);
      setSuccess(null);

      const response = await apiRequest.post('/user/object', {
        categories: objectionCategories,
        reason: objectionReason
      });
      
      if (response.success) {
        setSuccess('Obiezione registrata con successo');
        setObjectionCategories([]);
        setObjectionReason('');
      } else {
        setError(response.error || 'Errore nella registrazione dell\'obiezione');
      }
    } catch (err) {
      setError('Errore nella comunicazione con il server');
      console.error('Errore obiezione:', err);
    } finally {
      setLoading(null);
    }
  };

  const toggleCategory = (categoryId: string, categories: string[], setCategories: React.Dispatch<React.SetStateAction<string[]>>) => {
    setCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="h-5 w-5 mr-2" />
          Diritti GDPR
        </CardTitle>
        <CardDescription>
          Gestisci limitazioni e opposizioni al trattamento dei dati secondo il GDPR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}


        {/* Limitazione Trattamento */}
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-sm">Limitazione Trattamento (Art. 18)</h3>
            <p className="text-sm text-gray-600">
              Limita il trattamento di specifiche categorie di dati
            </p>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {dataCategories.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`limitation-${category.id}`}
                    checked={limitationCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id, limitationCategories, setLimitationCategories)}
                  />
                  <Label htmlFor={`limitation-${category.id}`} className="text-sm">
                    {category.label}
                  </Label>
                </div>
              ))}
            </div>
            <Button 
              onClick={handleProcessingLimitation}
              disabled={loading === 'limitation' || limitationCategories.length === 0}
              className="w-full sm:w-auto"
            >
              <Shield className="h-4 w-4 mr-2" />
              {loading === 'limitation' ? 'Applicazione...' : 'Applica Limitazioni'}
            </Button>
          </div>
        </div>

        {/* Opposizione Trattamento */}
        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="font-semibold text-sm">Opposizione Trattamento (Art. 21)</h3>
            <p className="text-sm text-gray-600">
              Opponi al trattamento per motivi legittimi
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="objection-reason" className="text-sm">
                Motivo dell'opposizione
              </Label>
              <Textarea
                id="objection-reason"
                value={objectionReason}
                onChange={(e) => setObjectionReason(e.target.value)}
                placeholder="Motivo dell'opposizione..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {dataCategories.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`objection-${category.id}`}
                    checked={objectionCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id, objectionCategories, setObjectionCategories)}
                  />
                  <Label htmlFor={`objection-${category.id}`} className="text-sm">
                    {category.label}
                  </Label>
                </div>
              ))}
            </div>
            <Button 
              onClick={handleObjection}
              disabled={loading === 'objection' || objectionCategories.length === 0 || !objectionReason.trim()}
              className="w-full sm:w-auto"
            >
              <FileText className="h-4 w-4 mr-2" />
              {loading === 'objection' ? 'Registrazione...' : 'Registra Opposizione'}
            </Button>
          </div>
        </div>

        {/* Informazioni Legali */}
        <div className="border-t pt-4">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-2 text-sm">
              <h4 className="font-semibold text-blue-900">Informazioni sui Diritti GDPR</h4>
              <div className="space-y-1 text-blue-800">
                <p><strong>Diritto di Limitazione (Art. 18 GDPR):</strong> Hai il diritto di limitare il trattamento dei tuoi dati.</p>
                <p><strong>Diritto di Opposizione (Art. 21 GDPR):</strong> Hai il diritto di opporti al trattamento per motivi legittimi.</p>
                <p><strong>Diritto di Accesso (Art. 15 GDPR):</strong> Per scaricare i tuoi dati, vai alla sezione <a href="/impostazioni/scarica-dati" className="underline">Scarica Dati</a>.</p>
                <p><strong>Diritto di Cancellazione (Art. 17 GDPR):</strong> Per cancellare il tuo account, vai alla sezione <a href="/impostazioni/cancella-account" className="underline">Cancella Account</a>.</p>
              </div>
              <p className="text-blue-700">
                Per ulteriori informazioni, consulta la nostra <a href="/privacy-policy" className="underline">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GDPRSection;
