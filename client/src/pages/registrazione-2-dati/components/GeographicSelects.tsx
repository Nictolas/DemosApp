import React from 'react';
import { SelectField } from './SelectField';
import { GeographicData } from '../types';

interface GeographicSelectsProps {
  geographicData: GeographicData;
  selectedRegione: string;
  selectedProvincia: string;
  selectedComune: string;
  onRegioneChange: (regione: string) => void;
  onProvinciaChange: (provincia: string) => void;
  onComuneChange: (comune: string) => void;
  regioneError?: string;
  provinciaError?: string;
  comuneError?: string;
  getProvinceByRegione: (regioneId: string) => Array<{ id: string; nome: string }>;
  getComuniByProvincia: (provinciaId: string) => Array<{ id: string; nome: string }>;
}

export const GeographicSelects: React.FC<GeographicSelectsProps> = ({
  geographicData,
  selectedRegione,
  selectedProvincia,
  selectedComune,
  onRegioneChange,
  onProvinciaChange,
  onComuneChange,
  regioneError,
  provinciaError,
  comuneError,
  getProvinceByRegione,
  getComuniByProvincia
}) => {
  const availableProvince = selectedRegione ? getProvinceByRegione(selectedRegione) : [];
  const availableComuni = selectedProvincia ? getComuniByProvincia(selectedProvincia) : [];

  return (
    <div className="space-y-4">
      <SelectField
        label="Regione"
        name="regione"
        value={selectedRegione}
        onChange={onRegioneChange}
        options={geographicData.regioni}
        error={regioneError}
        placeholder="Seleziona una regione"
        required
      />

      <SelectField
        label="Provincia"
        name="provincia"
        value={selectedProvincia}
        onChange={onProvinciaChange}
        options={availableProvince}
        error={provinciaError}
        placeholder="Seleziona una provincia"
        required
        disabled={!selectedRegione}
      />

      <SelectField
        label="Comune"
        name="comune"
        value={selectedComune}
        onChange={onComuneChange}
        options={availableComuni}
        error={comuneError}
        placeholder="Seleziona un comune"
        required
        disabled={!selectedProvincia}
      />
    </div>
  );
};
