export interface OpinionStats {
  favorevole: string;
  contrario: string;
  indeciso: string;
  astenuto: string;
}

export interface OpinionData {
  stats: OpinionStats;
  questionText: string;
  totaleUtenti: number;
}

export interface EtaDataItem {
  fascia_eta: string;
  favorevole: string;
  indeciso: string;
  contrario: string;
  astenuto: string;
}

export interface PieDataItem {
  name: string;
  value: number;
}

export interface BarDataItem {
  name: string;
  Favorevole: number;
  Indeciso: number;
  Contrario: number;
  Astenuto: number;
}
