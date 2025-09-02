import React from "react";
import { User } from "lucide-react";
import { CandidatoCard } from "./CandidatoCard";
import { Categoria, UserData, Candidato, Elezione } from "../types";

interface CategoriaPrincipaleProps {
  categoria: Categoria;
  userData: UserData | null;
  candidatiDettagliati: Record<string, Candidato>;
  elezione: Elezione | undefined;
  dateString: string | null;
  onOpenOpinioni: (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => void;
  onOpenProgramma: (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => void;
}

export const CategoriaPrincipale: React.FC<CategoriaPrincipaleProps> = ({
  categoria,
  userData,
  candidatiDettagliati,
  elezione,
  dateString,
  onOpenOpinioni,
  onOpenProgramma
}) => {
  return (
    <div className="relative w-full rounded-2xl shadow-lg overflow-hidden mb-4 cursor-pointer">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="100,0 0,0 0,35 100,20" fill="#dbeafe" />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 p-6 flex flex-col items-center justify-center">
        <User className="h-12 w-12 text-blue-600 mb-2" />
        <div className="text-2xl font-bold text-blue-800 mb-1">{categoria.nome}</div>
        {dateString && (
          <p className="text-blue-600 text-center mb-2">
            <span className="font-medium">Prossime elezioni:</span><br />
            <span>{dateString}</span>
          </p>
        )}
        <p className="text-blue-600 text-center mb-4">Il tuo candidato attuale</p>
        <CandidatoCard
          categoria={categoria}
          userData={userData}
          candidatiDettagliati={candidatiDettagliati}
          onOpenOpinioni={onOpenOpinioni}
          onOpenProgramma={onOpenProgramma}
        />
      </div>
    </div>
  );
};
