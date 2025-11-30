import React, { useState } from "react";
import { Phase1Email } from "./Phase1Email";
import { Phase2Personal } from "./Phase2Personal";
import { Phase3Location } from "./Phase3Location";
import { Phase4Role } from "./Phase4Role";

export interface CompleteRegistrationData {
  email: string;
  password: string;
  nome: string;
  cognome: string;
  data_nascita: string;
  genere: string;
  cittadinanza: string;
  paese_residenza: string;
  regione_residenza: string;
  provincia_residenza: string;
  comune_residenza: string;
  paese_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;
  paese_candidatura?: string;
  regione_candidatura?: string;
  provincia_candidatura?: string;
  comune_candidatura?: string;
  ruolo: string;
  grado_elezione?: string;
  grado_candidatura?: string;
}

interface RegistrationWizardProps {
  onComplete: (data: CompleteRegistrationData) => void;
  onCancel: () => void;
  defaultValues?: Partial<CompleteRegistrationData>;
}

export function RegistrationWizard({ onComplete, onCancel, defaultValues }: RegistrationWizardProps) {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [formData, setFormData] = useState<Partial<CompleteRegistrationData>>(defaultValues || {});

  const handlePhase1Complete = (data: any) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentPhase(2);
  };

  const handlePhase2Complete = (data: any) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentPhase(3);
  };

  const handlePhase3Complete = (data: any) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentPhase(4);
  };

  const handlePhase4Complete = (data: any) => {
    const completeData = { ...formData, ...data } as CompleteRegistrationData;
    onComplete(completeData);
  };

  const handleBack = () => {
    if (currentPhase > 1) {
      setCurrentPhase(currentPhase - 1);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Fase {currentPhase} di 4</span>
          <span className="text-sm text-gray-500">
            {Math.round((currentPhase / 4) * 100)}% completato
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentPhase / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Phase Components */}
      {currentPhase === 1 && (
        <Phase1Email
          onNext={handlePhase1Complete}
          defaultValues={formData}
        />
      )}

      {currentPhase === 2 && (
        <Phase2Personal
          onNext={handlePhase2Complete}
          onBack={handleBack}
          defaultValues={formData}
        />
      )}

      {currentPhase === 3 && (
        <Phase3Location
          onNext={handlePhase3Complete}
          onBack={handleBack}
          defaultValues={formData}
        />
      )}

      {currentPhase === 4 && (
        <Phase4Role
          onSubmit={handlePhase4Complete}
          onBack={handleBack}
          defaultValues={formData}
        />
      )}

      {/* Cancel Button */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Annulla registrazione
        </button>
      </div>
    </div>
  );
}
