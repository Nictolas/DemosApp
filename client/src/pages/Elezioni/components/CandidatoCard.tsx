import React from "react";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { Link } from "wouter";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { Candidato, Categoria, UserData } from "../types";

interface CandidatoCardProps {
  categoria: Categoria;
  userData: UserData | null;
  candidatiDettagliati: Record<string, Candidato>;
  onOpenOpinioni: (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => void;
  onOpenProgramma: (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => void;
}

export const CandidatoCard: React.FC<CandidatoCardProps> = ({
  categoria,
  userData,
  candidatiDettagliati,
  onOpenOpinioni,
  onOpenProgramma
}) => {
  const candidatoId = userData?.[categoria.field];
  
  if (candidatoId && candidatiDettagliati[candidatoId]) {
    const candidato = candidatiDettagliati[candidatoId];
    let avatarContent;
    try {
      if (candidato.avatar_config) {
        const config = JSON.parse(candidato.avatar_config);
        avatarContent = <CustomAvatar config={config} size={80} className="border-2 border-gray-300 rounded-full shadow-sm" />;
      }
    } catch (e) { /* Fallback will be used */ }

    return (
      <div className="flex flex-col space-y-3 items-center">
        {avatarContent || (
          <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="h-10 w-10 text-gray-400" />
          </div>
        )}
        <div className="text-center">
          <p className="font-medium text-primary cursor-pointer hover:underline" onClick={() => onOpenOpinioni(candidatoId, candidato.nome, candidato.cognome, candidato.avatar_config)}>
            {`${candidato.nome} ${candidato.cognome}`}
          </p>
          <div className="flex flex-row gap-2 justify-center mt-1">
            <Button variant="secondary" size="sm" onClick={() => onOpenOpinioni(candidatoId, candidato.nome, candidato.cognome, candidato.avatar_config)}>Vedi Opinioni</Button>
            <Button variant="outline" size="sm" onClick={() => onOpenProgramma(candidatoId, candidato.nome, candidato.cognome, candidato.avatar_config)}>Vedi Programma</Button>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/scegli-candidato/${categoria.id}`}>Cambia candidato</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col space-y-3 items-center">
      <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center">
        <User className="h-10 w-10 text-gray-400" />
      </div>
      <p className="text-gray-500 italic">Nessun candidato scelto</p>
      <Button variant="default" size="sm" asChild>
        <Link to={`/scegli-candidato/${categoria.id}`}>Scegli Candidato</Link>
      </Button>
    </div>
  );
};
