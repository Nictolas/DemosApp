import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserInfo } from "@/types/profile";

interface PersonalDataSectionProps {
  formData: UserInfo & { uid: string };
  onFieldChange: (field: keyof (UserInfo & { uid: string }), value: string) => void;
  isAdmin?: boolean;
}

// Genere visibile solo per P, C, CP (stessa logica della vista profilo)
function showGenereForRole(ruolo: string | undefined): boolean {
  if (!ruolo) return false;
  return (
    ruolo === "P" || ruolo === "Politico" ||
    ruolo === "C" || ruolo === "Candidato" ||
    ruolo === "CP" || ruolo === "Candidato Politico"
  );
}

export function PersonalDataSection({ formData, onFieldChange, isAdmin = false }: PersonalDataSectionProps) {
  const showGenere = showGenereForRole(formData.ruolo);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Dati Personali</h3>
      
      {showGenere && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="genere">Genere *</Label>
            <Select
              value={getGenereValue(formData.genere)}
              onValueChange={(value) => onFieldChange("genere", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona il genere" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uomo">Uomo</SelectItem>
                <SelectItem value="donna">Donna</SelectItem>
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Campo Ruolo - visibile solo per Admin */}
        {isAdmin && (
          <div>
            <Label htmlFor="ruolo">Ruolo *</Label>
            <Select
              value={formData.ruolo || ""}
              onValueChange={(value) => onFieldChange("ruolo", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona il ruolo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Elettore">Elettore</SelectItem>
                <SelectItem value="Politico">Politico</SelectItem>
                <SelectItem value="Candidato">Candidato</SelectItem>
                <SelectItem value="Candidato Politico">Candidato Politico</SelectItem>
                <SelectItem value="Attivista">Attivista</SelectItem>
                <SelectItem value="Istituzione">Istituzione</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div>
          <Label htmlFor="cittadinanza">Cittadinanza *</Label>
          <Select
            value={getCittadinanzaValue(formData.cittadinanza)}
            onValueChange={(value) => onFieldChange("cittadinanza", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona la cittadinanza" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Italiana">Italiana</SelectItem>
              <SelectItem value="Straniera">Straniera</SelectItem>
              <SelectItem value="San Marino">San Marino</SelectItem>
              <SelectItem value="Svizzera">Svizzera</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// Funzione per mappare i valori del genere
function getGenereValue(genere: string): string {
  if (!genere) return "";
  
  // Mappa i valori dal database ai valori del form
  const mapping: Record<string, string> = {
    'uomo': 'uomo',
    'donna': 'donna', 
    'altro': 'altro',
    'M': 'uomo',
    'F': 'donna',
    'A': 'altro',
    'Maschio': 'uomo',
    'Femmina': 'donna',
    'Uomo': 'uomo',
    'Donna': 'donna',
    'Altro': 'altro'
  };
  
  return mapping[genere] || genere;
}

// Funzione per mappare i valori della cittadinanza
function getCittadinanzaValue(cittadinanza: string): string {
  if (!cittadinanza) return "";
  
  // Mappa i valori dal database ai valori del form
  const mapping: Record<string, string> = {
    'Italiana': 'Italiana',
    'Straniera': 'Straniera',
    'San Marino': 'San Marino',
    'Svizzera': 'Svizzera',
    'italiana': 'Italiana',
    'straniera': 'Straniera',
    'ITALIANA': 'Italiana',
    'STRANIERA': 'Straniera',
    'SAN MARINO': 'San Marino',
    'SVIZZERA': 'Svizzera',
    'it': 'Italiana', // Valore compresso dal database
    'st': 'Straniera', // Valore compresso dal database
    'sm': 'San Marino', // Valore compresso dal database
    'ch': 'Svizzera', // Valore compresso dal database
    'europea': 'Straniera', // Mappa "europea" a "Straniera"
    'extra-ue': 'Straniera' // Mappa "extra-ue" a "Straniera"
  };
  
  return mapping[cittadinanza] || cittadinanza;
}
