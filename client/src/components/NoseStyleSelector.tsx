import React from "react";
import { Label } from "@/components/ui/label";

interface NoseStyleSelectorProps {
  noseStyle: string;
  onNoseStyleChange: (style: string) => void;
}

export function NoseStyleSelector({ noseStyle, onNoseStyleChange }: NoseStyleSelectorProps) {
  return (
    <div>
      <Label>Stile Naso</Label>
      <div className="grid grid-cols-5 gap-2 mt-2">
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            noseStyle === "normal" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onNoseStyleChange("normal")}
          title="Normale"
        >
          <svg className="w-10 h-8" viewBox="0 0 300 300" fill="currentColor">
            {/* NASO NORMALE IDENTICO ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(150, 180) scale(0.08,-0.08)" fill="#FDBCB4">
              <path d="M150 100 Q180 150 150 200 Q120 150 150 100 Z" />
            </g>
          </svg>
        </button>
        
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            noseStyle === "small" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onNoseStyleChange("small")}
          title="Piccolo"
        >
          <svg className="w-10 h-8" viewBox="0 0 300 300" fill="currentColor">
            {/* NASO PICCOLO IDENTICO ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(150, 180) scale(0.06,-0.06)" fill="#FDBCB4">
              <path d="M150 120 Q165 150 150 180 Q135 150 150 120 Z" />
            </g>
          </svg>
        </button>
        
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            noseStyle === "large" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onNoseStyleChange("large")}
          title="Grande"
        >
          <svg className="w-10 h-8" viewBox="0 0 300 300" fill="currentColor">
            {/* NASO GRANDE IDENTICO ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(150, 180) scale(0.1,-0.1)" fill="#FDBCB4">
              <path d="M150 80 Q200 150 150 220 Q100 150 150 80 Z" />
            </g>
          </svg>
        </button>
        
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            noseStyle === "pointed" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onNoseStyleChange("pointed")}
          title="Appuntito"
        >
          <svg className="w-10 h-8" viewBox="0 0 300 300" fill="currentColor">
            {/* NASO APPUNTITO IDENTICO ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(150, 180) scale(0.08,-0.08)" fill="#FDBCB4">
              <path d="M150 100 L180 150 L150 200 L120 150 Z" />
            </g>
          </svg>
        </button>
        
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            noseStyle === "button" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onNoseStyleChange("button")}
          title="A Bottone"
        >
          <svg className="w-10 h-8" viewBox="0 0 300 300" fill="currentColor">
            {/* NASO A BOTTONE IDENTICO ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(150, 180) scale(0.08,-0.08)" fill="#FDBCB4">
              <circle cx="150" cy="150" r="30" />
            </g>
          </svg>
        </button>
      </div>
    </div>
  );
}
