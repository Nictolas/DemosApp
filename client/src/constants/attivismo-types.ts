// Tipologie di attivismo disponibili
export interface TipologiaAttivismo {
  tipo: string;
  emoji: string;
  nome: string;
  descrizione: string;
  colore: string;
}

export const TIPOLOGIE_ATTIVISMO: TipologiaAttivismo[] = [
  {
    tipo: "ambiente",
    emoji: "🌱",
    nome: "Ambiente e Sostenibilità",
    descrizione: "Protezione dell'ambiente, sostenibilità, cambiamenti climatici",
    colore: "#22c55e"
  },
  {
    tipo: "diritti_umani",
    emoji: "🤝",
    nome: "Diritti Umani",
    descrizione: "Tutela dei diritti fondamentali, uguaglianza, giustizia sociale",
    colore: "#3b82f6"
  },
  {
    tipo: "educazione",
    emoji: "📚",
    nome: "Educazione",
    descrizione: "Accesso all'istruzione, formazione, cultura",
    colore: "#8b5cf6"
  },
  {
    tipo: "sanita",
    emoji: "🏥",
    nome: "Sanità",
    descrizione: "Accesso alle cure, salute pubblica, benessere",
    colore: "#ef4444"
  },
  {
    tipo: "lavoro",
    emoji: "💼",
    nome: "Lavoro e Economia",
    descrizione: "Diritti dei lavoratori, economia sostenibile, occupazione",
    colore: "#f59e0b"
  },
  {
    tipo: "cultura",
    emoji: "🎭",
    nome: "Cultura e Arte",
    descrizione: "Promozione culturale, arte, patrimonio",
    colore: "#ec4899"
  },
  {
    tipo: "sport",
    emoji: "⚽",
    nome: "Sport",
    descrizione: "Promozione sportiva, attività fisica, benessere",
    colore: "#10b981"
  },
  {
    tipo: "volontariato",
    emoji: "❤️",
    nome: "Volontariato",
    descrizione: "Aiuto sociale, solidarietà, supporto alla comunità",
    colore: "#f97316"
  },
  {
    tipo: "politica",
    emoji: "🏛️",
    nome: "Politica e Istituzioni",
    descrizione: "Partecipazione democratica, trasparenza, riforme",
    colore: "#6b7280"
  },
  {
    tipo: "tecnologia",
    emoji: "💻",
    nome: "Tecnologia e Innovazione",
    descrizione: "Innovazione digitale, accessibilità tecnologica",
    colore: "#6366f1"
  },
  {
    tipo: "animali",
    emoji: "🐕",
    nome: "Diritti degli Animali",
    descrizione: "Protezione animale, benessere, diritti",
    colore: "#84cc16"
  },
  {
    tipo: "giustizia",
    emoji: "⚖️",
    nome: "Giustizia",
    descrizione: "Sistema giudiziario, legalità, diritti civili",
    colore: "#374151"
  }
];

// Funzione helper per ottenere una tipologia per tipo
export const getTipologiaByTipo = (tipo: string): TipologiaAttivismo | undefined => {
  return TIPOLOGIE_ATTIVISMO.find(t => t.tipo === tipo);
};

// Funzione helper per ottenere le emoji di una lista di tipologie
export const getEmojiFromTipologie = (tipologie: string[]): string => {
  return tipologie
    .map(tipo => getTipologiaByTipo(tipo)?.emoji)
    .filter(Boolean)
    .join(' ');
};

// Funzione helper per validare le tipologie
export const validateTipologie = (tipologie: string[]): boolean => {
  return tipologie.every(tipo => 
    TIPOLOGIE_ATTIVISMO.some(t => t.tipo === tipo)
  );
};

// Funzione helper per ottenere il colore di una tipologia
export const getColoreByTipo = (tipo: string): string => {
  return getTipologiaByTipo(tipo)?.colore || '#6b7280';
};
