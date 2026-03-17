import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Shield, 
  Cookie, 
  Scale, 
  Eye, 
  Edit, 
  Download,
  Info,
  CheckCircle
} from 'lucide-react';

const LegalDocuments: React.FC = () => {
  const legalDocuments = [
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      description: 'Informativa sulla privacy e trattamento dei dati personali secondo GDPR',
      icon: Shield,
      color: 'text-blue-600',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      route: '/privacy-policy',
      status: 'Attivo',
      lastUpdated: '2024-01-15',
      gdprCompliant: true
    },
    {
      id: 'terms-of-service',
      title: 'Termini di Servizio',
      description: 'Condizioni generali di utilizzo della piattaforma DemosApp',
      icon: Scale,
      color: 'text-green-600',
      buttonColor: 'bg-green-600 hover:bg-green-700',
      route: '/terms-of-service',
      status: 'Attivo',
      lastUpdated: '2024-01-15',
      gdprCompliant: true
    },
    {
      id: 'cookie-policy',
      title: 'Cookie Policy',
      description: 'Informativa sull\'utilizzo dei cookie e tecnologie simili',
      icon: Cookie,
      color: 'text-orange-600',
      buttonColor: 'bg-orange-600 hover:bg-orange-700',
      route: '/cookie-policy',
      status: 'Attivo',
      lastUpdated: '2024-01-15',
      gdprCompliant: true
    }
  ];

  const handleViewDocument = (route: string) => {
    window.open(route, '_blank');
  };

  const handleEditDocument = (documentId: string) => {
    // Implementare logica di modifica documenti
    console.log('Modifica documento:', documentId);
  };

  const handleDownloadDocument = (documentId: string) => {
    // Implementare download documenti
    console.log('Download documento:', documentId);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl pt-20 bg-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Gestione Documenti Legali
        </h1>
        <p className="text-gray-600">
          Gestisci Privacy Policy, Termini di Servizio e Cookie Policy per la conformità GDPR
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documenti Attivi</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {legalDocuments.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Documenti pubblicati
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conformità GDPR</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {legalDocuments.filter(doc => doc.gdprCompliant).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Documenti conformi
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ultimo Aggiornamento</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              15 Gen 2024
            </div>
            <p className="text-xs text-muted-foreground">
              Data ultimo aggiornamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Documents List */}
      <div className="space-y-6">
        {legalDocuments.map((document) => (
          <Card key={document.id} className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <document.icon className={`h-6 w-6 ${document.color}`} />
                  <div>
                    <CardTitle className="text-lg">{document.title}</CardTitle>
                    <p className="text-sm text-gray-600">{document.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={document.gdprCompliant ? "default" : "destructive"}>
                    {document.gdprCompliant ? "GDPR Compliant" : "Non Conforme"}
                  </Badge>
                  <Badge variant="outline">
                    {document.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  <strong>Ultimo aggiornamento:</strong> {document.lastUpdated}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => handleViewDocument(document.route)}
                    variant="outline"
                    size="sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizza
                  </Button>
                  <Button 
                    onClick={() => handleEditDocument(document.id)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Modifica
                  </Button>
                  <Button 
                    onClick={() => handleDownloadDocument(document.id)}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GDPR Compliance Info */}
      <Card className="mt-8 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Conformità GDPR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900">Privacy Policy</h3>
                <p className="text-sm text-green-800">
                  Informativa completa sul trattamento dei dati personali conforme all'art. 13-14 GDPR
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900">Termini di Servizio</h3>
                <p className="text-sm text-green-800">
                  Condizioni di utilizzo che rispettano i diritti degli utenti e le normative vigenti
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900">Cookie Policy</h3>
                <p className="text-sm text-green-800">
                  Informativa sui cookie conforme alla direttiva ePrivacy e al GDPR
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal Requirements */}
      <Card className="mt-6 bg-white">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                Requisiti Legali
              </h3>
              <p className="text-sm text-blue-800 mb-4">
                I documenti legali sono essenziali per la conformità GDPR e la protezione legale dell'applicazione.
              </p>
              <ul className="text-sm text-blue-800 space-y-2">
                <li>• <strong>Privacy Policy:</strong> Obbligatoria per il trattamento dei dati personali (Art. 13-14 GDPR)</li>
                <li>• <strong>Termini di Servizio:</strong> Definiscono i diritti e doveri delle parti</li>
                <li>• <strong>Cookie Policy:</strong> Richiesta per l'utilizzo di cookie e tecnologie simili</li>
                <li>• <strong>Consenso:</strong> Deve essere esplicito, informato e revocabile</li>
                <li>• <strong>Aggiornamenti:</strong> I documenti devono essere aggiornati regolarmente</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LegalDocuments;
