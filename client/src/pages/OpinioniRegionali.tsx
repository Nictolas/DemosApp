import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Loader2, CheckCircle, XCircle, HelpCircle, MinusCircle } from 'lucide-react';

interface Opinione {
  id: number;
  text: string;
  userAnswer: string;
}

const OpinioniRegionali: React.FC = () => {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [opinions, setOpinions] = useState<Record<string, string>>({});

  // Fetch opinioni regionali
  const { data: opinioniData, isLoading, error } = useQuery({
    queryKey: ['opinioniQuestions', 'Regionale'],
    queryFn: async () => {
      const response = await fetch('/api/opinioni-list?grado=Regionale', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Errore nel caricare le opinioni regionali');
      }
      
      const data = await response.json();
      return data.opinioni;
    }
  });

  // Mutation per salvare le opinioni
  const saveMutation = useMutation({
    mutationFn: async (opinions: Record<string, string>) => {
      const response = await fetch('/api/opinioni/salva', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ opinions })
      });

      if (!response.ok) {
        throw new Error('Errore nel salvare le opinioni');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalida la cache per ricaricare i dati
      queryClient.invalidateQueries({ queryKey: ['opinioniQuestions', 'Regionale'] });
      alert('Opinioni regionali salvate con successo!');
      navigate('/menu');
    },
    onError: (error) => {
      console.error('Errore nel salvare:', error);
      alert('Errore nel salvare le opinioni regionali');
    }
  });

  // Gestisce il cambio di opinione
  const handleOpinionChange = (opinionId: string, value: string) => {
    setOpinions(prev => ({
      ...prev,
      [opinionId]: value
    }));
  };

  // Gestisce il salvataggio
  const handleSave = () => {
    if (Object.keys(opinions).length === 0) {
      alert('Seleziona almeno un\'opinione prima di salvare');
      return;
    }
    saveMutation.mutate(opinions);
  };

  // Inizializza le opinioni quando i dati vengono caricati
  React.useEffect(() => {
    if (opinioniData) {
      const initialOpinions: Record<string, string> = {};
      opinioniData.forEach((opinione: Opinione) => {
        if (opinione.userAnswer && opinione.userAnswer !== 'Astenuto') {
          initialOpinions[opinione.text.toLowerCase().replace(/\s+/g, '_')] = opinione.userAnswer;
        }
      });
      setOpinions(initialOpinions);
    }
  }, [opinioniData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Caricamento opinioni regionali...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>Errore nel caricare le opinioni regionali</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🗺️ Opinion Regionali
          </h1>
          <p className="text-gray-600">
            Esprimi la tua opinione sulle questioni che riguardano la tua regione
          </p>
        </div>

        <div className="grid gap-6">
          {opinioniData?.map((opinione: Opinione) => (
            <Card key={opinione.id} className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg text-gray-800">
                  {opinione.text}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button
                    variant={opinions[opinione.text.toLowerCase().replace(/\s+/g, '_')] === 'Favorevole' ? 'default' : 'outline'}
                    onClick={() => handleOpinionChange(opinione.text.toLowerCase().replace(/\s+/g, '_'), 'Favorevole')}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Favorevole
                  </Button>
                  
                  <Button
                    variant={opinions[opinione.text.toLowerCase().replace(/\s+/g, '_')] === 'Contrario' ? 'default' : 'outline'}
                    onClick={() => handleOpinionChange(opinione.text.toLowerCase().replace(/\s+/g, '_'), 'Contrario')}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Contrario
                  </Button>
                  
                  <Button
                    variant={opinions[opinione.text.toLowerCase().replace(/\s+/g, '_')] === 'Indeciso' ? 'default' : 'outline'}
                    onClick={() => handleOpinionChange(opinione.text.toLowerCase().replace(/\s+/g, '_'), 'Indeciso')}
                    className="flex items-center gap-2"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Indeciso
                  </Button>
                  
                  <Button
                    variant={opinions[opinione.text.toLowerCase().replace(/\s+/g, '_')] === 'Astenuto' ? 'default' : 'outline'}
                    onClick={() => handleOpinionChange(opinione.text.toLowerCase().replace(/\s+/g, '_'), 'Astenuto')}
                    className="flex items-center gap-2"
                  >
                    <MinusCircle className="h-4 w-4" />
                    Astenuto
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || Object.keys(opinions).length === 0}
            size="lg"
            className="px-8"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvataggio...
              </>
            ) : (
              'Salva Opinion Regionali'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OpinioniRegionali;
