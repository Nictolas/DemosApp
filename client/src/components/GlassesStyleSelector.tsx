import React from "react";
import { Label } from "@/components/ui/label";

interface GlassesStyleSelectorProps {
  glassesStyle: string;
  onGlassesStyleChange: (style: string) => void;
}

export function GlassesStyleSelector({ glassesStyle, onGlassesStyleChange }: GlassesStyleSelectorProps) {
  return (
    <div>
      <Label>Stile Occhiali</Label>
      <div className="grid grid-cols-4 gap-0.5 mt-2">
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            glassesStyle === "none" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onGlassesStyleChange("none")}
          title="Nessuno"
        >
          <div className="text-gray-400 text-xs text-center">
            <svg className="w-8 h-8 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Nessuno
          </div>
        </button>

        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            glassesStyle === "round" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onGlassesStyleChange("round")}
          title="Rotondi"
        >
          <svg className="w-10 h-8" viewBox="0 0 100 80" fill="none">
            {/* Lente sinistra */}
            <circle cx="25" cy="40" r="15" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Lente destra */}
            <circle cx="75" cy="40" r="15" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Ponte centrale */}
            <path d="M40 40 L60 40" stroke="#333" strokeWidth="2"/>
            {/* Stanghette */}
            <path d="M10 40 L20 40" stroke="#333" strokeWidth="2"/>
            <path d="M80 40 L90 40" stroke="#333" strokeWidth="2"/>
          </svg>
        </button>

        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            glassesStyle === "square" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onGlassesStyleChange("square")}
          title="Quadrati"
        >
          <svg className="w-10 h-8" viewBox="0 0 100 80" fill="none">
            {/* Lente sinistra */}
            <rect x="15" y="25" width="20" height="30" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Lente destra */}
            <rect x="65" y="25" width="20" height="30" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Ponte centrale */}
            <path d="M35 40 L65 40" stroke="#333" strokeWidth="2"/>
            {/* Stanghette */}
            <path d="M10 40 L20 40" stroke="#333" strokeWidth="2"/>
            <path d="M80 40 L90 40" stroke="#333" strokeWidth="2"/>
          </svg>
        </button>

        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            glassesStyle === "aviator" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onGlassesStyleChange("aviator")}
          title="Aviator"
        >
          <svg className="w-10 h-8" viewBox="0 0 100 80" fill="none">
            {/* Lente sinistra - forma aviator */}
            <path d="M15 30 Q25 20 35 30 Q35 50 25 60 Q15 50 15 30 Z" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Lente destra - forma aviator */}
            <path d="M65 30 Q75 20 85 30 Q85 50 75 60 Q65 50 65 30 Z" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Ponte centrale */}
            <path d="M35 40 L65 40" stroke="#333" strokeWidth="2"/>
            {/* Stanghette */}
            <path d="M10 40 L20 40" stroke="#333" strokeWidth="2"/>
            <path d="M80 40 L90 40" stroke="#333" strokeWidth="2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
