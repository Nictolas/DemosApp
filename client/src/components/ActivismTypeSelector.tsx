import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TIPOLOGIE_ATTIVISMO, TipologiaAttivismo } from '@/constants/attivismo-types';

interface ActivismTypeSelectorProps {
  selectedTypes: string[];
  onSelectionChange: (types: string[]) => void;
  maxSelections?: number;
  disabled?: boolean;
}

const ActivismTypeSelector: React.FC<ActivismTypeSelectorProps> = ({
  selectedTypes,
  onSelectionChange,
  maxSelections = 5,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleTypeToggle = (tipo: string) => {
    if (disabled) return;

    const isSelected = selectedTypes.includes(tipo);
    
    if (isSelected) {
      // Rimuovi il tipo
      onSelectionChange(selectedTypes.filter(t => t !== tipo));
    } else {
      // Aggiungi il tipo se non supera il limite
      if (selectedTypes.length < maxSelections) {
        onSelectionChange([...selectedTypes, tipo]);
      }
    }
  };

  const removeType = (tipo: string) => {
    if (disabled) return;
    onSelectionChange(selectedTypes.filter(t => t !== tipo));
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
    <div className="w-full">
      {/* Selezioni Correnti */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipologie di Attivismo Selezionate
          {maxSelections > 0 && (
            <span className="text-gray-500 ml-1">
              ({selectedTypes.length}/{maxSelections})
            </span>
          )}
        </label>
        
        {selectedTypes.length === 0 ? (
          <div className="text-sm text-gray-500 italic">
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
                    onClick={() => removeType(tipologia.tipo)}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Pulsante per Aprire Selettore */}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full justify-between"
          disabled={selectedTypes.length >= maxSelections && maxSelections > 0}
        >
          <span>
            {selectedTypes.length >= maxSelections && maxSelections > 0
              ? 'Limite raggiunto'
              : 'Seleziona Tipologie di Attivismo'
            }
          </span>
          <span className="text-xs text-gray-500">
            {isOpen ? 'Chiudi' : 'Apri'}
          </span>
        </Button>
      )}

      {/* Selettore Tipologie */}
      {isOpen && !disabled && (
        <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Scegli le tue tipologie di attivismo
            </h4>
            <p className="text-xs text-gray-600">
              Puoi selezionare fino a {maxSelections} tipologie. Ogni tipologia rappresenta un'area di interesse per il tuo attivismo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {getAvailableTipologie().map((tipologia) => (
              <button
                key={tipologia.tipo}
                onClick={() => handleTypeToggle(tipologia.tipo)}
                className="flex items-center gap-3 p-3 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-white transition-colors"
                disabled={selectedTypes.length >= maxSelections && maxSelections > 0}
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
        <div className="mt-2 text-sm text-amber-600">
          ⚠️ Seleziona almeno una tipologia di attivismo
        </div>
      )}
    </div>
  );
};

export default ActivismTypeSelector;
