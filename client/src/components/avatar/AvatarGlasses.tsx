import React from "react";

interface AvatarGlassesProps {
  glassesStyle: string;
}

export function AvatarGlasses({ glassesStyle }: AvatarGlassesProps) {
  // Se non c'è uno stile selezionato, non mostrare occhiali
  if (!glassesStyle || glassesStyle === "none") {
    return null;
  }

  // FORZA SEMPRE il colore nero come default per gli occhiali
  const glassesColor = "#333333";

  const renderGlasses = () => {
    switch (glassesStyle) {
      case "round":
        return (
          <g>
            {/* Lente sinistra - posizionata correttamente sopra l'occhio sinistro */}
            <circle cx="125" cy="125" r="15" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Lente destra - posizionata correttamente sopra l'occhio destro */}
            <circle cx="175" cy="125" r="15" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Ponte centrale - collega le due lenti */}
            <path d="M140 125 L160 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta sinistra - più lunga e visibile */}
            <path d="M95 125 L110 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta destra - più lunga e visibile */}
            <path d="M190 125 L205 125" stroke={glassesColor} strokeWidth="3"/>
          </g>
        );
      case "square":
        return (
          <g>
            {/* Lente sinistra - rettangolo posizionato correttamente */}
            <rect x="110" y="110" width="30" height="30" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Lente destra - rettangolo posizionato correttamente */}
            <rect x="160" y="110" width="30" height="30" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Ponte centrale - collega le due lenti */}
            <path d="M140 125 L160 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta sinistra - più lunga e visibile */}
            <path d="M95 125 L110 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta destra - più lunga e visibile */}
            <path d="M190 125 L205 125" stroke={glassesColor} strokeWidth="3"/>
          </g>
        );
      case "aviator":
        return (
          <g>
            {/* Lente sinistra - forma aviator completamente chiusa */}
            <path d="M110 110 L140 110 Q140 140 125 150 Q110 140 L110 110 Z" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Lente destra - forma aviator completamente chiusa */}
            <path d="M160 110 L190 110 Q190 140 175 150 Q160 140 L160 110 Z" fill="none" stroke={glassesColor} strokeWidth="3"/>
            {/* Ponte centrale - collega le due lenti */}
            <path d="M140 125 L160 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta sinistra - più lunga e visibile */}
            <path d="M95 125 L110 125" stroke={glassesColor} strokeWidth="3"/>
            {/* Stanghetta destra - più lunga e visibile */}
            <path d="M190 125 L205 125" stroke={glassesColor} strokeWidth="3"/>
          </g>
        );
      default:
        return null;
    }
  };

  return (
    <g style={{ zIndex: 10 }}>
      {renderGlasses()}
    </g>
  );
}
