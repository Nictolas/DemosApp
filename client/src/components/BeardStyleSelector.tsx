import React from "react";
import { Label } from "@/components/ui/label";

interface BeardStyleSelectorProps {
  beardStyle: string;
  onBeardStyleChange: (style: string) => void;
}

export function BeardStyleSelector({ beardStyle, onBeardStyleChange }: BeardStyleSelectorProps) {
  return (
    <div>
      <Label>Stile Barba</Label>
      <div className="grid grid-cols-4 gap-0.5 mt-2">
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            beardStyle === "none" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onBeardStyleChange("none")}
          title="Nessuna"
        >
          <div className="text-gray-500 text-xs">
            Nessuna
          </div>
        </button>
        
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            beardStyle === "goatee" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onBeardStyleChange("goatee")}
          title="Pizzetto"
        >
          <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
            {/* PIZZETTO IDENTICO ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(150, 220) scale(0.08,-0.08)" fill="#8B4513">
              <ellipse
                cx="150"
                cy="150"
                rx="40"
                ry="60"
              />
            </g>
          </svg>
        </button>
        
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            beardStyle === "full" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onBeardStyleChange("full")}
          title="Piena"
        >
          <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
            {/* BARBA PIENA IDENTICA ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(150, 220) scale(0.08,-0.08)" fill="#8B4513">
              <path
                d="M120 200 Q150 240 180 200 Q180 240 150 280 Q120 240 120 200 Z"
              />
              <path
                d="M135 220 Q150 260 165 220 Q165 260 150 300 Q135 260 135 220 Z"
              />
            </g>
          </svg>
        </button>
        
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            beardStyle === "stubble" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onBeardStyleChange("stubble")}
          title="Barba Incolta"
        >
          <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
            {/* BARBA INCOLTA IDENTICA ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(150, 220) scale(0.08,-0.08)" fill="#8B4513" opacity="0.3">
              <ellipse
                cx="150"
                cy="200"
                rx="160"
                ry="80"
              />
            </g>
          </svg>
        </button>
      </div>
    </div>
  );
}
