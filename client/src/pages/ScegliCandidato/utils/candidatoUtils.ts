export const getTitolo = (categoria: string): string => {
  switch (categoria) {
    case "europeo": return "Europeo";
    case "camera": return "C";
    case "senato": return "S";
    case "regione": return "R";
    case "comune": return "CO";
    default: return "Candidato";
  }
};

export const getFieldName = (categoria: string): string => {
  switch (categoria) {
    case "europeo": return "test_europeo";
    case "camera": return "test_camera";
    case "senato": return "test_senato";
    case "regione": return "test_regionale";
    case "comune": return "test_comune";
    default: return "test_europeo";
  }
};
