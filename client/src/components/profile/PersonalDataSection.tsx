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

// Nel profilo si conserva soltanto l'anno, anche se esistono date legacy.
function getBirthYear(value?: string): string {
  const date = String(value || "").trim();
  const iso = date.match(/^(\d{4})(?:-\d{2}-\d{2})?$/);
  if (iso) return iso[1];
  const italian = date.match(/^\d{1,2}[/\-]\d{1,2}[/\-](\d{4})$/);
  return italian?.[1] || "";
}

function getGenereValue(value?: string): string {
  return ({ u: "Uomo", d: "Donna", a: "Altro" } as Record<string, string>)[value || ""] || value || "";
}

export function PersonalDataSection({ formData, onFieldChange }: PersonalDataSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Dati Personali</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="anno_nascita">Anno di nascita</Label>
          <Input
            id="anno_nascita"
            type="text"
            inputMode="numeric"
            autoComplete="bday-year"
            maxLength={4}
            pattern="[0-9]{4}"
            placeholder="Es. 1990"
            value={getBirthYear(formData.data_nascita)}
            onChange={(event) => onFieldChange("data_nascita", event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
        <div>
          <Label htmlFor="genere">Genere</Label>
          <Select
            value={getGenereValue(formData.genere)}
            onValueChange={(value) => onFieldChange("genere", value)}
          >
            <SelectTrigger id="genere">
              <SelectValue placeholder="Seleziona il genere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Uomo">Uomo</SelectItem>
              <SelectItem value="Donna">Donna</SelectItem>
              <SelectItem value="Altro">Altro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="cittadinanza">Cittadinanza</Label>
          <Select
            value={getCittadinanzaValue(formData.cittadinanza)}
            onValueChange={(value) => onFieldChange("cittadinanza", value)}
          >
            <SelectTrigger id="cittadinanza">
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
