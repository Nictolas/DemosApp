import { useQuery } from "@tanstack/react-query";
import apiRequest from "@/lib/api-request";
import { ITALY_DATA } from "@/data/italyData";

type OpinionData = { favorevole: number; contrario: number; indeciso: number; astenuto: number; };
type OpinionStats = Record<string, OpinionData>;
interface Question { id: string; text: string; }
interface SondaggiData {
    stats: OpinionStats;
    questions: Question[];
    utentiUnici?: number;
    filter?: {
        type: 'regione' | 'provincia' | 'comune';
        value?: string;
        regione?: string;
        provincia?: string;
        comune?: string;
    };
}

export function useSondaggiData(filterPath?: string) {
  // Determina l'endpoint API in base al filtro
  const getApiEndpoint = () => {
    if (!filterPath) return "/api/sondaggi";
    
    const pathParts = filterPath.split('/');
    if (pathParts.length === 1) {
      return `/api/sondaggi/${pathParts[0]}`;
    } else if (pathParts.length === 2) {
      return `/api/sondaggi/${pathParts[0]}/${pathParts[1]}`;
    } else if (pathParts.length === 3) {
      return `/api/sondaggi/${pathParts[0]}/${pathParts[1]}/${pathParts[2]}`;
    }
    return "/api/sondaggi";
  };

  // Query principale per statistiche sondaggi
  const { data, isLoading, isError } = useQuery<SondaggiData>({
    queryKey: ['sondaggiStats', filterPath],
    queryFn: async () => {
      const endpoint = getApiEndpoint();
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) throw new Error("Errore nel caricamento delle statistiche.");
      const result = await response.json();
      return result.data;
    },
  });

  // Query per statistiche del genere
  const { data: genereData } = useQuery({
    queryKey: ['sondaggiGenere', filterPath],
    queryFn: async () => {
      let endpoint = "/api/sondaggi/genere";
      
      if (filterPath) {
        const pathParts = filterPath.split('/');
        if (pathParts.length === 1) {
          endpoint = `/api/sondaggi/genere/${pathParts[0]}`;
        } else if (pathParts.length === 2) {
          endpoint = `/api/sondaggi/genere/${pathParts[0]}/${pathParts[1]}`;
        } else if (pathParts.length === 3) {
          endpoint = `/api/sondaggi/genere/${pathParts[0]}/${pathParts[1]}/${pathParts[2]}`;
        }
      }
      
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) throw new Error("Errore nel caricamento statistiche genere.");
      const result = await response.json();
      return result.stats; // Cambiato da result.data a result.stats per coerenza con l'API
    },
  });

  // Funzioni di utilità per dati geografici
  const getProvinceForRegion = (regionName: string) => {
    const region = ITALY_DATA.Italia.regioni.find(r => 
      r.nome.toLowerCase() === regionName.toLowerCase()
    );
    return region?.province || [];
  };

  const getComuniForProvincia = (regionName: string, provinciaName: string) => {
    const region = ITALY_DATA.Italia.regioni.find(r => 
      r.nome.toLowerCase() === regionName.toLowerCase()
    );
    const provincia = region?.province.find(p => 
      p.nome.toLowerCase() === provinciaName.toLowerCase()
    );
    return provincia?.comuni || [];
  };

  // Genera il titolo e breadcrumb in base al filtro
  const getPageTitle = () => {
    if (!data?.filter) return "Sondaggi";
    
    const filter = data.filter;
    switch (filter.type) {
      case 'regione':
        return `Sondaggi - ${filter.value}`;
      case 'provincia':
        return `Sondaggi - ${filter.provincia}`;
      case 'comune':
        return `Sondaggi - ${filter.comune}`;
      default:
        return "Sondaggi";
    }
  };

  const getBreadcrumb = () => {
    if (!data?.filter) return null;
    
    const filter = data.filter;
    const breadcrumbItems = [];
    
    if (filter.regione) {
      breadcrumbItems.push({
        label: filter.regione,
        href: `/sondaggi/${filter.regione.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'regione'
      });
    }
    
    if (filter.provincia) {
      breadcrumbItems.push({
        label: filter.provincia,
        href: `/sondaggi/${filter.regione?.toLowerCase().replace(/\s+/g, '-')}/${filter.provincia.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'provincia'
      });
    }
    
    if (filter.comune) {
      breadcrumbItems.push({
        label: filter.comune,
        href: null,
        type: 'comune'
      });
    }
    
    return breadcrumbItems;
  };

  return {
    data,
    genereData,
    isLoading,
    isError,
    getProvinceForRegion,
    getComuniForProvincia,
    getPageTitle,
    getBreadcrumb,
  };
}
