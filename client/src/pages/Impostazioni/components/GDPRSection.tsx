import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Download, 
  Trash2, 
  Shield, 
  FileText, 
  CheckCircle, 
  XCircle,
  Info,
  AlertTriangle
} from 'lucide-react';
import apiRequest from '../../../lib/api-request';

interface GDPRSectionProps {
  // Props per eventuali callback
}

const GDPRSection: React.FC<GDPRSectionProps> = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
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

  const handleDataExport = async () => {
    try {
      setLoading('export');
      setError(null);
      setSuccess(null);

      const response = await apiRequest.get('/user/data-export');
      
      if (response.success) {
        // Crea e scarica il file JSON
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dati-personali-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setSuccess('I tuoi dati sono stati scaricati con successo');
      } else {
        setError(response.error || 'Errore nel download dei dati');
      }
    } catch (err) {
      setError('Errore nella comunicazione con il server');
      console.error('Errore export dati:', err);
    } finally {
      setLoading(null);
    }
  };

  const handleAccountDeletion = async () => {
    if (deleteConfirmation !== 'CONFERMO_CANCELLAZIONE_ACCOUNT') {
      setError('Devi digitare esattamente: CONFERMO_CANCELLAZIONE_ACCOUNT');
      return;
    }

    try {
      setLoading('delete');
      setError(null);
      setSuccess(null);

      const response = await apiRequest.delete('/user/account');
      
      if (response.success) {
        setSuccess('Account cancellato con successo. Verrai reindirizzato alla pagina di login.');
        setTimeout(() => {
          window.location.href = '/auth';
        }, 3000);
      } else {
        setError(response.error || 'Errore nella cancellazione dell\'account');
      }
    } catch (err) {
      setError('Errore nella comunicazione con il server');
      console.error('Errore cancellazione account:', err);
    } finally {
      setLoading(null);
    }
  };

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
          Gestisci i tuoi diritti sulla protezione dei dati personali secondo il GDPR
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

        {/* Diritto di Accesso */}
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-sm">Diritto di Accesso (Art. 15)</h3>
            <p className="text-sm text-gray-600">
              Scarica una copia completa di tutti i tuoi dati personali in formato JSON
            </p>
          </div>
          <Button 
            onClick={handleDataExport}
            disabled={loading === 'export'}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            {loading === 'export' ? 'Scaricamento...' : 'Scarica i Miei Dati'}
          </Button>
        </div>

        {/* Diritto di Cancellazione */}
        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="font-semibold text-sm text-red-600">Diritto di Cancellazione (Art. 17)</h3>
            <p className="text-sm text-gray-600">
              Cancella definitivamente il tuo account e tutti i dati associati
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="delete-confirmation" className="text-sm">
                Per confermare, digita: <code className="bg-gray-100 px-1 rounded">CONFERMO_CANCELLAZIONE_ACCOUNT</code>
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Digita: CONFERMO_CANCELLAZIONE_ACCOUNT"
                className="mt-1"
              />
            </div>
            <Button 
              onClick={handleAccountDeletion}
              disabled={loading === 'delete' || deleteConfirmation !== 'CONFERMO_CANCELLAZIONE_ACCOUNT'}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {loading === 'delete' ? 'Cancellazione...' : 'Cancella Account'}
            </Button>
          </div>
        </div>

        {/* Limitazione Trattamento */}
        <div className="space-y-3 border-t pt-4">
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
                <p><strong>Diritto di Accesso (Art. 15 GDPR):</strong> Hai il diritto di ottenere una copia dei tuoi dati personali.</p>
                <p><strong>Diritto di Cancellazione (Art. 17 GDPR):</strong> Hai il diritto di richiedere la cancellazione dei tuoi dati.</p>
                <p><strong>Diritto di Limitazione (Art. 18 GDPR):</strong> Hai il diritto di limitare il trattamento dei tuoi dati.</p>
                <p><strong>Diritto di Opposizione (Art. 21 GDPR):</strong> Hai il diritto di opporti al trattamento per motivi legittimi.</p>
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
