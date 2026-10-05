// File: client/src/pages/Axiom.tsx
// Pagina per visualizzare i dati di Axiom in formato tabellare

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ArrowLeft, Database, ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocation } from 'wouter';
import apiRequest from '@/lib/api-request';
import { useToast } from '@/hooks/use-toast';

interface AxiomEvent {
  _time: string;
  [key: string]: any;
}

interface AxiomDataset {
  name: string;
  label: string;
  description: string;
}

interface AxiomDataResponse {
  rows: AxiomEvent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function Axiom() {
  const [, setLocation] = useLocation();
  const [datasets, setDatasets] = useState<AxiomDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [data, setData] = useState<AxiomDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(100);
  const [duplicatesDialogOpen, setDuplicatesDialogOpen] = useState(false);
  const [duplicatesCount, setDuplicatesCount] = useState<number | null>(null);
  const [analyzingDuplicates, setAnalyzingDuplicates] = useState(false);
  const [removingDuplicates, setRemovingDuplicates] = useState(false);
  const { toast } = useToast();

  // Carica lista dataset
  useEffect(() => {
    loadDatasets();
  }, []);

  // Carica dati quando cambia dataset o pagina
  useEffect(() => {
    if (selectedDataset) {
      loadData();
    }
  }, [selectedDataset, currentPage]);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest.get('/admin/axiom-data/datasets');
      if (response.success) {
        setDatasets(response.data);
        if (response.data.length > 0) {
          setSelectedDataset(response.data[0].name);
        }
      } else {
        setError('Errore nel caricamento dei dataset');
      }
    } catch (err: any) {
      console.error('Errore caricamento dataset:', err);
      setError(err.message || 'Errore nel caricamento dei dataset');
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i dataset Axiom',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!selectedDataset) return;
    
    try {
      setLoadingData(true);
      setError(null);
      
      const offset = currentPage * pageSize;
      const response = await apiRequest.get(
        `/admin/axiom-data?dataset=${selectedDataset}&limit=${pageSize}&offset=${offset}`
      );
      
      if (response.success) {
        setData(response.data);
      } else {
        setError(response.error || 'Errore nel caricamento dei dati');
        toast({
          title: 'Errore',
          description: response.message || 'Impossibile caricare i dati Axiom',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      console.error('Errore caricamento dati:', err);
      setError(err.message || 'Errore nel caricamento dei dati');
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i dati Axiom',
        variant: 'destructive'
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleDatasetChange = (datasetName: string) => {
    setSelectedDataset(datasetName);
    setCurrentPage(0); // Reset alla prima pagina
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  const getFieldValue = (event: AxiomEvent, field: string): string => {
    const value = event[field];
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getFieldColor = (field: string, value: string): string => {
    if (!value || value === '-') return 'text-gray-500';
    
    const lowerValue = value.toLowerCase();
    
    // Colori per campo level
    if (field === 'level') {
      if (lowerValue.includes('error') || lowerValue === 'e' || lowerValue.includes('fatal')) {
        return 'text-red-600 font-semibold';
      }
      if (lowerValue.includes('warn') || lowerValue === 'w') {
        return 'text-yellow-600 font-semibold';
      }
      if (lowerValue.includes('info') || lowerValue === 'i') {
        return 'text-blue-600';
      }
      if (lowerValue.includes('debug') || lowerValue === 'd') {
        return 'text-gray-600';
      }
    }
    
    // Colori per campo log_type
    if (field === 'log_type') {
      if (lowerValue.includes('error') || lowerValue.includes('security')) {
        return 'text-red-600';
      }
      if (lowerValue.includes('audit')) {
        return 'text-green-600';
      }
      if (lowerValue.includes('performance')) {
        return 'text-purple-600';
      }
    }
    
    // Colori per campo message (errori in rosso)
    if (field === 'message') {
      if (lowerValue.includes('error') || lowerValue.includes('failed') || 
          lowerValue.includes('exception') || lowerValue.includes('err') ||
          lowerValue.includes('fatal') || lowerValue.includes('crash')) {
        return 'text-red-600';
      }
      if (lowerValue.includes('warn') || lowerValue.includes('warning')) {
        return 'text-yellow-600';
      }
      if (lowerValue.includes('success') || lowerValue.includes('ok') || 
          lowerValue.includes('completed')) {
        return 'text-green-600';
      }
    }
    
    // Colori per campo action (audit)
    if (field === 'action') {
      if (lowerValue.includes('delete') || lowerValue.includes('remove')) {
        return 'text-red-600';
      }
      if (lowerValue.includes('create') || lowerValue.includes('add')) {
        return 'text-green-600';
      }
      if (lowerValue.includes('update') || lowerValue.includes('modify')) {
        return 'text-blue-600';
      }
    }
    
    // Colori per campo success
    if (field === 'success') {
      if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
        return 'text-red-600 font-semibold';
      }
      if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
        return 'text-green-600 font-semibold';
      }
    }
    
    // Default
    return 'text-gray-700';
  };

  // Estrai tutti i campi unici dai dati
  const getAllFields = (): string[] => {
    if (!data || !data.rows || data.rows.length === 0) return [];
    
    const fieldsSet = new Set<string>();
    data.rows.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== '_time') { // _time è sempre mostrato come prima colonna
          fieldsSet.add(key);
        }
      });
    });
    
    // Ordina i campi: prima quelli comuni, poi gli altri
    const commonFields = ['level', 'message', 'log_type', 'action', 'user_id', 'ip_address', 'endpoint'];
    const sortedFields = [
      ...commonFields.filter(f => fieldsSet.has(f)),
      ...Array.from(fieldsSet).filter(f => !commonFields.includes(f)).sort()
    ];
    
    return sortedFields;
  };

