export interface OpinionData {
  favorevole: number;
  contrario: number;
  indeciso: number;
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

export interface GenereData {
  uomo: string;
  donna: string;
  altro: string;
}

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
