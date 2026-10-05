import React from "react";

interface SanMarinoFlagButtonProps {
  onClick: () => void;
  /** Testo sotto la bandiera (es. "Cittadinanza sammarinese" o "San Marino") */
  label?: string;
}

export function SanMarinoFlagButton({ onClick, label = "San Marino" }: SanMarinoFlagButtonProps) {
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
      aria-label="Seleziona San Marino"
    >
      <div className="p-3">
        <div className="w-full h-20 rounded-xl overflow-hidden shadow-xs border border-gray-200">
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 bg-white" /> {/* Bianco */}
            <div className="flex-1 bg-[#5EB3E6]" /> {/* Azzurro bandiera San Marino */}
          </div>
        </div>
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
            {label}
          </span>
        </div>
      </div>
    </button>
  );
}
