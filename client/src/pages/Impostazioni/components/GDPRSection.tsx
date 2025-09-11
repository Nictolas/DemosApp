import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  FileText, 
  Info
} from 'lucide-react';
import { useLocation } from 'wouter';

interface GDPRSectionProps {
  // Props per eventuali callback
}

const GDPRSection: React.FC<GDPRSectionProps> = () => {
  const [, setLocation] = useLocation();



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
      <CardContent className="space-y-4">
        {/* Pulsanti Navigazione GDPR */}
        <div className="grid gap-3">
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
        </div>

        {/* Informazioni Legali */}
        <div className="border-t pt-4">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-2 text-sm">
              <h4 className="font-semibold text-blue-900">Informazioni sui Diritti GDPR</h4>
              <div className="space-y-1 text-blue-800">
                <p><strong>Diritto di Accesso (Art. 15 GDPR):</strong> Per scaricare i tuoi dati, vai alla sezione <a href="/impostazioni/scarica-dati" className="underline">Scarica Dati</a>.</p>
                <p><strong>Diritto di Cancellazione (Art. 17 GDPR):</strong> Per cancellare il tuo account, vai alla sezione <a href="/impostazioni/cancella-account" className="underline">Cancella Account</a>.</p>
                <p><strong>Diritto di Limitazione (Art. 18 GDPR):</strong> Per limitare il trattamento dei tuoi dati, usa il pulsante sopra.</p>
                <p><strong>Diritto di Opposizione (Art. 21 GDPR):</strong> Per opporti al trattamento, usa il pulsante sopra.</p>
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
