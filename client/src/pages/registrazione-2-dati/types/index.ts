export interface RegistrationData {
  nome: string;
  cognome: string;
  genere: string;
  cittadinanza: string;
  dataNascita: string;
  codiceFiscale?: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  regione: string;
  telefono: string;
  email: string;
  ruolo: string;
  paese_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;
  paese_candidatura?: string;
  regione_candidatura?: string;
  provincia_candidatura?: string;
  comune_candidatura?: string;
  grado_elezione?: string;
  grado_candidatura?: string;
}

export interface GeographicData {
  regioni: Array<{ id: string; nome: string }>;
  province: Array<{ id: string; nome: string; regione_id: string }>;
  comuni: Array<{ id: string; nome: string; provincia_id: string }>;
}

export interface FormState {
  data: RegistrationData;
  errors: Partial<Record<keyof RegistrationData, string>>;
  isLoading: boolean;
  isSubmitting: boolean;
  geographicData: GeographicData;
  selectedRegione: string;
  selectedProvincia: string;
  selectedComune: string;
}

export interface FormActions {
  setData: (data: Partial<RegistrationData>) => void;
  setError: (field: keyof RegistrationData, error: string) => void;
  clearError: (field: keyof RegistrationData) => void;
  setLoading: (loading: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setGeographicData: (data: GeographicData) => void;
  setSelectedRegione: (regione: string) => void;
  setSelectedProvincia: (provincia: string) => void;
  setSelectedComune: (comune: string) => void;
  resetForm: () => void;
}
