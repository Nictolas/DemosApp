import React from "react";
import { BaldHairStyle } from "./BaldHairStyle";
import { ShortHairStyle } from "./ShortHairStyle";
import { LongHairStyle } from "./LongHairStyle";
import { CurlyHairStyle } from "./CurlyHairStyle";
import { WavyHairStyle } from "./WavyHairStyle";
import { MessyHairStyle } from "./MessyHairStyle";
import { BuzzHairStyle } from "./BuzzHairStyle";

interface HairStyleSelectorProps {
  selectedHairStyle: string;
  onHairStyleChange: (style: string) => void;
  hairColor: string;
}

export function HairStyleSelector({ selectedHairStyle, onHairStyleChange, hairColor }: HairStyleSelectorProps) {
  const hairStyles = [
    { id: "bald", label: "Calvo", component: <BaldHairStyle hairColor={hairColor} /> },
    { id: "short", label: "Corti", component: <ShortHairStyle hairColor={hairColor} /> },
    { id: "long", label: "Lunghi", component: <LongHairStyle hairColor={hairColor} /> },
    { id: "curly", label: "Ricci", component: <CurlyHairStyle hairColor={hairColor} /> },
    { id: "wavy", label: "Ondulati", component: <WavyHairStyle hairColor={hairColor} /> },
    { id: "messy", label: "Spettinati", component: <MessyHairStyle hairColor={hairColor} /> },
    { id: "buzz", label: "Rasati", component: <BuzzHairStyle hairColor={hairColor} /> },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Stile Capelli</h3>
      <div className="grid grid-cols-4 gap-3">
        {hairStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => onHairStyleChange(style.id)}
            className={`p-3 rounded-lg border-2 transition-all duration-200 ${
              selectedHairStyle === style.id
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            {style.component}
            <div className="text-xs text-gray-600 mt-1 text-center">{style.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
