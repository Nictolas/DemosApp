// File: client/src/pages/Axiom.tsx
// Pagina per visualizzare i dati di Axiom in formato tabellare

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ArrowLeft, Database, ChevronLeft, ChevronRight } from 'lucide-react';
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
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
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

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
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
                    variant={selectedDataset === dataset.name ? 'default' : 'outline'}
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatTimestamp(row._time)}
                        </td>
                        {getAllFields().map((field) => {
                          const value = getFieldValue(row, field);
                          return (
                            <td
                              key={field}
                              className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate"
                              title={value}
                            >
                              {value.length > 50 ? `${value.substring(0, 50)}...` : value}
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
      </div>
    </div>
  );
}

