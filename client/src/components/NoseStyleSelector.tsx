import React from "react";
import { NormalNoseStyle } from "./NormalNoseStyle";
import { SmallNoseStyle } from "./SmallNoseStyle";
import { LargeNoseStyle } from "./LargeNoseStyle";
import { PointedNoseStyle } from "./PointedNoseStyle";
import { ButtonNoseStyle } from "./ButtonNoseStyle";
import { ArrowNoseStyle } from "./ArrowNoseStyle";
import { BroadNoseStyle } from "./BroadNoseStyle";
import { CurvedNoseStyle } from "./CurvedNoseStyle";

interface NoseStyleSelectorProps {
  selectedNoseStyle: string;
  onNoseStyleChange: (style: string) => void;
  skinColor: string;
}

export function NoseStyleSelector({ selectedNoseStyle, onNoseStyleChange, skinColor }: NoseStyleSelectorProps) {
  const noseStyles = [
    { id: "normal", component: <NormalNoseStyle skinColor={skinColor} /> },
    { id: "small", component: <SmallNoseStyle skinColor={skinColor} /> },
    { id: "large", component: <LargeNoseStyle skinColor={skinColor} /> },
    { id: "pointed", component: <PointedNoseStyle skinColor={skinColor} /> },
    { id: "button", component: <ButtonNoseStyle skinColor={skinColor} /> },
    { id: "arrow", component: <ArrowNoseStyle skinColor={skinColor} /> },
    { id: "broad", component: <BroadNoseStyle skinColor={skinColor} /> },
    { id: "curved", component: <CurvedNoseStyle skinColor={skinColor} /> },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Stile Naso</h3>
      <div className="grid grid-cols-4 gap-3">
        {noseStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => onNoseStyleChange(style.id)}
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              selectedNoseStyle === style.id
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-300 hover:border-gray-400"
            }`}
            title={style.id === "normal" ? "Normale" : 
                   style.id === "small" ? "Piccolo" :
                   style.id === "large" ? "Grande" :
                   style.id === "pointed" ? "Appuntito" :
                   style.id === "button" ? "A Bottone" :
                   style.id === "arrow" ? "A Freccia" :
                   style.id === "broad" ? "Largo" :
                   "Curvo"}
          >
            {style.component}
          </button>
        ))}
      </div>
    </div>
  );
}
