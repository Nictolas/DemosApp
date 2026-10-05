import React from "react";

interface ItalyFlagButtonProps {
  onClick: () => void;
  /** Testo sotto la bandiera (es. "Cittadinanza italiana" o "Italia") */
  label?: string;
}

export function ItalyFlagButton({ onClick, label = "Cittadinanza italiana" }: ItalyFlagButtonProps) {
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
      aria-label="Seleziona cittadinanza italiana"
    >
      <div className="p-3">
        <div className="w-full h-20 rounded-xl overflow-hidden shadow-xs border border-gray-200">
          <div className="w-full h-full flex">
            <div className="flex-1 bg-[#008C45]" /> {/* Verde */}
            <div className="flex-1 bg-[#F4F5F0]" /> {/* Bianco */}
            <div className="flex-1 bg-[#CD212A]" /> {/* Rosso */}
          </div>
        </div>
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {label}
          </span>
        </div>
      </div>
    </button>
  );
}

