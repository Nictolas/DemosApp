export interface StatsData {
  favorevole: string;
  contrario: string;
  indeciso: string;
  astenuto: string;
}

export interface GenereData {
  fascia_eta: string;
  favorevole: string;
  indeciso: string;
  contrario: string;
  astenuto: string;
}

export interface EtaData {
  fascia_eta: string;
  favorevole: string;
  indeciso: string;
  contrario: string;
  astenuto: string;
}

export interface PieChartData {
  name: string;
  value: number;
}

export interface BarChartData {
  name: string;
  [key: string]: string | number;
}

export interface StatsHeaderProps {
  questionText: string;
  onBack: () => void;
}

export interface StatsOverviewProps {
  stats: StatsData;
  totaleUtenti: number;
  totalVotes: number;
}

export interface StatsPieChartProps {
  data: PieChartData[];
  title: string;
  colors: string[];
}

export interface StatsBarChartProps {
  data: BarChartData[];
  title: string;
  dataKeys: string[];
  colors: string[];
  layout?: "horizontal" | "vertical";
}

export interface StatsRegionalButtonsProps {
  opinionId: string;
  onNavigate: (path: string) => void;
}

export interface StatsLoadingProps {
  isLoading: boolean;
}

export interface StatsErrorProps {
  isError: boolean;
}
