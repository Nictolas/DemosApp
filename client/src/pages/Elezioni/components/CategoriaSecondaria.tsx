import React from "react";
import { User } from "lucide-react";
import { CandidatoCard } from "./CandidatoCard";
import { Categoria, UserData, Candidato, Elezione } from "../types";

interface CategoriaSecondariaProps {
  categoria: Categoria;
  userData: UserData | null;
  candidatiDettagliati: Record<string, Candidato>;
  elezione: Elezione | undefined;
  dateString: string | null;
  color: { bg: string; text: string; icon: string };
  onOpenOpinioni: (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => void;
  onOpenProgramma: (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => void;
}

export const CategoriaSecondaria: React.FC<CategoriaSecondariaProps> = ({
  categoria,
  userData,
  candidatiDettagliati,
  elezione,
  dateString,
  color,
  onOpenOpinioni,
  onOpenProgramma
}) => {
  return (
    <div className="relative w-full rounded-2xl shadow-lg overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 p-4 md:p-6 flex flex-col items-center justify-center">
        <User className="h-8 md:h-12 w-8 md:w-12 mb-2" style={{ color: color.icon }} />
        <div className="text-base md:text-xl font-bold mb-1 text-center leading-tight" style={{ color: color.text }}>
          {categoria.nome}
        </div>
        {dateString && (
          <p className="text-sm text-center mb-2" style={{ color: color.text }}>
            <span className="font-medium">Prossime elezioni:</span><br />
            <span>{dateString}</span>
          </p>
        )}
        <p className="text-sm text-center mb-3" style={{ color: color.text }}>
          Il tuo candidato attuale
        </p>
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
