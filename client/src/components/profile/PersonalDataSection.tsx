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

export function PersonalDataSection({ formData, onFieldChange, isAdmin = false }: PersonalDataSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Dati Personali</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nome">Nome *</Label>
          <Input
            id="nome"
            value={formData.nome || ""}
            onChange={(e) => onFieldChange("nome", e.target.value)}
            placeholder="Inserisci il tuo nome"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="cognome">Cognome *</Label>
          <Input
            id="cognome"
            value={formData.cognome || ""}
            onChange={(e) => onFieldChange("cognome", e.target.value)}
            placeholder="Inserisci il tuo cognome"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="data_nascita">Data di Nascita *</Label>
          <Input
            id="data_nascita"
            type="date"
            value={formData.data_nascita ? convertToDateInput(formData.data_nascita) : ""}
            onChange={(e) => onFieldChange("data_nascita", e.target.value)}
            required
          />
        </div>
        
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
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div>
          <Label htmlFor="cittadinanza">Cittadinanza *</Label>
          <Input
            id="cittadinanza"
            value={formData.cittadinanza || ""}
            onChange={(e) => onFieldChange("cittadinanza", e.target.value)}
            placeholder="Inserisci la cittadinanza"
            required
          />
        </div>
      </div>
    </div>
  );
}

// Funzione per convertire la data dal formato DD/MM/YYYY al formato YYYY-MM-DD per l'input date
function convertToDateInput(dateStr: string): string {
  if (!dateStr) return "";
  
  // Se è già nel formato YYYY-MM-DD, restituiscilo così com'è
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  // Se è nel formato DD/MM/YYYY, convertilo
  if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }
  
  // Se è una data ISO, estrai solo la parte YYYY-MM-DD
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  
  return "";
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
    'Altro': 'altro',
    'Uomo': 'uomo',
    'Donna': 'donna',
    'Altro': 'altro'
  };
  
  return mapping[genere] || genere;
}
