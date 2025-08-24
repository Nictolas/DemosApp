import React, { useState, useEffect } from 'react';
import { validaCodiceFiscale, formattaCodiceFiscale } from '../lib/codiceFiscale';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface CodiceFiscaleInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  placeholder?: string;
  showValidation?: boolean;
}

export const CodiceFiscaleInput: React.FC<CodiceFiscaleInputProps> = ({
  value,
  onChange,
  onValidationChange,
  required = false,
  disabled = false,
  className = '',
  label = 'Codice Fiscale',
  placeholder = 'Inserisci il tuo codice fiscale',
  showValidation = true
}) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [errori, setErrori] = useState<string[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [formattedValue, setFormattedValue] = useState('');

  // Validazione del codice fiscale
  useEffect(() => {
    if (!value || value.length === 0) {
      setIsValid(null);
      setErrori([]);
      onValidationChange?.(false);
      return;
    }

    const validazione = validaCodiceFiscale(value.toUpperCase());
    setIsValid(validazione.valido);
    setErrori(validazione.errori);
    onValidationChange?.(validazione.valido);
  }, [value, onValidationChange]);

  // Formattazione automatica del valore
  useEffect(() => {
    if (value) {
      const upperValue = value.toUpperCase();
      if (upperValue.length <= 16) {
        setFormattedValue(upperValue);
      }
    } else {
      setFormattedValue('');
    }
  }, [value]);

  // Gestione input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Rimuovi spazi e caratteri non validi
    const cleanValue = inputValue.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Limita a 16 caratteri
    if (cleanValue.length <= 16) {
      onChange(cleanValue);
    }
  };

  // Gestione focus/blur
  const handleFocus = () => {
    setIsTouched(true);
  };

  const handleBlur = () => {
    setIsTouched(true);
  };

  // Determina lo stato di validazione
  const getValidationState = () => {
    if (!isTouched || !value) return 'neutral';
    if (isValid === null) return 'neutral';
    return isValid ? 'valid' : 'invalid';
  };

  const validationState = getValidationState();

  // Icona di validazione
  const getValidationIcon = () => {
    switch (validationState) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  // Colore del bordo
  const getBorderColor = () => {
    switch (validationState) {
      case 'valid':
        return 'border-green-500 focus:border-green-500';
      case 'invalid':
        return 'border-red-500 focus:border-red-500';
      default:
        return 'border-gray-300 focus:border-blue-500';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor="codice-fiscale" className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="relative">
        <Input
          id="codice-fiscale"
          type="text"
          value={formattedValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-10 ${getBorderColor()}`}
          maxLength={16}
          autoComplete="off"
          spellCheck={false}
        />
        
        {showValidation && validationState !== 'neutral' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {getValidationIcon()}
          </div>
        )}
      </div>

      {/* Messaggi di validazione */}
      {showValidation && isTouched && value && (
        <>
          {isValid && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Codice fiscale valido
              </AlertDescription>
            </Alert>
          )}
          
          {!isValid && errori.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <ul className="list-disc list-inside space-y-1">
                  {errori.map((errore, index) => (
                    <li key={index}>{errore}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Suggerimenti */}
      {!value && (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Il codice fiscale è composto da 16 caratteri alfanumerici
        </div>
      )}

      {/* Esempio */}
      {!value && (
        <div className="text-xs text-gray-400">
          Esempio: RSSMRA80A01H501U
        </div>
      )}
    </div>
  );
};

export default CodiceFiscaleInput;
