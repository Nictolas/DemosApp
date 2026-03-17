import React from "react";
import { NoneMustacheStyle } from "./NoneMustacheStyle";
import { ClassicMustacheStyle } from "./ClassicMustacheStyle";
import { ThickMustacheStyle } from "./ThickMustacheStyle";
import { HandlebarMustacheStyle } from "./HandlebarMustacheStyle";

interface MustacheStyleSelectorProps {
  mustacheStyle: string;
  mustacheColor: string;
  onMustacheStyleChange: (style: string) => void;
}

export function MustacheStyleSelector({ mustacheStyle, mustacheColor, onMustacheStyleChange }: MustacheStyleSelectorProps) {
  const mustacheStyles = [
    { id: "none", component: <NoneMustacheStyle mustacheColor={mustacheColor} /> },
    { id: "classic", component: <ClassicMustacheStyle mustacheColor={mustacheColor} /> },
    { id: "thick", component: <ThickMustacheStyle mustacheColor={mustacheColor} /> },
    { id: "handlebar", component: <HandlebarMustacheStyle mustacheColor={mustacheColor} /> },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Stile Baffi</h3>
      <div className="grid grid-cols-4 gap-3">
        {mustacheStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => onMustacheStyleChange(style.id)}
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              mustacheStyle === style.id
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-300 hover:border-gray-400"
            }`}
            title={style.id === "none" ? "Nessuno" : 
                   style.id === "classic" ? "Classici" :
                   style.id === "thick" ? "Spessi" :
                   "A Manubrio"}
          >
            {style.component}
          </button>
        ))}
      </div>
    </div>
  );
}
