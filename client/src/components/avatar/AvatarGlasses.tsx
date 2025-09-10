import React from "react";

interface AvatarGlassesProps {
  glassesStyle: string;
  glassesColor?: string;
}

export function AvatarGlasses({ glassesStyle, glassesColor = "#333333" }: AvatarGlassesProps) {
  // Se non c'è uno stile selezionato, non mostrare occhiali
  if (!glassesStyle || glassesStyle === "none") {
    return null;
  }

  const renderGlasses = () => {
    switch (glassesStyle) {
      case "round":
        return (
          <g>
            {/* Lente sinistra - posizionata correttamente sopra l'occhio sinistro */}
            <circle cx="125" cy="125" r="16" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Lente destra - posizionata correttamente sopra l'occhio destro */}
            <circle cx="175" cy="125" r="16" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Ponte centrale - collega le due lenti */}
            <path d="M141 125 L159 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta sinistra */}
            <path d="M95 125 L109 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta destra */}
            <path d="M191 125 L205 125" stroke={glassesColor} strokeWidth="3"/>
          </g>
        );
      case "square":
        return (
          <g>
            {/* Lente sinistra - rettangolo posizionato correttamente */}
            <rect x="109" y="109" width="32" height="32" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Lente destra - rettangolo posizionato correttamente */}
            <rect x="159" y="109" width="32" height="32" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Ponte centrale - collega le due lenti */}
            <path d="M141 125 L159 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta sinistra */}
            <path d="M95 125 L109 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta destra */}
            <path d="M191 125 L205 125" stroke={glassesColor} strokeWidth="3"/>
          </g>
        );
      case "aviator":
        return (
          <g>
            {/* Lente sinistra - forma aviator corretta */}
            <ellipse cx="125" cy="125" rx="16" ry="12" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Lente destra - forma aviator corretta */}
            <ellipse cx="175" cy="125" rx="16" ry="12" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Ponte centrale - collega le due lenti */}
            <path d="M141 125 L159 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta sinistra */}
            <path d="M95 125 L109 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta destra */}
            <path d="M191 125 L205 125" stroke={glassesColor} strokeWidth="3"/>
          </g>
        );
      default:
        return null;
    }
  };

  return (
    <g>
      {renderGlasses()}
    </g>
  );
}
