import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  FileText, 
  Database, 
  Clock, 
  Users, 
  Trash2,
  Download,
  Settings,
  Eye,
  Edit,
  Save,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useLocation } from 'wouter';

export default function GDPRLegalManagement() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');

  // Dati mock per la demo
  const gdprStats = {
    totalRequests: 45,
    pendingRequests: 8,
    completedRequests: 35,
    dataRetentionDays: 30
  };

  const recentRequests = [
    { id: 1, type: 'Data Access', user: 'user@example.com', status: 'Completed', date: '2 ore fa' },
    { id: 2, type: 'Data Deletion', user: 'user2@example.com', status: 'Pending', date: '1 giorno fa' },
    { id: 3, type: 'Data Portability', user: 'user3@example.com', status: 'Completed', date: '2 giorni fa' }
  ];

  const dataRetentionRules = [
    { category: 'User Profiles', retentionDays: 365, autoDelete: true },
    { category: 'Audit Logs', retentionDays: 2555, autoDelete: true },
    { category: 'Session Data', retentionDays: 30, autoDelete: true }
  ];

  const legalDocuments = [
    { name: 'Privacy Policy', lastUpdated: '2024-01-15', status: 'Published', version: '2.1' },
    { name: 'Terms of Service', lastUpdated: '2024-01-10', status: 'Published', version: '1.8' },
    { name: 'Cookie Policy', lastUpdated: '2024-01-05', status: 'Draft', version: '1.2' },
    { name: 'Data Processing Agreement', lastUpdated: '2023-12-20', status: 'Published', version: '1.0' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
                Gestione GDPR e Legale
              </h1>
              <p className="text-gray-600 text-lg">
                Gestisci i diritti GDPR degli utenti e i documenti legali
              </p>
            </div>
            <Button 
              onClick={() => setLocation('/admin')}
              variant="outline"
              className="ml-4"
            >
              ← Torna all'Admin
            </Button>
          </div>
        </div>

        {/* Statistiche Generali */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Richieste Totali</p>
                  <p className="text-3xl font-bold text-blue-700">{gdprStats.totalRequests}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">In Elaborazione</p>
                  <p className="text-3xl font-bold text-yellow-700">{gdprStats.pendingRequests}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Completate</p>
                  <p className="text-3xl font-bold text-green-700">{gdprStats.completedRequests}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Data Retention</p>
                  <p className="text-3xl font-bold text-purple-700">{gdprStats.dataRetentionDays} giorni</p>
                </div>
                <Database className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs per le diverse sezioni */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="rights">Diritti GDPR</TabsTrigger>
            <TabsTrigger value="retention">Data Retention</TabsTrigger>
            <TabsTrigger value="documents">Documenti Legali</TabsTrigger>
          </TabsList>

          {/* Panoramica */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Richieste Recenti */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Richieste Recenti
                  </CardTitle>
                  <CardDescription>
                    Ultime richieste GDPR degli utenti
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{request.type}</p>
                          <p className="text-sm text-gray-500">{request.user} • {request.date}</p>
                        </div>
                        <Badge 
                          variant={request.status === 'Completed' ? 'default' : 
                                  request.status === 'Pending' ? 'secondary' : 'destructive'}
                        >
                          {request.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-4 w-4 mr-2" />
                      Visualizza Tutte le Richieste
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Azioni Rapide */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-green-600" />
                    Azioni Rapide
                  </CardTitle>
                  <CardDescription>
                    Gestisci rapidamente i diritti GDPR
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={() => setLocation('/gdpr-rights')}
                    variant="outline" 
                    className="w-full justify-start"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Gestisci Diritti GDPR
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('retention')}
                    variant="outline" 
                    className="w-full justify-start"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Configura Data Retention
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('documents')}
                    variant="outline" 
                    className="w-full justify-start"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Modifica Documenti Legali
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Diritti GDPR */}
          <TabsContent value="rights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Gestione Diritti GDPR
                </CardTitle>
                <CardDescription>
                  Gestisci i diritti degli utenti secondo il GDPR (accesso, cancellazione, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Download className="h-6 w-6 text-blue-600" />
                      <h3 className="font-medium">Diritto di Accesso</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Gli utenti possono richiedere una copia dei loro dati personali.
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">Art. 15 GDPR</Badge>
                      <Badge className="bg-green-100 text-green-800">Attivo</Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Trash2 className="h-6 w-6 text-red-600" />
                      <h3 className="font-medium">Diritto di Cancellazione</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Gli utenti possono richiedere la cancellazione dei loro dati.
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">Art. 17 GDPR</Badge>
                      <Badge className="bg-green-100 text-green-800">Attivo</Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Settings className="h-6 w-6 text-yellow-600" />
                      <h3 className="font-medium">Limitazione Trattamento</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Gli utenti possono limitare il trattamento dei loro dati.
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">Art. 18 GDPR</Badge>
                      <Badge className="bg-green-100 text-green-800">Attivo</Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="h-6 w-6 text-purple-600" />
                      <h3 className="font-medium">Opposizione Trattamento</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Gli utenti possono opporsi al trattamento per motivi legittimi.
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">Art. 21 GDPR</Badge>
                      <Badge className="bg-green-100 text-green-800">Attivo</Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Database className="h-6 w-6 text-indigo-600" />
                      <h3 className="font-medium">Portabilità Dati</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Gli utenti possono trasferire i loro dati ad altri servizi.
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">Art. 20 GDPR</Badge>
                      <Badge className="bg-green-100 text-green-800">Attivo</Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Edit className="h-6 w-6 text-orange-600" />
                      <h3 className="font-medium">Rettifica Dati</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Gli utenti possono correggere i loro dati inesatti.
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">Art. 16 GDPR</Badge>
                      <Badge className="bg-green-100 text-green-800">Attivo</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Retention */}
          <TabsContent value="retention" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-purple-600" />
                  Data Retention
                </CardTitle>
                <CardDescription>
                  Gestisci la cancellazione automatica dei dati scaduti secondo GDPR
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Attenzione:</strong> Le modifiche alle regole di data retention influenzeranno 
                    automaticamente la cancellazione dei dati. Verifica attentamente prima di salvare.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {dataRetentionRules.map((rule, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">{rule.category}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant={rule.autoDelete ? 'default' : 'secondary'}>
                            {rule.autoDelete ? 'Auto Delete' : 'Manual'}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Giorni di Retention</label>
                          <p className="text-lg font-semibold">{rule.retentionDays} giorni</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Cancellazione Automatica</label>
                          <p className="text-lg font-semibold">{rule.autoDelete ? 'Sì' : 'No'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-2">
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Salva Modifiche
                  </Button>
                  <Button variant="outline">
                    <Database className="h-4 w-4 mr-2" />
                    Esegui Pulizia Ora
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documenti Legali */}
          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Documenti Legali
                </CardTitle>
                <CardDescription>
                  Gestisci Privacy Policy, Termini di Servizio e Cookie Policy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {legalDocuments.map((doc, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium">{doc.name}</h3>
                          <p className="text-sm text-gray-500">
                            Ultimo aggiornamento: {doc.lastUpdated} • Versione: {doc.version}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={doc.status === 'Published' ? 'default' : 'secondary'}
                          >
                            {doc.status}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-2">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Nuovo Documento
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Esporta Tutti
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
