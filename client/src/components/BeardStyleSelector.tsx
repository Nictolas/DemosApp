import React from "react";
import { NoneBeardStyle } from "./NoneBeardStyle";
import { GoateeBeardStyle } from "./GoateeBeardStyle";
import { FullBeardStyle } from "./FullBeardStyle";
import { StubbleBeardStyle } from "./StubbleBeardStyle";

interface BeardStyleSelectorProps {
  beardStyle: string;
  beardColor: string;
  onBeardStyleChange: (style: string) => void;
}

export function BeardStyleSelector({ beardStyle, beardColor, onBeardStyleChange }: BeardStyleSelectorProps) {
  const beardStyles = [
    { id: "none", component: <NoneBeardStyle beardColor={beardColor} /> },
    { id: "goatee", component: <GoateeBeardStyle beardColor={beardColor} /> },
    { id: "full", component: <FullBeardStyle beardColor={beardColor} /> },
    { id: "stubble", component: <StubbleBeardStyle beardColor={beardColor} /> },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Stile Barba</h3>
      <div className="grid grid-cols-4 gap-3">
        {beardStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => onBeardStyleChange(style.id)}
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              beardStyle === style.id
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-300 hover:border-gray-400"
            }`}
            title={style.id === "none" ? "Nessuna" : 
                   style.id === "goatee" ? "Pizzetto" :
                   style.id === "full" ? "Piena" :
                   "Barba Incolta"}
          >
            {style.component}
          </button>
        ))}
      </div>
    </div>
  );
}
