import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle } from "lucide-react";
import { Phase1Email } from "./Phase1Email";
import { Phase2Personal } from "./Phase2Personal";
import { Phase3Location } from "./Phase3Location";
import { Phase4Role } from "./Phase4Role";

// Tipi per i dati di ogni fase
type Phase1Data = {
  email: string;
  password: string;
  confirmPassword: string;
};

type Phase2Data = {
  codice_fiscale: string;
  nome: string;
  cognome: string;
  data_nascita: string;
  genere: string;
  cittadinanza: string;
};

type Phase3Data = {
  paese_residenza: string;
  regione_residenza: string;
  provincia_residenza: string;
  comune_residenza: string;
};

type Phase4Data = {
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
};

// Tipo completo per tutti i dati
type CompleteRegistrationData = Phase1Data & Phase2Data & Phase3Data & Phase4Data;

interface RegistrationWizardProps {
  onComplete: (data: CompleteRegistrationData) => void;
  onCancel: () => void;
}

export function RegistrationWizard({ onComplete, onCancel }: RegistrationWizardProps) {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [phaseData, setPhaseData] = useState<Partial<CompleteRegistrationData>>({});

  // Gestisce il passaggio alla fase successiva
  const handleNext = (phaseNumber: number, data: any) => {
    setPhaseData(prev => ({ ...prev, ...data }));
    
    if (phaseNumber < 4) {
      setCurrentPhase(phaseNumber + 1);
    } else {
      // Ultima fase - completa la registrazione
      const completeData = { ...phaseData, ...data } as CompleteRegistrationData;
      onComplete(completeData);
    }
  };

  // Gestisce il ritorno alla fase precedente
  const handleBack = () => {
    if (currentPhase > 1) {
      setCurrentPhase(currentPhase - 1);
    }
  };

  // Calcola la percentuale di completamento
  const progressPercentage = (currentPhase / 4) * 100;

  // Determina quali fasi sono completate
  const isPhaseCompleted = (phase: number) => {
    switch (phase) {
      case 1:
        return !!(phaseData.email && phaseData.password);
      case 2:
        return !!(phaseData.nome && phaseData.cognome && phaseData.codice_fiscale);
      case 3:
        return !!(phaseData.paese_residenza);
      case 4:
        return !!(phaseData.ruolo);
      default:
        return false;
    }
  };

  // Renderizza la fase corrente
  const renderCurrentPhase = () => {
    const commonProps = {
      defaultValues: phaseData,
    };

    switch (currentPhase) {
      case 1:
        return (
          <Phase1Email
            {...commonProps}
            onNext={(data) => handleNext(1, data)}
          />
        );
      case 2:
        return (
          <Phase2Personal
            {...commonProps}
            onNext={(data) => handleNext(2, data)}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <Phase3Location
            {...commonProps}
            onNext={(data) => handleNext(3, data)}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <Phase4Role
            {...commonProps}
            onSubmit={(data) => handleNext(4, data)}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  // Renderizza l'indicatore delle fasi
  const renderPhaseIndicator = () => {
    const phases = [
      { number: 1, title: "Credenziali", icon: "🔐" },
      { number: 2, title: "Dati Personali", icon: "👤" },
      { number: 3, title: "Residenza", icon: "🏠" },
      { number: 4, title: "Ruolo", icon: "🎯" },
    ];

    return (
      <div className="flex justify-between items-center mb-8">
        {phases.map((phase, index) => (
          <div key={phase.number} className="flex flex-col items-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 mb-2 transition-all duration-200">
              {isPhaseCompleted(phase.number) ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : currentPhase === phase.number ? (
                <span className="text-blue-600 font-bold">{phase.number}</span>
              ) : (
                <Circle className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <span className={`text-xs text-center ${
              currentPhase === phase.number 
                ? 'text-blue-600 font-medium' 
                : isPhaseCompleted(phase.number) 
                  ? 'text-green-600' 
                  : 'text-gray-500'
            }`}>
              {phase.title}
            </span>
            {index < phases.length - 1 && (
              <div className={`w-16 h-0.5 mt-4 ${
                isPhaseCompleted(phase.number + 1) ? 'bg-green-600' : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold text-gray-800">
            Registrazione Account
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Completa la registrazione in {4 - currentPhase + 1} passaggi
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Indicatore di progresso */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Fase {currentPhase} di 4</span>
              <span>{Math.round(progressPercentage)}% completato</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Indicatore delle fasi */}
          {renderPhaseIndicator()}

          {/* Contenuto della fase corrente */}
          <div className="min-h-[400px]">
            {renderCurrentPhase()}
          </div>

          {/* Pulsante di annullamento */}
          <div className="text-center pt-4">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700"
            >
              Annulla registrazione
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
