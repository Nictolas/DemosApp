import { useState, useEffect, useCallback } from 'react';

interface UseStableSelectProps {
  initialValue?: string;
  onValueChange?: (value: string) => void;
}

export function useStableSelect({ initialValue = "", onValueChange }: UseStableSelectProps) {
  const [value, setValue] = useState(initialValue);
  const [isVisible, setIsVisible] = useState(true);

  // Mantiene la visibilità anche quando il valore cambia
  useEffect(() => {
    setIsVisible(true);
  }, [value]);

  // Gestisce il cambio di valore
  const handleValueChange = useCallback((newValue: string) => {
    setValue(newValue);
    setIsVisible(true);
    onValueChange?.(newValue);
  }, [onValueChange]);

  // Forza la visibilità
  const forceVisibility = useCallback(() => {
    setIsVisible(true);
  }, []);

  return {
    value,
    isVisible,
    handleValueChange,
    forceVisibility,
    setValue
  };
}
