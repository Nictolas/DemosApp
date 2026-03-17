export interface ExistingComunicazione {
  titolo: string;
  vincitore: string;
  zona: string;
}

export interface ComunicazioneData {
  titolo: string;
  voto_dato: "Favorevole" | "Contrario" | "Astenuto";
  commento?: string;
  vincitore: "Favorevole" | "Contrario" | "Astenuto";
  zona: string;
  isDuplicate?: boolean;
}

export interface EventoData {
  dove: string;
  quando: string;
}

export interface UltimaComunicazione {
  comunicazione: {
    titolo: string;
    voto_dato: string;
    vincitore: string;
    commento?: string;
    zona: string;
    data_creazione: string;
  };
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
