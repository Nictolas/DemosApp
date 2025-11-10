import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface FiltersBarProps {
  selectedRuolo: string;
  selectedGradoElezione: string;
  onRuoloChange: (value: string) => void;
  onGradoElezioneChange: (value: string) => void;
  availableRuoli: string[];
  availableGradiElezione: string[];
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  selectedRuolo,
  selectedGradoElezione,
  onRuoloChange,
  onGradoElezioneChange,
  availableRuoli,
  availableGradiElezione
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Filtro Ruolo */}
      <div className="flex-1">
        <Label htmlFor="ruolo-filter" className="text-sm font-medium text-gray-700 mb-2 block">
          Ruolo
        </Label>
        <Select value={selectedRuolo} onValueChange={onRuoloChange}>
          <SelectTrigger id="ruolo-filter" className="w-full">
            <SelectValue placeholder="Tutti i ruoli" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i ruoli</SelectItem>
            {availableRuoli.map((ruolo) => (
              <SelectItem key={ruolo} value={ruolo}>
                {ruolo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtro Grado Elezione */}
      <div className="flex-1">
        <Label htmlFor="grado-elezione-filter" className="text-sm font-medium text-gray-700 mb-2 block">
          Grado Elezione
        </Label>
        <Select value={selectedGradoElezione} onValueChange={onGradoElezioneChange}>
          <SelectTrigger id="grado-elezione-filter" className="w-full">
            <SelectValue placeholder="Tutti i gradi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i gradi</SelectItem>
            {availableGradiElezione.map((grado) => (
              <SelectItem key={grado} value={grado}>
                {grado.charAt(0).toUpperCase() + grado.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

