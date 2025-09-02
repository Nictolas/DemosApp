export const getTitolo = (categoria: string): string => {
  switch (categoria) {
    case "europeo": return "Europeo";
    case "camera": return "Nazionale";
    case "senato": return "Nazionale";
    case "regione": return "Regionale";
    case "comune": return "Comunale";
    default: return "Rappresentante";
  }
};

export const getFieldName = (categoria: string): string => {
  switch (categoria) {
    case "europeo": return "rappresentante_europeo";
    case "camera": return "rappresentante_camera";
    case "senato": return "rappresentante_senato";
    case "regione": return "rappresentante_regionale";
    case "comune": return "rappresentante_comunale";
    default: return "";
  }
};

export const getAvatarContent = (avatarConfig: string | undefined) => {
  if (!avatarConfig) return null;
  
  try {
    const config = JSON.parse(avatarConfig);
    return config;
  } catch (error) {
    return null;
  }
};

export const getButtonContent = (isSelected: boolean, isSelezionando: boolean) => {
  if (isSelezionando) {
    return { icon: "loading", text: "Selezionando..." };
  }
  if (isSelected) {
    return { icon: "check", text: "Scelto" };
  }
  return { icon: "thumbsup", text: "Scegli" };
};
