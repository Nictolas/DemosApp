export const getTitolo = (categoria: string): string => {
  switch (categoria) {
    case "europeo": return "Europeo";
    case "camera": return "Camera";
    case "senato": return "Senato";
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
    case "comune": return "rappresentante_comune";
    default: return "";
  }
};

export const getAvatarContent = (avatarConfig: string | undefined) => {
  if (!avatarConfig) return null;
  
  try {
    // Gestisci il caso di doppia serializzazione JSON
    let config;
    if (typeof avatarConfig === 'string') {
      // Prima prova a fare il parse diretto
      config = JSON.parse(avatarConfig);
      // Se il risultato è ancora una stringa, fai un secondo parse
      if (typeof config === 'string') {
        config = JSON.parse(config);
      }
    } else {
      config = avatarConfig;
    }
    return config;
  } catch (error) {
    console.log('⚠️ Errore parsing avatar:', error);
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
