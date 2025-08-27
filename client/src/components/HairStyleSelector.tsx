import React from "react";
import { Label } from "@/components/ui/label";

interface HairStyleSelectorProps {
  hairStyle: string;
  hairColor: string;
  onHairStyleChange: (style: string) => void;
}

export function HairStyleSelector({ hairStyle, hairColor, onHairStyleChange }: HairStyleSelectorProps) {
  return (
    <div>
      <Label>Stile Capelli</Label>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-0.5 mt-2">
        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            hairStyle === "bald" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
          }`}
          onClick={() => onHairStyleChange("bald")}
          title="Calvo"
        >
          <div className="text-gray-400 text-xs text-center">
            <svg className="w-8 h-8 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Calvo
          </div>
        </button>

        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            hairStyle === "short" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onHairStyleChange("short")}
          title="Corti"
        >
          <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
            {/* CAPELLI CORTI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(40,250) scale(0.10,-0.10)" fill={hairColor} stroke="black" strokeWidth="50">
              <path d="M1134 2455 
                c-198 -36 -343 -109 -416 -211 
                -31 -43 -32 -44 -89 -44 
                -118 0 -265 -70 -347 -167 
                -48 -56 -94 -147 -118 -233 
                -26 -91 -26 -427 -1 -585 
                19 -118 50 -195 79 -195 
                10 0 36 -16 58 -36 
                35 -32 44 -35 64 -26 
                19 9 24 21 30 72 
                10 87 42 182 68 207 
                13 11 43 31 68 43 
                80 40 162 133 215 245 
                27 55 49 101 50 102 
                0 1 39 -17 85 -41 
                116 -60 246 -110 365 -141 
                126 -33 188 -40 345 -40 
                147 1 260 28 281 68 
                17 31 28 37 73 37 
                95 0 177 -53 220 -143 
                27 -55 50 -175 62 -315 
                6 -76 8 -84 31 -95 
                22 -10 28 -7 58 26 
                19 20 38 37 42 37 
                5 0 21 24 36 53 
                39 79 60 257 54 462 
                -6 196 -27 288 -98 434 
                -44 91 -63 116 -142 196 
                -129 129 -267 205 -465 256 
                -180 46 -457 62 -608 34" />
            </g>
          </svg>
        </button>

        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            hairStyle === "curly" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onHairStyleChange("curly")}
          title="Ricci"
        >
          <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
            {/* CAPELLI RICCI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(70,200) scale(0.20,-0.20)" fill={hairColor} stroke="black" strokeWidth="50">
              <path d="M2054 3585 c-80 -17 -136 -46 -195 -102 l-49 -46 -58 26 c-83 38 -154 50 -245 44 -147 -10 -283 -101 -321 -214 -9 -26 -16 -57 -16 -70 0 -21 -4 -23 -48 -23 -154 0 -290 -98 -338 -242 -16 -50 -16 -160 1 -214 6 -19 1 -24 -32 -34 -87 -29 -148 -85 -190 -175 -67 -145 -26 -340 96 -459 l40 -39 -49 -54 c-65 -71 -95 -162 -88 -262 11 -143 86 -240 248 -317 52 -25 104 -50 114 -56 17 -9 18 -7 12 14 -51 175 -60 285 -28 347 9 19 22 36 28 38 6 2 21 -48 37 -125 30 -146 88 -330 109 -344 15 -10 97 -1 114 13 8 7 7 30 -3 87 -9 42 -16 131 -17 197 l-1 120 50 105 c50 105 50 105 51 212 1 102 2 108 31 145 16 21 39 55 52 75 17 29 30 39 59 43 20 4 59 13 85 21 44 14 52 13 115 -7 45 -14 105 -23 184 -26 104 -5 125 -3 205 20 48 14 126 35 171 46 91 23 199 73 275 128 l49 34 74 -36 c44 -22 105 -42 149 -50 124 -21 145 -53 154 -235 7 -132 11 -145 86 -280 39 -70 52 -184 37 -323 -7 -62 -19 -140 -27 -173 -16 -70 -10 -82 55 -94 49 -9 66 3 98 67 37 73 102 295 102 347 0 14 4 26 8 26 33 0 43 -163 17 -260 -8 -30 -15 -56 -15 -57 0 -4 76 11 80 16 3 3 27 16 53 29 211 99 280 384 137 564 -17 20 -30 40 -30 43 0 4 11 21 24 38 13 18 34 61 46 97 51 152 -6 326 -139 421 l-56 40 -1 77 c-1 151 -89 266 -228 297 l-50 11 -13 65 c-34 99 -136 217 -251 292 -134 87 -245 121 -505 155 -231 31 -1054 59 -1040 36z" />
            </g>
          </svg>
        </button>

        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            hairStyle === "messy" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onHairStyleChange("messy")}
          title="Spettinati"
        >
          <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
            {/* CAPELLI SPETTINATI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(10,280) scale(0.055,-0.055)" fill={hairColor} stroke="black" strokeWidth="90">
              <path d="M2918 5295 c3 -5 23 -33 44 -61 21 -28 38 -53 38 -56 0 -3 -84 -8 -187 -11 -182 -7 -354 -29 -485 -62 -77 -21 -216 -68 -251 -87 l-29 -14 91 -45 c50 -24 90 -46 90 -49 0 -3 -26 -17 -57 -32 -135 -64 -271 -172 -376 -298 -162 -193 -267 -439 -301 -700 -14 -108 -8 -133 33 -148 l29 -10 7 -128 c13 -253 72 -601 119 -706 9 -21 17 -44 17 -52 0 -9 13 -22 30 -31 16 -8 37 -26 46 -40 9 -13 25 -27 36 -31 11 -3 37 -21 57 -39 38 -34 81 -53 81 -36 0 49 24 340 36 430 44 346 133 598 255 723 31 32 73 65 92 73 25 10 99 16 273 20 463 11 718 37 1019 104 72 16 131 28 133 26 1 -1 -30 -39 -69 -84 -39 -46 -68 -85 -65 -89 4 -3 63 0 132 7 167 16 324 61 474 134 83 41 88 42 185 42 94 0 105 -2 170 -34 75 -37 176 -126 227 -199 119 -172 196 -427 243 -797 6 -48 25 -290 25 -317 0 -28 28 -16 110 43 69 51 89 80 109 159 6 25 23 88 36 140 37 142 67 340 81 533 5 82 7 87 29 87 43 0 49 20 41 164 -10 214 -50 381 -131 551 -109 227 -283 351 -546 388 -82 12 -82 12 -95 49 -34 99 -136 217 -251 292 -134 87 -245 121 -505 155 -231 31 -1054 59 -1040 36z" />
            </g>
          </svg>
        </button>

        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            hairStyle === "wavy" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onHairStyleChange("wavy")}
          title="Ondulati"
        >
          <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
            {/* CAPELLI ONDULATI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(70,200) scale(0.16,-0.16)" fill={hairColor} stroke="black" strokeWidth="50">
              <path d="M90 60 Q110 40 150 45 Q190 40 210 60 Q220 80 215 100 Q210 115 200 120 Q195 100 195 85 Q195 70 180 65 Q165 60 150 62 Q135 60 120 65 Q105 70 105 85 Q105 100 100 120 Q90 115 85 100 Q80 80 90 60 Z" fill={hairColor} stroke="#000" strokeWidth="3" />
            </g>
          </svg>
        </button>

        <button
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
            hairStyle === "buzz" ? "border-blue-500 bg-blue-50" : "border-gray-300/50 hover:border-gray-400"
          }`}
          onClick={() => onHairStyleChange("buzz")}
          title="Rasati"
        >
          <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
            {/* CAPELLI RASATI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
            <g transform="translate(70,180) scale(0.12,-0.12)" fill={hairColor} stroke="black" strokeWidth="50">
              {/* Ciocca sinistra abbassata con punta più verso l'interno */}
              <path d="M90 80 Q80 110 90 140 Q95 130 100 110 Q95 90 90 80 Z" fill={hairColor} stroke="#000" strokeWidth="3" />
              {/* Ciocca destra abbassata con punta più verso l'interno */}
              <path d="M210 80 Q220 110 210 140 Q205 130 200 110 Q205 90 210 80 Z" fill={hairColor} stroke="#000" strokeWidth="3" />
            </g>
          </svg>
        </button>
      </div>
    </div>
  );
}
