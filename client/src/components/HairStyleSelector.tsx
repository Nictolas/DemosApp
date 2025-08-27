import React from "react";
import { BaldHairStyle } from "./BaldHairStyle";
import { ShortHairStyle } from "./ShortHairStyle";
import { LongHairStyle } from "./LongHairStyle";
import { CurlyHairStyle } from "./CurlyHairStyle";
import { WavyHairStyle } from "./WavyHairStyle";
import { MessyHairStyle } from "./MessyHairStyle";
import { BuzzHairStyle } from "./BuzzHairStyle";
import { PeloHairStyle } from "./PeloHairStyle";

interface HairStyleSelectorProps {
  selectedHairStyle: string;
  onHairStyleChange: (style: string) => void;
  hairColor: string;
}

export function HairStyleSelector({ selectedHairStyle, onHairStyleChange, hairColor }: HairStyleSelectorProps) {
  const hairStyles = [
    { id: "bald", component: <BaldHairStyle hairColor={hairColor} /> },
    { id: "short", component: <ShortHairStyle hairColor={hairColor} /> },
    { id: "long", component: <LongHairStyle hairColor={hairColor} /> },
    { id: "curly", component: <CurlyHairStyle hairColor={hairColor} /> },
    { id: "wavy", component: <WavyHairStyle hairColor={hairColor} /> },
    { id: "messy", component: <MessyHairStyle hairColor={hairColor} /> },
    { id: "buzz", component: <BuzzHairStyle hairColor={hairColor} /> },
    { id: "pelo", component: <PeloHairStyle hairColor={hairColor} /> },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Stile Capelli</h3>
      <div className="grid grid-cols-4 gap-3">
        {hairStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => onHairStyleChange(style.id)}
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              selectedHairStyle === style.id
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-300 hover:border-gray-400"
            }`}
            title={style.id === "bald" ? "Calvo" : 
                   style.id === "short" ? "Corti" :
                   style.id === "long" ? "Lunghi" :
                   style.id === "curly" ? "Ricci" :
                   style.id === "wavy" ? "Ondulati" :
                   style.id === "messy" ? "Spettinati" :
                   style.id === "buzz" ? "Rasati" :
                   "Pelo"}
          >
            {style.component}
          </button>
        ))}
      </div>
    </div>
  );
}
