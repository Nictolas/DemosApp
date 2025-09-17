import { createContext, ReactNode, useContext, useState } from "react";
import { InsertUser } from "@shared/schema";

type RegistrationContextType = {
  formData: Partial<InsertUser> | null;
  setFormData: (data: Partial<InsertUser>) => void;
  clearFormData: () => void;
};

const RegistrationContext = createContext<RegistrationContextType | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [formData, setFormDataState] = useState<Partial<InsertUser> | null>(null);

  const setFormData = (data: Partial<InsertUser>) => {
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
