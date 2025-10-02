export const getTitolo = (categoria: string): string => {
  switch (categoria) {
    case "europeo": return "Europeo";
    case "camera": return "Camera";
    case "senato": return "Senato";
    case "regione": return "Regionale";
    case "comune": return "Comunale";
    default: return "Candidato";
  }
};

export const getFieldName = (categoria: string): string => {
  switch (categoria) {
    case "europeo": return "candidato_europeo";
    case "camera": return "candidato_camera";
    case "senato": return "candidato_senato";
    case "regione": return "candidato_regionale";
    case "comune": return "candidato_comune";
    default: return "candidato_europeo";
  }
};
