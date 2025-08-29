export interface PremiumBenefit {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface AccountType {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  color: string;
  popular?: boolean;
}

export interface Profile {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  comune_elezione: string;
  regione_elezione: string;
}

export interface ClaimFormData {
  nome: string;
  cognome: string;
  carica_attuale: string;
  ente_elettorale: string;
  email: string;
  telefono: string;
  gdpr_accepted: boolean;
}

export interface Documents {
  documento_identita: File | null;
  certificazione_elezione: File | null;
  dichiarazione_carica: File | null;
}

export type ClaimPhase = "search" | "form" | "success";

export interface ProfileSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  searchResults: Profile[];
  onClaimProfile: (profile: Profile) => void;
  onCreateNewProfile: () => void;
}

export interface ClaimFormProps {
  selectedProfile: Profile | null;
  formData: ClaimFormData;
  documents: Documents;
  onInputChange: (field: string, value: string) => void;
  onFileUpload: (field: keyof Documents, file: File | null) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export interface SuccessMessageProps {
  onNewRequest: () => void;
}

export interface PremiumBenefitsProps {
  benefits: PremiumBenefit[];
}

export interface AccountTypesPreviewProps {
  accountTypes: AccountType[];
}
