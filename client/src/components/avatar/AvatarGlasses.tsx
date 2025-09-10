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
            <circle cx="125" cy="125" r="12" fill="none" stroke={glassesColor} strokeWidth="2"/>
            {/* Lente destra - posizionata correttamente sopra l'occhio destro */}
            <circle cx="175" cy="125" r="12" fill="none" stroke={glassesColor} strokeWidth="2"/>
            {/* Ponte centrale - collega le due lenti */}
            <path d="M137 125 L163 125" stroke={glassesColor} strokeWidth="2"/>
            {/* Stanghetta sinistra */}
            <path d="M100 125 L113 125" stroke={glassesColor} strokeWidth="2"/>
            {/* Stanghetta destra */}
            <path d="M187 125 L200 125" stroke={glassesColor} strokeWidth="2"/>
          </g>
        );
      case "square":
        return (
          <g>
            {/* Lente sinistra - rettangolo posizionato correttamente */}
            <rect x="113" y="113" width="24" height="24" fill="none" stroke={glassesColor} strokeWidth="2"/>
            {/* Lente destra - rettangolo posizionato correttamente */}
            <rect x="163" y="113" width="24" height="24" fill="none" stroke={glassesColor} strokeWidth="2"/>
            {/* Ponte centrale - collega le due lenti */}
            <path d="M137 125 L163 125" stroke={glassesColor} strokeWidth="2"/>
            {/* Stanghetta sinistra */}
            <path d="M100 125 L113 125" stroke={glassesColor} strokeWidth="2"/>
            {/* Stanghetta destra */}
            <path d="M187 125 L200 125" stroke={glassesColor} strokeWidth="2"/>
          </g>
        );
      case "aviator":
        return (
          <g>
            {/* Lente sinistra - forma aviator corretta */}
            <path d="M113 113 L137 113 Q137 137 125 140 Q113 137 L113 113 Z" fill="none" stroke={glassesColor} strokeWidth="2"/>
            {/* Lente destra - forma aviator corretta */}
            <path d="M163 113 L187 113 Q187 137 175 140 Q163 137 L163 113 Z" fill="none" stroke={glassesColor} strokeWidth="2"/>
            {/* Ponte centrale - collega le due lenti */}
            <path d="M137 125 L163 125" stroke={glassesColor} strokeWidth="2"/>
            {/* Stanghetta sinistra */}
            <path d="M100 125 L113 125" stroke={glassesColor} strokeWidth="2"/>
            {/* Stanghetta destra */}
            <path d="M187 125 L200 125" stroke={glassesColor} strokeWidth="2"/>
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
