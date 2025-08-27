import React from "react";

export interface GlassesShapeProps {
  color: string;
  scale?: number;
}

// Funzione unificata per renderizzare le forme degli occhiali
export const renderGlassesShape = (style: string, color: string, scale: number = 1) => {
  const scaledStrokeWidth = Math.max(2, Math.round(3 * scale));
  
  switch (style) {
    case "round":
      return (
        <g>
          {/* Lente sinistra - posizionata correttamente sopra l'occhio sinistro */}
          <circle cx="125" cy="125" r={15 * scale} fill="none" stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Lente destra - posizionata correttamente sopra l'occhio destro */}
          <circle cx="175" cy="125" r={15 * scale} fill="none" stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Ponte centrale - collega le due lenti */}
          <path d={`M${140 * scale} ${125 * scale} L${160 * scale} ${125 * scale}`} stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Stanghetta sinistra - più lunga e visibile */}
          <path d={`M${95 * scale} ${125 * scale} L${110 * scale} ${125 * scale}`} stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Stanghetta destra - più lunga e visibile */}
          <path d={`M${190 * scale} ${125 * scale} L${205 * scale} ${125 * scale}`} stroke={color} strokeWidth={scaledStrokeWidth}/>
        </g>
      );
      
    case "square":
      return (
        <g>
          {/* Lente sinistra - rettangolo posizionato correttamente */}
          <rect x={110 * scale} y={110 * scale} width={30 * scale} height={30 * scale} fill="none" stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Lente destra - rettangolo posizionato correttamente */}
          <rect x={160 * scale} y={110 * scale} width={30 * scale} height={30 * scale} fill="none" stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Ponte centrale - collega le due lenti */}
          <path d={`M${140 * scale} ${125 * scale} L${160 * scale} ${125 * scale}`} stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Stanghetta sinistra - più lunga e visibile */}
          <path d={`M${95 * scale} ${125 * scale} L${110 * scale} ${125 * scale}`} stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Stanghetta destra - più lunga e visibile */}
          <path d={`M${190 * scale} ${125 * scale} L${205 * scale} ${125 * scale}`} stroke={color} strokeWidth={scaledStrokeWidth}/>
        </g>
      );
      
    case "aviator":
      return (
        <g>
          {/* Lente sinistra - forma aviator completamente chiusa e più grande */}
          <path d={`M${105 * scale} ${110 * scale} L${140 * scale} ${110 * scale} Q${140 * scale} ${140 * scale} ${122.5 * scale} ${150 * scale} Q${105 * scale} ${140 * scale} L${105 * scale} ${110 * scale} Z`} fill="none" stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Lente destra - forma aviator completamente chiusa e più grande */}
          <path d={`M${160 * scale} ${110 * scale} L${195 * scale} ${110 * scale} Q${195 * scale} ${140 * scale} ${177.5 * scale} ${150 * scale} Q${160 * scale} ${140 * scale} L${160 * scale} ${110 * scale} Z`} fill="none" stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Ponte centrale - collega le due lenti */}
          <path d={`M${140 * scale} ${125 * scale} L${160 * scale} ${125 * scale}`} stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Stanghetta sinistra - più lunga e visibile */}
          <path d={`M${95 * scale} ${125 * scale} L${110 * scale} ${125 * scale}`} stroke={color} strokeWidth={scaledStrokeWidth}/>
          {/* Stanghetta destra - più lunga e visibile */}
          <path d={`M${190 * scale} ${125 * scale} L${205 * scale} ${125 * scale}`} stroke={color} strokeWidth={scaledStrokeWidth}/>
        </g>
      );
      
    default:
      return null;
  }
};

// Componenti per il selettore (scala ridotta)
export const RoundGlassesStyle: React.FC<GlassesShapeProps> = ({ color }) => (
  <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
    <g transform="translate(5,60) scale(3.0,3.0)">
      {renderGlassesShape("round", color, 0.5)}
    </g>
  </svg>
);

export const SquareGlassesStyle: React.FC<GlassesShapeProps> = ({ color }) => (
  <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
    <g transform="translate(5,60) scale(3.0,3.0)">
      {renderGlassesShape("square", color, 0.5)}
    </g>
  </svg>
);

export const AviatorGlassesStyle: React.FC<GlassesShapeProps> = ({ color }) => (
  <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
    <g transform="translate(5,60) scale(3.0,3.0)">
      {renderGlassesShape("aviator", color, 0.5)}
    </g>
  </svg>
);
