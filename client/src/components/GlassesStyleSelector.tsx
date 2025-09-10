import React from "react";
import { NoneGlassesStyle } from "./NoneGlassesStyle";
// Commento inutile per forzare commit e deploy
import { RoundGlassesStyle } from "./RoundGlassesStyle";
import { SquareGlassesStyle } from "./SquareGlassesStyle";
import { AviatorGlassesStyle } from "./AviatorGlassesStyle";

interface GlassesStyleSelectorProps {
  selectedGlassesStyle: string;
  glassesColor: string;
  onGlassesStyleChange: (style: string) => void;
  onGlassesColorChange?: (color: string) => void;
}

export function GlassesStyleSelector({ 
  selectedGlassesStyle, 
  glassesColor, 
  onGlassesStyleChange,
  onGlassesColorChange 
}: GlassesStyleSelectorProps) {
  const displayColor = glassesColor;
  
  const glassesStyles = [
    { id: "none", component: <NoneGlassesStyle /> },
    { id: "round", component: <RoundGlassesStyle glassesColor={displayColor} /> },
    { id: "square", component: <SquareGlassesStyle glassesColor={displayColor} /> },
    { id: "aviator", component: <AviatorGlassesStyle glassesColor={displayColor} /> },
  ];

  const handleStyleChange = (style: string) => {
    onGlassesStyleChange(style);
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Stile Occhiali</h3>
      <div className="grid grid-cols-4 gap-3">
        {glassesStyles.map((style) => (
          <button
            key={style.id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleStyleChange(style.id);
            }}
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 cursor-pointer ${
              selectedGlassesStyle === style.id
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-300 hover:border-gray-400"
            }`}
            title={style.id === "none" ? "Nessuno" : 
                   style.id === "round" ? "Rotondi" :
                   style.id === "square" ? "Quadrati" :
                   "Aviator"}
            type="button"
          >
            {style.component}
          </button>
        ))}
      </div>
    </div>
  );
}
