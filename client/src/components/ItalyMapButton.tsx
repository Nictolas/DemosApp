import React from "react";

interface ItalyMapButtonProps {
  onClick: () => void;
}

export function ItalyMapButton({ onClick }: ItalyMapButtonProps) {
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
      className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-linear-to-br from-slate-50 to-slate-100 border border-slate-200 transition-transform duration-150 ease-out"
      aria-label="Seleziona Italia come Paese di residenza"
    >
      <div className="p-4">
        <svg
          viewBox="0 0 200 140"
          className="w-full h-auto"
          role="img"
          aria-hidden="true"
        >
          {/* Sfondo Europa stilizzato */}
          <rect x="0" y="0" width="200" height="140" fill="#e5e7eb" rx="16" />
          {/* Macchia stilizzata Europa occidentale (grigia) */}
          <path
            d="M20 70 C 20 30, 80 20, 120 30 C 150 40, 170 70, 160 100 C 150 130, 80 120, 40 110 Z"
            fill="#d1d5db"
          />
          {/* Italia stilizzata in rosso */}
          <path
            d="M110 35 C 115 40, 120 50, 118 60 C 116 68, 110 74, 112 82 C 114 88, 120 94, 122 102 C 124 110, 120 118, 112 120 C 104 122, 96 118, 94 110 C 92 104, 96 98, 96 92 C 96 86, 92 80, 90 74 C 88 68, 90 60, 94 54 C 98 48, 104 44, 110 35 Z"
            fill="#ef4444"
          />
          {/* Isole stilizzate */}
          <circle cx="130" cy="115" r="6" fill="#ef4444" />
        </svg>
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Italia
          </span>
        </div>
      </div>
    </button>
  );
}

