import { createContext, ReactNode, useContext, useState } from "react";
type RegistrationDraft = Record<string, unknown>;

type RegistrationContextType = {
  formData: RegistrationDraft | null;
  setFormData: (data: RegistrationDraft) => void;
  clearFormData: () => void;
};

const RegistrationContext = createContext<RegistrationContextType | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [formData, setFormDataState] = useState<RegistrationDraft | null>(null);

  const setFormData = (data: RegistrationDraft) => {
    setFormDataState(data);
  };

  const clearFormData = () => {
    setFormDataState(null);
  };

  return (
    <RegistrationContext.Provider
      value={{
        formData,
        setFormData,
        clearFormData,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error("useRegistration must be used within a RegistrationProvider");
  }
  return context;
}
