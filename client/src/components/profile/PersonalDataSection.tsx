import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserInfo } from "../../pages/Profilo";

interface PersonalDataSectionProps {
  formData: UserInfo & { uid: string };
  onFieldChange: (field: keyof (UserInfo & { uid: string }), value: string) => void;
}

export function PersonalDataSection({ formData, onFieldChange }: PersonalDataSectionProps) {
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
            value={formData.data_nascita || ""}
            onChange={(e) => onFieldChange("data_nascita", e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="genere">Genere *</Label>
          <Select
            value={formData.genere || ""}
            onValueChange={(value) => onFieldChange("genere", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona il genere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Uomo</SelectItem>
              <SelectItem value="F">Donna</SelectItem>
              <SelectItem value="A">Altro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
