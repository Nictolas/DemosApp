import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Componente Progress personalizzato per evitare dipendenze esterne
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 ${className || ''}`}>
    <div 
      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
      style={{ width: `${value}%` }}
    />
  </div>
);
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
  defaultValues?: Partial<CompleteRegistrationData>;
}

export function RegistrationWizard({ onComplete, onCancel, defaultValues }: RegistrationWizardProps) {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [phaseData, setPhaseData] = useState<Partial<CompleteRegistrationData>>(defaultValues || {});

  // Gestisce il passaggio alla fase successiva
  const handleNext = (phaseNumber: number, data: any) => {
    setPhaseData(prev => ({ ...prev, ...data }));
    
    if (phaseNumber < 4) {
      // Se stiamo saltando la fase 1, vai direttamente alla fase 2
      if (phaseNumber === 1 && defaultValues?.email && defaultValues?.password) {
        setCurrentPhase(2);
      } else {
        setCurrentPhase(phaseNumber + 1);
      }
    } else {
      // Ultima fase - completa la registrazione
      const completeData = { ...phaseData, ...data } as CompleteRegistrationData;
      onComplete(completeData);
    }
  };

  // Gestisce il ritorno alla fase precedente
  const handleBack = () => {
    if (currentPhase > 1) {
      // Se stiamo tornando dalla fase 2 e abbiamo saltato la fase 1, torna alla fase 1
      if (currentPhase === 2 && defaultValues?.email && defaultValues?.password) {
        setCurrentPhase(1);
      } else {
        setCurrentPhase(currentPhase - 1);
      }
    }
  };

  // Calcola la percentuale di completamento
  const progressPercentage = (currentPhase / 4) * 100;

  // Se le credenziali sono già fornite, inizia dalla fase 2
  const effectivePhase = (defaultValues?.email && defaultValues?.password) ? Math.max(1, currentPhase - 1) : currentPhase;
  const effectiveTotalPhases = (defaultValues?.email && defaultValues?.password) ? 3 : 4;
  const effectiveProgressPercentage = (effectivePhase / effectiveTotalPhases) * 100;

  // Determina quali fasi sono completate
  const isPhaseCompleted = (phase: number) => {
    switch (phase) {
      case 1:
        // Se la fase 1 è saltata, è sempre completata
        if (defaultValues?.email && defaultValues?.password) {
          return true;
        }
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

  // Se le credenziali sono già fornite, salta la fase 1
  React.useEffect(() => {
    if (defaultValues?.email && defaultValues?.password && currentPhase === 1) {
      setCurrentPhase(2);
      setPhaseData(prev => ({ ...prev, ...defaultValues }));
    }
  }, [defaultValues, currentPhase]);

  // Renderizza la fase corrente
  const renderCurrentPhase = () => {
    const commonProps = {
      defaultValues: phaseData,
    };

    // Se le credenziali sono già fornite e siamo alla fase 1, mostra il riepilogo
    if (currentPhase === 1 && defaultValues?.email && defaultValues?.password) {
      return (
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">Credenziali Confermate</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p><strong>Email:</strong> {defaultValues.email}</p>
            <p><strong>Password:</strong> ••••••••</p>
          </div>
          <Button onClick={() => handleNext(1, { email: defaultValues.email, password: defaultValues.password, confirmPassword: defaultValues.password })}>
            Procedi ai Dati Personali
          </Button>
        </div>
      );
    }

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
      { number: 1, title: "Credenziali", icon: "🔐", skip: !!(defaultValues?.email && defaultValues?.password) },
      { number: 2, title: "Dati Personali", icon: "👤", skip: false },
      { number: 3, title: "Residenza", icon: "🏠", skip: false },
      { number: 4, title: "Ruolo", icon: "🎯", skip: false },
    ];

    // Filtra le fasi da saltare
    const visiblePhases = phases.filter(phase => !phase.skip);

    return (
      <div className="flex justify-between items-center mb-8">
        {visiblePhases.map((phase, index) => (
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
            {index < visiblePhases.length - 1 && (
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
             Completa la registrazione in {effectiveTotalPhases - effectivePhase + 1} passaggi
           </p>
        </CardHeader>

        <CardContent className="space-y-6">
                     {/* Indicatore di progresso */}
           <div className="space-y-4">
             <div className="flex justify-between text-sm text-gray-600">
               <span>Fase {effectivePhase} di {effectiveTotalPhases}</span>
               <span>{Math.round(effectiveProgressPercentage)}% completato</span>
             </div>
             <Progress value={effectiveProgressPercentage} className="h-2" />
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
