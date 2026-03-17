import { useState, useCallback, useRef, useEffect } from 'react';

interface UseNativeSelectProps {
  initialValue?: string;
  onValueChange?: (value: string) => void;
}

export function useNativeSelect({ initialValue = "", onValueChange }: UseNativeSelectProps) {
  const [value, setValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // Gestisce l'apertura/chiusura del select
  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Gestisce la selezione di un valore
  const handleSelect = useCallback((newValue: string) => {
    setValue(newValue);
    setIsOpen(false);
    onValueChange?.(newValue);
  }, [onValueChange]);

  // Chiude il select quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Chiude il select quando si preme ESC
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return {
    value,
    isOpen,
    selectRef,
    toggleOpen,
    handleSelect,
    setValue
  };
}