  const handleFindDuplicates = async () => {
    if (!selectedDataset) return;
    
    try {
      setAnalyzingDuplicates(true);
      setError(null);
      
      const response = await apiRequest.post('/admin/axiom-data/find-duplicates', {
        dataset: selectedDataset
      });
      
      if (response.success) {
        setDuplicatesCount(response.data.duplicatesCount);
        setDuplicatesDialogOpen(true);
      } else {
        setError(response.error || 'Errore nell\'analisi dei duplicati');
        toast({
          title: 'Errore',
          description: response.message || 'Impossibile analizzare i duplicati',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      console.error('Errore analisi duplicati:', err);
      setError(err.message || 'Errore nell\'analisi dei duplicati');
      toast({
        title: 'Errore',
        description: 'Impossibile analizzare i duplicati',
        variant: 'destructive'
      });
    } finally {
      setAnalyzingDuplicates(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    if (!selectedDataset || duplicatesCount === null || duplicatesCount === 0) return;
    
    try {
      setRemovingDuplicates(true);
      setError(null);
      
      const response = await apiRequest.post('/admin/axiom-data/remove-duplicates', {
        dataset: selectedDataset
      });
      
      if (response.success) {
        toast({
          title: 'Successo',
          description: `Rimossi ${duplicatesCount.toLocaleString('it-IT')} duplicati con successo`,
        });
        setDuplicatesDialogOpen(false);
        setDuplicatesCount(null);
        // Ricarica i dati
        loadData();
      } else {
        setError(response.error || 'Errore nella rimozione dei duplicati');
        toast({
          title: 'Errore',
          description: response.message || 'Impossibile rimuovere i duplicati',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      console.error('Errore rimozione duplicati:', err);
      setError(err.message || 'Errore nella rimozione dei duplicati');
      toast({
        title: 'Errore',
        description: 'Impossibile rimuovere i duplicati',
        variant: 'destructive'
      });
    } finally {
      setRemovingDuplicates(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-8 px-4">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/data-export')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Indietro
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Database className="h-8 w-8 text-green-600" />
                Axiom
              </h1>
              <p className="text-gray-600 mt-1">Visualizza e gestisci i dati su Axiom</p>
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={loadingData || !selectedDataset}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>

        {/* Selezione Dataset */}
        {!loading && datasets.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Seleziona Dataset</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {datasets.map((dataset) => (
                  <Button
                    key={dataset.name}
                    variant={selectedDataset === dataset.name ? 'default' : 'outline-solid'}
                    onClick={() => handleDatasetChange(dataset.name)}
                    className="flex items-center gap-2"
                  >
                    <Database className="h-4 w-4" />
                    {dataset.label}
                    {selectedDataset === dataset.name && (
                      <Badge variant="secondary" className="ml-2">
                        Attivo
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
              {selectedDataset && (
                <p className="text-sm text-gray-600 mt-3">
                  {datasets.find(d => d.name === selectedDataset)?.description}
                </p>
              )}
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleFindDuplicates}
                  disabled={!selectedDataset || analyzingDuplicates}
                  className="flex items-center gap-2"
                >
                  <Search className={`h-4 w-4 ${analyzingDuplicates ? 'animate-spin' : ''}`} />
                  {analyzingDuplicates ? 'Analisi in corso...' : 'Individua Doppioni'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabella Dati */}
        {loading ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Caricamento dataset...</span>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-red-600">
                <p className="font-semibold">Errore</p>
                <p className="text-sm mt-2">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : data && data.rows.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Dati {datasets.find(d => d.name === selectedDataset)?.label || selectedDataset}
                </CardTitle>
                <div className="text-sm text-gray-600">
                  Totale: {data.total.toLocaleString('it-IT')} eventi
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-100 z-10">
                        Timestamp
                      </th>
                      {getAllFields().map((field) => (
                        <th
                          key={field}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                        >
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.rows.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 sticky left-0 bg-white z-10">
                          {formatTimestamp(row._time)}
                        </td>
                        {getAllFields().map((field) => {
                          const value = getFieldValue(row, field);
                          const colorClass = getFieldColor(field, value);
                          return (
                            <td
                              key={field}
                              className={`px-4 py-3 text-sm ${colorClass} wrap-break-word`}
                              style={{ minWidth: '150px', maxWidth: '500px' }}
                            >
                              <div className="whitespace-pre-wrap wrap-break-word">
                                {value}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginazione */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, data.total)} di{' '}
                  {data.total.toLocaleString('it-IT')} eventi
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0 || loadingData}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Precedente
                  </Button>
                  <span className="text-sm text-gray-600">
                    Pagina {currentPage + 1} di {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={!data.hasMore || loadingData}
                  >
                    Successiva
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : data && data.rows.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-600">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-semibold">Nessun dato trovato</p>
                <p className="text-sm mt-2">
                  Il dataset {selectedDataset} non contiene eventi nel periodo selezionato
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Dialog Conferma Rimozione Duplicati */}
        <Dialog open={duplicatesDialogOpen} onOpenChange={setDuplicatesDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Duplicati Trovati</DialogTitle>
              <DialogDescription>
                {duplicatesCount !== null && duplicatesCount > 0 ? (
                  <>
                    Sono stati trovati <strong>{duplicatesCount.toLocaleString('it-IT')}</strong> duplicati nel dataset{' '}
                    <strong>{datasets.find(d => d.name === selectedDataset)?.label || selectedDataset}</strong>.
                    <br /><br />
                    Vuoi procedere con la rimozione? Questa operazione creerà un nuovo dataset senza duplicati e sostituirà quello attuale.
                  </>
                ) : (
                  <>
                    Non sono stati trovati duplicati nel dataset{' '}
                    <strong>{datasets.find(d => d.name === selectedDataset)?.label || selectedDataset}</strong>.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {duplicatesCount !== null && duplicatesCount > 0 && (
              <Alert className="mt-4">
                <AlertDescription>
                  <strong>Attenzione:</strong> Questa operazione è irreversibile. Il dataset originale verrà sostituito con una versione senza duplicati.
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDuplicatesDialogOpen(false)}
                disabled={removingDuplicates}
              >
                {duplicatesCount === 0 ? 'Chiudi' : 'Annulla'}
              </Button>
              {duplicatesCount !== null && duplicatesCount > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleRemoveDuplicates}
                  disabled={removingDuplicates}
                  className="flex items-center gap-2"
                >
                  <Trash2 className={`h-4 w-4 ${removingDuplicates ? 'animate-spin' : ''}`} />
                  {removingDuplicates ? 'Rimozione in corso...' : 'Rimuovi Duplicati'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

