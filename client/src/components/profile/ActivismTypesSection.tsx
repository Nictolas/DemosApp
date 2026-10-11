import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Heart } from "lucide-react";
import { TIPOLOGIE_ATTIVISMO, TipologiaAttivismo } from "@/constants/attivismo-types";

interface ActivismTypesSectionProps {
  initialTypes: string[];
  onTypesChange: (types: string[]) => void;
  disabled?: boolean;
}

export const ActivismTypesSection: React.FC<ActivismTypesSectionProps> = ({
  initialTypes,
  onTypesChange,
  disabled = false
}) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialTypes);
  const [isExpanded, setIsExpanded] = useState(false);

  // Aggiorna lo stato quando cambiano i tipi iniziali
  useEffect(() => {
    setSelectedTypes(initialTypes);
  }, [initialTypes]);

  const handleTypeToggle = (tipo: string) => {
    if (disabled) return;

    const isSelected = selectedTypes.includes(tipo);
    let newTypes: string[];
    
    if (isSelected) {
      // Rimuovi il tipo
      newTypes = selectedTypes.filter(t => t !== tipo);
    } else {
      // Aggiungi il tipo se non supera il limite
      if (selectedTypes.length < 5) {
        newTypes = [...selectedTypes, tipo];
      } else {
        return; // Limite raggiunto
      }
    }
    
    setSelectedTypes(newTypes);
    onTypesChange(newTypes);
  };

  const removeType = (tipo: string) => {
    if (disabled) return;
    const newTypes = selectedTypes.filter(t => t !== tipo);
    setSelectedTypes(newTypes);
    onTypesChange(newTypes);
  };

  const getSelectedTipologie = (): TipologiaAttivismo[] => {
    return selectedTypes
      .map(tipo => TIPOLOGIE_ATTIVISMO.find(t => t.tipo === tipo))
      .filter(Boolean) as TipologiaAttivismo[];
  };

  const getAvailableTipologie = (): TipologiaAttivismo[] => {
    return TIPOLOGIE_ATTIVISMO.filter(t => !selectedTypes.includes(t.tipo));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Tipologie di Attivismo
        </CardTitle>
        <p className="text-sm text-gray-600">
          Seleziona le aree di interesse per il tuo attivismo (massimo 5)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tipologie Selezionate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipologie Selezionate ({selectedTypes.length}/5)
          </label>
          
          {selectedTypes.length === 0 ? (
            <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
              Nessuna tipologia selezionata
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {getSelectedTipologie().map((tipologia) => (
                <Badge
                  key={tipologia.tipo}
                  variant="secondary"
                  className="flex items-center gap-2 px-3 py-1"
                  style={{ backgroundColor: `${tipologia.colore}20`, color: tipologia.colore }}
                >
                  <span className="text-sm">{tipologia.emoji}</span>
                  <span className="text-sm font-medium">{tipologia.nome}</span>
                  {!disabled && (
                    <button
                    type="button"
                      onClick={() => removeType(tipologia.tipo)}
                      aria-label={`Rimuovi ${tipologia.nome}`}
                    className="ml-1 inline-flex h-6 w-6 items-center justify-center hover:bg-gray-300 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Pulsante per Espandere/Contrarre */}
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-between"
            disabled={selectedTypes.length >= 5 && !isExpanded}
          >
            <span>
              {selectedTypes.length >= 5 && !isExpanded
                ? 'Limite raggiunto (5/5)'
                : isExpanded
                ? 'Chiudi Selettore'
                : 'Seleziona Tipologie di Attivismo'
              }
            </span>
            <span className="text-xs text-gray-500">
              {isExpanded ? '▲' : '▼'}
            </span>
          </Button>
        )}

        {/* Selettore Tipologie Espanso */}
        {isExpanded && !disabled && (
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Scegli le tue tipologie di attivismo
              </h4>
              <p className="text-xs text-gray-600">
                Puoi selezionare fino a 5 tipologie. Ogni tipologia rappresenta un'area di interesse per il tuo attivismo.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getAvailableTipologie().map((tipologia) => (
                <button
                  key={tipologia.tipo}
                  type="button"
                  onClick={() => handleTypeToggle(tipologia.tipo)}
                  className="flex items-center gap-3 p-3 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-white transition-colors"
                  disabled={selectedTypes.length >= 5}
                >
                  <span className="text-2xl">{tipologia.emoji}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {tipologia.nome}
                    </div>
                    <div className="text-xs text-gray-600">
                      {tipologia.descrizione}
                    </div>
                  </div>
                  <Check 
                    className={`h-4 w-4 ${
                      selectedTypes.includes(tipologia.tipo) 
                        ? 'text-green-600' 
                        : 'text-gray-300'
                    }`} 
                  />
                </button>
              ))}
            </div>

            {getAvailableTipologie().length === 0 && (
              <div className="text-center py-4 text-gray-500">
                Tutte le tipologie sono state selezionate
              </div>
            )}
          </div>
        )}

        {/* Validazione */}
        {selectedTypes.length === 0 && (
          <div className="mt-2 text-sm text-amber-600 flex items-center gap-1">
            <span>⚠️</span>
            <span>Seleziona almeno una tipologia di attivismo</span>
          </div>
        )}

        {selectedTypes.length >= 5 && (
          <div className="mt-2 text-sm text-blue-600 flex items-center gap-1">
            <span>ℹ️</span>
            <span>Hai raggiunto il limite massimo di 5 tipologie</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
