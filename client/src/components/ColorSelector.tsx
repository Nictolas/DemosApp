import React from "react";
import { Label } from "@/components/ui/label";

interface ColorOption {
  name: string;
  value: string;
}

interface ColorSelectorProps {
  label: string;
  colors: ColorOption[];
  selectedColor: string;
  onColorChange: (color: string) => void;
  buttonSize?: "small" | "medium" | "large";
  gridCols?: number;
}

export function ColorSelector({ 
  label, 
  colors, 
  selectedColor, 
  onColorChange, 
  buttonSize = "medium",
  gridCols = 6 
}: ColorSelectorProps) {
  const getButtonClasses = () => {
    switch (buttonSize) {
      case "small":
        return "w-8 h-8";
      case "large":
        return "w-10 h-10";
      default:
        return "w-10 h-10";
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className={`grid grid-cols-${gridCols} gap-0.5 mt-2`}>
        {colors.map((color) => (
          <button
            key={color.value}
            className={`${getButtonClasses()} rounded-full border-2 ${
              selectedColor === color.value ? "border-black" : "border-gray-300"
            }`}
            style={{ backgroundColor: color.value }}
            onClick={() => onColorChange(color.value)}
            title={color.name}
          />
        ))}
      </div>
    </div>
  );
}
