import React from "react";

interface SwitzerlandFlagButtonProps {
  onClick: () => void;
  /** Testo sotto la bandiera (es. "Cittadinanza svizzera" o "Svizzera") */
  label?: string;
}

export function SwitzerlandFlagButton({ onClick, label = "Svizzera" }: SwitzerlandFlagButtonProps) {
  const handlePressStart = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add("scale-95", "shadow-md");
  };

  const handlePressEnd = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove("scale-95", "shadow-md");
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-white border border-gray-200 transition-transform duration-150 ease-out"
      aria-label="Seleziona Svizzera"
    >
      <div className="p-3">
        <div className="w-full h-20 rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-[#DA291C] relative">
          {/* Croce bianca svizzera */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-[55%] h-[20%] bg-white rounded-sm" />
            <div className="absolute h-[55%] w-[20%] bg-white rounded-sm" />
          </div>
        </div>
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {label}
          </span>
        </div>
      </div>
    </button>
  );
}
