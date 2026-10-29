export interface OpinionData {
  favorevole: number;
  contrario: number;
  indeciso: number;
  astenuto: number;
}

export interface OpinionStats {
  [key: string]: OpinionData;
}

export interface Question {
  id: string;
  text: string;
}

export interface SondaggiData {
  stats: OpinionStats;
  questions: Question[];
  utentiUnici?: number;
}

export type GenereData = Array<{
  sesso: 'M' | 'F';
  totale: number;
}>;

export interface PieDataItem {
  name: string;
  value: number;
}

export interface SondaggiState {
  user: any;
  isLoading: boolean;
  isError: boolean;
  hasAdvancedAccess: boolean;
}
