import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api-config';
import { GeographicData } from '../types';

export const useGeographicData = () => {
  const [geographicData, setGeographicData] = useState<GeographicData>({
    regioni: [],
    province: [],
    comuni: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGeographicData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [regioniRes, provinceRes, comuniRes] = await Promise.all([
          fetch(getApiUrl('/api/regioni')),
          fetch(getApiUrl('/api/province')),
          fetch(getApiUrl('/api/comuni'))
        ]);

        if (!regioniRes.ok || !provinceRes.ok || !comuniRes.ok) {
          throw new Error('Errore nel caricamento dei dati geografici');
        }

        const [regioni, province, comuni] = await Promise.all([
          regioniRes.json(),
          provinceRes.json(),
          comuniRes.json()
        ]);

        setGeographicData({
          regioni: regioni.data || [],
          province: province.data || [],
          comuni: comuni.data || []
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        console.error('Errore nel caricamento dati geografici:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGeographicData();
  }, []);

  const getProvinceByRegione = (regioneId: string) => {
    return geographicData.province.filter(provincia => 
      provincia.regione_id === regioneId
    );
  };

  const getComuniByProvincia = (provinciaId: string) => {
    return geographicData.comuni.filter(comune => 
      comune.provincia_id === provinciaId
    );
  };

  return {
    geographicData,
    isLoading,
    error,
    getProvinceByRegione,
    getComuniByProvincia
  };
};
