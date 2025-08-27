import React from "react";
import { NoneGlassesStyle } from "./NoneGlassesStyle";
import { RoundGlassesStyle } from "./RoundGlassesStyle";
import { SquareGlassesStyle } from "./SquareGlassesStyle";
import { AviatorGlassesStyle } from "./AviatorGlassesStyle";

interface GlassesStyleSelectorProps {
  selectedGlassesStyle: string;
  onGlassesStyleChange: (style: string) => void;
}

export function GlassesStyleSelector({ selectedGlassesStyle, onGlassesStyleChange }: GlassesStyleSelectorProps) {
  const glassesStyles = [
    { id: "none", component: <NoneGlassesStyle /> },
    { id: "round", component: <RoundGlassesStyle /> },
    { id: "square", component: <SquareGlassesStyle /> },
    { id: "aviator", component: <AviatorGlassesStyle /> },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Stile Occhiali</h3>
      <div className="grid grid-cols-4 gap-3">
        {glassesStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => onGlassesStyleChange(style.id)}
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              selectedGlassesStyle === style.id
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-300 hover:border-gray-400"
            }`}
            title={style.id === "none" ? "Nessuno" : 
                   style.id === "round" ? "Rotondi" :
                   style.id === "square" ? "Quadrati" :
                   "Aviator"}
          >
            {style.component}
          </button>
        ))}
      </div>
    </div>
  );
}
