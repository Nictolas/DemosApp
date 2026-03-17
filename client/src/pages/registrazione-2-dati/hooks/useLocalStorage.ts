import { useState, useEffect } from 'react';
import { RegistrationData } from '../types';

const STORAGE_KEY = 'registration-data';

export const useLocalStorage = () => {
  const [data, setData] = useState<Partial<RegistrationData>>({});

  // Carica i dati dal localStorage al mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedData = JSON.parse(stored);
        setData(parsedData);
      }
    } catch (error) {
      console.error('Errore nel caricamento dati dal localStorage:', error);
    }
  }, []);

  // Salva i dati nel localStorage quando cambiano
  const saveData = (newData: Partial<RegistrationData>) => {
    try {
      const updatedData = { ...data, ...newData };
      setData(updatedData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    } catch (error) {
      console.error('Errore nel salvataggio dati nel localStorage:', error);
    }
  };

  // Cancella i dati dal localStorage
  const clearData = () => {
    try {
      setData({});
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Errore nella cancellazione dati dal localStorage:', error);
    }
  };

  return {
    data,
    saveData,
    clearData
  };
};
