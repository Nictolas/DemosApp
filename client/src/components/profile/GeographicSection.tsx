import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useGeographicData } from "./useGeographicData";

interface GeographicSectionProps {
  title: string;
  prefix: string;
  initialData: {
    paese?: string;
    regione?: string;
    provincia?: string;
    comune?: string;
    paese_residenza?: string;
    regione_residenza?: string;
    provincia_residenza?: string;
    comune_residenza?: string;
    paese_elezione?: string;
    regione_elezione?: string;
    provincia_elezione?: string;
    comune_elezione?: string;
    paese_candidatura?: string;
    regione_candidatura?: string;
    provincia_candidatura?: string;
    comune_candidatura?: string;
  };
  onFieldChange: (field: string, value: string) => void;
  gradoValue?: string;
  onGradoChange?: (value: string) => void;
}

export function GeographicSection({
  title,
  prefix,
  initialData,
  onFieldChange,
  gradoValue = "",
  onGradoChange
}: GeographicSectionProps) {
  const {
    selectedPaese,
    selectedRegione,
    selectedProvincia,
    selectedComune,
    regioni,
    province,
    comuni,
    updatePaese,
    updateRegione,
    updateProvincia,
    updateComune,
  } = useGeographicData(initialData);

  const handlePaeseChange = (paese: string) => {
    updatePaese(paese);
    // Usa la nomenclatura corretta: paese_${prefix} invece di ${prefix}_paese
    onFieldChange(`paese_${prefix}`, paese);
  };

  const handleRegioneChange = (regione: string) => {
    updateRegione(regione);
    // Usa la nomenclatura corretta: regione_${prefix} invece di ${prefix}_regione
    onFieldChange(`regione_${prefix}`, regione);
  };

  const handleProvinciaChange = (provincia: string) => {
    updateProvincia(provincia);
    // Usa la nomenclatura corretta: provincia_${prefix} invece di ${prefix}_provincia
    onFieldChange(`provincia_${prefix}`, provincia);
  };

  const handleComuneChange = (comune: string) => {
    updateComune(comune);
    // Usa la nomenclatura corretta: comune_${prefix} invece di ${prefix}_comune
    onFieldChange(`comune_${prefix}`, comune);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 border-b pb-2">{title}</h3>
      
      {gradoValue && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`${prefix}_grado`}>Grado *</Label>
            <Select
              value={gradoValue}
              onValueChange={onGradoChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona il grado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CO">Comunale</SelectItem>
                <SelectItem value="P">Provinciale</SelectItem>
                <SelectItem value="R">Regionale</SelectItem>
                <SelectItem value="N">Nazionale</SelectItem>
                <SelectItem value="C">Camera dei Deputati</SelectItem>
                <SelectItem value="S">Senato della Repubblica</SelectItem>
                <SelectItem value="E">Europeo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}_paese`}>Paese *</Label>
          <Select
            value={selectedPaese}
            onValueChange={handlePaeseChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona il paese" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Italia">Italia</SelectItem>
              <SelectItem value="Altro">Altro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`${prefix}_regione`}>Regione *</Label>
          <Select
            value={selectedRegione}
            onValueChange={handleRegioneChange}
            disabled={!selectedPaese || selectedPaese !== "Italia"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona la regione" />
            </SelectTrigger>
            <SelectContent>
              {regioni.map((regione) => (
                <SelectItem key={regione} value={regione}>
                  {regione}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}_provincia`}>Provincia *</Label>
          <Select
            value={selectedProvincia}
            onValueChange={handleProvinciaChange}
            disabled={!selectedRegione}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona la provincia" />
            </SelectTrigger>
            <SelectContent>
              {province.map((provincia) => (
                <SelectItem key={provincia} value={provincia}>
                  {provincia}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`${prefix}_comune`}>Comune *</Label>
          <Select
            value={selectedComune}
            onValueChange={handleComuneChange}
            disabled={!selectedProvincia}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona il comune" />
            </SelectTrigger>
            <SelectContent>
              {comuni.map((comune) => (
                <SelectItem key={comune} value={comune}>
                  {comune}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

