export interface ComunicazioneData {
  titolo: string;
  voto_dato: "Favorevole" | "Contrario" | "Astenuto";
  data_votazione: string;
  commento?: string;
}

export interface EventoData {
  dove: string;
  quando: string;
}

export interface UltimaComunicazione {
  success: boolean;
  comunicazione: {
    titolo: string;
    voto_dato: string;
    commento?: string;
    livello?: string;
    data_votazione?: string;
    data_creazione: string;
  } | null;
}

export interface NavigationButton {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  route: string;
  requiresRole?: string[];
  svgPath: string;
  svgFill: string;
}
