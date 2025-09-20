import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useGeographicData } from "./useGeographicData";

interface GeographicSectionProps {
  title: string;
  prefix: string;
  initialData: {
    paese: string;
    regione: string;
    provincia: string;
    comune: string;
  };
  onFieldChange: (field: string, value: string) => void;
  showAula?: boolean;
  gradoValue?: string;
  onGradoChange?: (value: string) => void;
}

export function GeographicSection({
  title,
  prefix,
  initialData,
  onFieldChange,
  showAula = false,
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
    onFieldChange(`${prefix}_paese`, paese);
  };

  const handleRegioneChange = (regione: string) => {
    updateRegione(regione);
    onFieldChange(`${prefix}_regione`, regione);
  };

  const handleProvinciaChange = (provincia: string) => {
    updateProvincia(provincia);
    onFieldChange(`${prefix}_provincia`, provincia);
  };

  const handleComuneChange = (comune: string) => {
    updateComune(comune);
    onFieldChange(`${prefix}_comune`, comune);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 border-b pb-2">{title}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showAula && (
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
                <SelectItem value="Comunale">Comunale</SelectItem>
                <SelectItem value="Provinciale">Provinciale</SelectItem>
                <SelectItem value="Regionale">Regionale</SelectItem>
                <SelectItem value="Nazionale">Nazionale</SelectItem>
                <SelectItem value="Camera">Camera dei Deputati</SelectItem>
                <SelectItem value="Senato">Senato della Repubblica</SelectItem>
                <SelectItem value="Europeo">Europeo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {showAula && (gradoValue === "Nazionale" || gradoValue === "Camera" || gradoValue === "Senato") && (
          <div>
            <Label htmlFor={`${prefix}_aula`}>Aula *</Label>
            <Select
              value={getAulaValue(gradoValue, initialData.aula)}
              onValueChange={(value) => onFieldChange(`${prefix}_aula`, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona l'aula" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Camera">Camera dei Deputati</SelectItem>
                <SelectItem value="Senato">Senato della Repubblica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

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

// Funzione per mappare i valori del grado e dell'aula
function getAulaValue(gradoValue: string, aulaValue: string): string {
  if (!gradoValue) return aulaValue || "";
  
  // Se il grado è già "Camera" o "Senato", usalo direttamente
  if (gradoValue === "Camera" || gradoValue === "Senato") {
    return gradoValue;
  }
  
  // Altrimenti usa il valore dell'aula
  return aulaValue || "";
}
