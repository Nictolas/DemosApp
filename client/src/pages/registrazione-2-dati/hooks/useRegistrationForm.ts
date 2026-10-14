import { useState, useEffect } from 'react';
import { useRouter } from 'wouter';
import { registrationSchema } from '../schemas/validationSchema';
import { useGeographicData } from './useGeographicData';
import { useLocalStorage } from './useLocalStorage';
import { RegistrationData, FormState, FormActions } from '../types';

const initialData: RegistrationData = {
  nome: '',
  cognome: '',
  genere: '',
  cittadinanza: '',
  dataNascita: '',
  indirizzo: '',
  cap: '',
  comune: '',
  provincia: '',
  regione: '',
  telefono: '',
  email: ''
};

export const useRegistrationForm = () => {
  const router = useRouter();
  const { geographicData, getProvinceByRegione, getComuniByProvincia } = useGeographicData();
  const { data: storedData, saveData, clearData } = useLocalStorage();

  const [formState, setFormState] = useState<FormState>({
    data: { ...initialData, ...storedData },
    errors: {},
    isLoading: false,
    isSubmitting: false,
    geographicData,
    selectedRegione: storedData.regione || '',
    selectedProvincia: storedData.provincia || '',
    selectedComune: storedData.comune || ''
  });

  // Aggiorna i dati geografici quando cambiano
  useEffect(() => {
    setFormState(prev => ({
      ...prev,
      geographicData
    }));
  }, [geographicData]);

  // Aggiorna i dati quando cambiano quelli salvati
  useEffect(() => {
    setFormState(prev => ({
      ...prev,
      data: { ...prev.data, ...storedData }
    }));
  }, [storedData]);

  const setData = (newData: Partial<RegistrationData>) => {
    const updatedData = { ...formState.data, ...newData };
    setFormState(prev => ({
      ...prev,
      data: updatedData
    }));
    saveData(newData);
  };

  const setError = (field: keyof RegistrationData, error: string) => {
    setFormState(prev => ({
      ...prev,
      errors: { ...prev.errors, [field]: error }
    }));
  };

  const clearError = (field: keyof RegistrationData) => {
    setFormState(prev => {
      const newErrors = { ...prev.errors };
      delete newErrors[field];
      return { ...prev, errors: newErrors };
    });
  };

  const setLoading = (loading: boolean) => {
    setFormState(prev => ({ ...prev, isLoading: loading }));
  };

  const setSubmitting = (submitting: boolean) => {
    setFormState(prev => ({ ...prev, isSubmitting: submitting }));
  };

  const setGeographicData = (data: typeof geographicData) => {
    setFormState(prev => ({ ...prev, geographicData: data }));
  };

  const setSelectedRegione = (regione: string) => {
    setFormState(prev => ({
      ...prev,
      selectedRegione: regione,
      selectedProvincia: '',
      selectedComune: '',
      data: {
        ...prev.data,
        regione,
        provincia: '',
        comune: ''
      }
    }));
    saveData({ regione, provincia: '', comune: '' });
  };

  const setSelectedProvincia = (provincia: string) => {
    setFormState(prev => ({
      ...prev,
      selectedProvincia: provincia,
      selectedComune: '',
      data: {
        ...prev.data,
        provincia,
        comune: ''
      }
    }));
    saveData({ provincia, comune: '' });
  };

  const setSelectedComune = (comune: string) => {
    setFormState(prev => ({
      ...prev,
      selectedComune: comune,
      data: { ...prev.data, comune }
    }));
    saveData({ comune });
  };

  const resetForm = () => {
    setFormState(prev => ({
      ...prev,
      data: initialData,
      errors: {},
      selectedRegione: '',
      selectedProvincia: '',
      selectedComune: ''
    }));
    clearData();
  };

  const validateForm = (): boolean => {
    try {
      registrationSchema.parse(formState.data);
      setFormState(prev => ({ ...prev, errors: {} }));
      return true;
    } catch (error: any) {
      const errors: Partial<Record<keyof RegistrationData, string>> = {};
      if (error.errors) {
        error.errors.forEach((err: any) => {
          if (err.path && err.path[0]) {
            errors[err.path[0] as keyof RegistrationData] = err.message;
          }
        });
      }
      setFormState(prev => ({ ...prev, errors }));
      return false;
    }
  };

  const submitForm = async () => {
    if (!validateForm()) {
      return false;
    }

    setSubmitting(true);
    try {
      // Mappa i campi geografici ai nomi corretti delle API
      const apiData = {
        ...formState.data,
        paese_residenza: formState.data.regione ? "Italia" : undefined,
        regione_residenza: formState.data.regione,
        provincia_residenza: formState.data.provincia,
        comune_residenza: formState.data.comune,
        data_nascita: formState.data.dataNascita
      };
      
      // Rimuovi i campi non necessari per l'API
      delete apiData.regione;
      delete apiData.provincia;
      delete apiData.comune;
      delete apiData.dataNascita;

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore nella registrazione');
      }

      const result = await response.json();
      clearData();
      router.push('/registrazione-completata');
      return true;
    } catch (error) {
      console.error('Errore nella registrazione:', error);
      setError('email', error instanceof Error ? error.message : 'Errore sconosciuto');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const formActions: FormActions = {
    setData,
    setError,
    clearError,
    setLoading,
    setSubmitting,
    setGeographicData,
    setSelectedRegione,
    setSelectedProvincia,
    setSelectedComune,
    resetForm
  };

  return {
    formState,
    formActions,
    validateForm,
    submitForm,
    getProvinceByRegione,
    getComuniByProvincia
  };
};
