// Mapping tra i ruoli dei ministri attuali e le categorie dei ministeri
export const ruoloToCategoria: Record<string, string> = {
  "Primo Ministro": "primo_ministro",
  "Ministro degli affari esteri e della cooperazione internazionale": "esteri",
  "Ministro dell'interno": "interno",
  "Ministro della giustizia": "giustizia",
  "Ministro della difesa": "difesa",
  "Ministro dell'economia e delle finanze": "economia",
  "Ministro delle imprese e del made in Italy": "economia", // Usa economia come categoria
  "Ministro dell'agricoltura, della sovranità alimentare e delle foreste": "economia", // Usa economia come categoria
  "Ministro dell'ambiente e della sicurezza energetica": "ambiente_sicurezza_energetica",
  "Ministro delle infrastrutture e dei trasporti": "trasporti", // Potrebbe non esistere, usa economia come fallback
  "Ministro del lavoro e delle politiche sociali": "lavoro",
  "Ministro dell'istruzione e del merito": "istruzione",
  "Ministro dell'università e della ricerca": "istruzione", // Usa istruzione come categoria
  "Ministro della cultura": "cultura",
  "Ministro della salute": "salute",
  "Ministro del turismo": "cultura" // Usa cultura come categoria
};

// Mapping per i colori (usa i colori dei ministeri esistenti)
export const ruoloToColor: Record<string, string> = {
  "Primo Ministro": "red",
  "Ministro degli affari esteri e della cooperazione internazionale": "blue",
  "Ministro dell'interno": "green",
  "Ministro della giustizia": "purple",
  "Ministro della difesa": "gray",
  "Ministro dell'economia e delle finanze": "yellow",
  "Ministro delle imprese e del made in Italy": "orange",
  "Ministro dell'agricoltura, della sovranità alimentare e delle foreste": "lime",
  "Ministro dell'ambiente e della sicurezza energetica": "lime",
  "Ministro delle infrastrutture e dei trasporti": "indigo",
  "Ministro del lavoro e delle politiche sociali": "orange",
  "Ministro dell'istruzione e del merito": "indigo",
  "Ministro dell'università e della ricerca": "blue",
  "Ministro della cultura": "teal",
  "Ministro della salute": "pink",
  "Ministro del turismo": "teal"
};

