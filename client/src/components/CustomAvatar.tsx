function darkenColor(hexColor: string, amount: number = 20) {
  // Rimuove il # se presente
  let color = hexColor.replace("#", "");
  if (color.length === 3) {
    color = color.split("").map((c: string) => c + c).join("");
  }

  // Estrae i valori RGB
  const num = parseInt(color, 16);
  let r = (num >> 16) & 0xFF;
  let g = (num >> 8) & 0xFF;
  let b = num & 0xFF;

  // Scura il colore
  r = Math.max(0, r - amount);
  g = Math.max(0, g - amount);
  b = Math.max(0, b - amount);

  // Ricompone in esadecimale
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

interface AvatarConfig {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  mustacheStyle: string;
  mustacheColor: string;
  beardStyle: string;
  beardColor: string;
  noseStyle: string;
  suitColor: string;
  tieColor: string;
  glassesStyle: string;
}

interface CustomAvatarProps {
  config: AvatarConfig | null;
  size?: number;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const defaultConfig: AvatarConfig = {
  skinColor: "#FDBCB4",
  hairColor: "#8B4513",
  hairStyle: "short",
  mustacheStyle: "none",
  mustacheColor: "#2C1810",
  beardStyle: "none",
  beardColor: "#2C1810",
  noseStyle: "normal",
  suitColor: "#2C3E50",
  tieColor: "#E74C3C",
  glassesStyle: "none"
};

export function CustomAvatar({ config, size = 100, className = "rounded-full", onClick }: CustomAvatarProps) {
  const avatarConfig = config || defaultConfig;

  const renderHair = () => {
    const hairColor = avatarConfig.hairColor;
    
    switch (avatarConfig.hairStyle) {
      case "bald":
        return null;
        case "classic":
          return null;
      case "short":
        return (
          <g fill={hairColor} stroke="black" strokeWidth="50" transform="translate(70,180) scale(0.06,-0.06)">
            <path d="
              M1134 2455 
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
              -180 46 -457 62 -608 34
            " />
          </g>
        );
      case "long":
        const darkerHairColor = darkenColor(hairColor, 30);

        return (
          <g>
            <g
              transform="translate(10,285) scale(0.03,-0.03)"
              fill={hairColor}
              stroke="black"
              strokeWidth="80"
            >
              <path d="M4175 8349 c-406 -54 -755 -201 -1090 -458 -88 -67 -288 -264 -362 -356 -252 -314 -427 -676 -569 -1176 -168 -595 -240 -1234 -238 -2124 0 -551 24 -896 100 -1465 96 -722 209 -1111 389 -1338 139 -176 335 -270 425 -204 25 19 26 19 60 -5 97 -68 269 -123 379 -122 81 0 128 16 154 51 l20 27 -46 183 c-40 157 -68 295 -91 438 -20 125 -52 476 -81 885 -17 240 -37 394 -61 477 -9 29 -58 166 -109 303 -110 294 -171 497 -219 736 -65 322 -96 627 -96 966 l0 191 69 105 c38 58 169 269 292 469 273 447 344 557 471 725 385 514 826 813 1198 813 74 0 110 -6 162 -24 95 -34 222 -106 340 -193 126 -92 382 -348 495 -493 218 -281 421 -637 648 -1135 l78 -170 -6 -290 c-7 -367 -32 -608 -98 -960 -57 -300 -119 -521 -267 -955 -67 -193 -87 -307 -162 -915 -61 -497 -107 -729 -192 -988 -39 -120 -41 -130 -27 -155 19 -35 67 -51 155 -51 102 -1 240 46 301 102 l22 20 30 -32 c24 -26 36 -31 73 -31 87 1 206 67 309 172 253 260 417 757 538 1628 68 487 93 866 94 1415 1 493 -20 818 -79 1200 -114 748 -313 1330 -595 1745 -357 524 -954 872 -1551 904 -51 3 -121 15 -170 30 -149 45 -243 58 -438 61 -102 2 -216 -1 -255 -6z" />
            </g>
          </g>
        );
      case "curly":
        return (
          <g fill={hairColor} stroke="black" strokeWidth="40" transform="translate(25,230) scale(0.06,-0.06)">
            <path d="M2054 3585 
              c-80 -17 -136 -46 -195 -102 l-49 -46 -58 26 
              c-83 38 -154 50 -245 44 
              -147 -10 -283 -101 -321 -214 
              -9 -26 -16 -57 -16 -70 
              0 -21 -4 -23 -48 -23 
              -154 0 -290 -98 -338 -242 
              -16 -50 -16 -160 1 -214 
              6 -19 1 -24 -32 -34 
              -87 -29 -148 -85 -190 -175 
              -67 -145 -26 -340 96 -459 
              l40 -39 -49 -54 
              c-65 -71 -95 -162 -88 -262 
              11 -143 86 -240 248 -317 
              52 -25 104 -50 114 -56 
              17 -9 18 -7 12 14 
              -51 175 -60 285 -28 347 
              9 19 22 36 28 38 
              6 2 21 -48 37 -125 
              30 -146 88 -330 109 -344 
              15 -10 97 -1 114 13 
              8 7 7 30 -3 87 
              -9 42 -16 131 -17 197 
              l-1 120 50 105 
              c50 105 50 105 51 212 
              1 102 2 108 31 145 
              16 21 39 55 52 75 
              17 29 30 39 59 43 
              20 4 59 13 85 21 
              44 14 52 13 115 -7 
              45 -14 105 -23 184 -26 
              104 -5 125 -3 205 20 
              48 14 126 35 171 46 
              91 23 199 73 275 128 
              l49 34 74 -36 
              c44 -22 105 -42 149 -50 
              124 -21 145 -53 154 -235 
              7 -132 11 -145 86 -280 
              39 -70 52 -184 37 -323 
              -7 -62 -19 -140 -27 -173 
              -16 -70 -10 -82 55 -94 
              49 -9 66 3 98 67 
              37 73 102 295 102 347 
              0 14 4 26 8 26 
              33 0 43 -163 17 -260 
              -8 -30 -15 -56 -15 -57 
              0 -4 76 11 80 16 
              3 3 27 16 53 29 
              211 99 280 384 137 564 
              -17 20 -30 40 -30 43 
              0 4 11 21 24 38 
              13 18 34 61 46 97 
              51 152 -6 326 -139 421 
              l-56 40 -1 77 
              c-1 151 -89 266 -228 297 
              l-50 11 -13 65 
              c-41 204 -198 338 -398 339 
              -44 0 -87 -9 -170 -34 
              -15 -5 -25 2 -42 27 
              -33 52 -131 113 -212 131 
              -82 19 -105 19 -187 1z" 
            />
          </g>
        );
      case "messy":
        return (
          <g>
            <g
              transform="translate(27,220) scale(0.035,-0.035)"
              fill={hairColor}
              stroke="black"
              strokeWidth="90"
            >
              <path d="M2918 5295 c3 -5 23 -33 44 -61 21 -28 38 -53 38 -56 0 -3 -84 -8
        -187 -11 -182 -7 -354 -29 -485 -62 -77 -21 -216 -68 -251 -87 l-29 -14 91
        -45 c50 -24 90 -46 90 -49 0 -3 -26 -17 -57 -32 -135 -64 -271 -172 -376 -298
        -162 -193 -267 -439 -301 -700 -14 -108 -8 -133 33 -148 l29 -10 7 -128 c13
        -253 72 -601 119 -706 9 -21 17 -44 17 -52 0 -9 13 -22 30 -31 16 -8 37 -26
        46 -40 9 -13 25 -27 36 -31 11 -3 37 -21 57 -39 38 -34 81 -53 81 -36 0 49 24
        340 36 430 44 346 133 598 255 723 31 32 73 65 92 73 25 10 99 16 273 20 463
        11 718 37 1019 104 72 16 131 28 133 26 1 -1 -30 -39 -69 -84 -39 -46 -68 -85
        -65 -89 4 -3 63 0 132 7 167 16 324 61 474 134 83 41 88 42 185 42 94 0 105
        -2 170 -34 75 -37 176 -126 227 -199 119 -172 196 -427 243 -797 6 -48 25
        -290 25 -317 0 -28 28 -16 110 43 69 51 89 80 109 159 6 25 23 88 36 140 37
        142 67 340 81 533 5 82 7 87 29 87 43 0 49 20 41 164 -10 214 -50 381 -131
        551 -109 227 -283 351 -546 388 -82 12 -82 12 -95 49 -34 99 -136 217 -251
        292 -134 87 -245 121 -505 155 -231 31 -1054 59 -1040 36z" />
            </g>
          </g>
        );
      case "wavy":
      return (
        <path
          d="M90 60 
             Q110 40 150 45 
             Q190 40 210 60 
             Q220 80 215 100 
             Q210 115 200 120 
             Q195 100 195 85 
             Q195 70 180 65 
             Q165 60 150 62 
             Q135 60 120 65 
             Q105 70 105 85 
             Q105 100 100 120 
             Q90 115 85 100 
             Q80 80 90 60 
             Z"
          fill={hairColor}
          stroke="#000"
          strokeWidth="3"
        />
      );
      case "buzz":
      return (
        <g>
          {/* Ciocca sinistra abbassata con punta più verso l'interno */}
          <path
            d="
              M90 80 
              Q80 110 90 140 
              Q95 130 100 110 
              Q95 90 90 80 
              Z
            "
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />

          {/* Ciocca destra abbassata con punta più verso l'interno */}
          <path
            d="
              M210 80 
              Q220 110 210 140 
              Q205 130 200 110 
              Q205 90 210 80 
              Z
            "
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        </g>
      );
      case "pelo":
      return (
        <path
          d="M100 80 Q150 50 200 80 Q200 50 150 40 Q100 50 100 80 Z"
          fill={hairColor}
          stroke="#000"
          strokeWidth="3"
        />
      );
      default:
        return null;
    }
  };

  const renderMustache = () => {
    switch (avatarConfig.mustacheStyle) {
      case "classic":
        return (
          <g transform="translate(111, 193) scale(0.025,-0.018)" fill={avatarConfig.mustacheColor}>
            <path
              d="M1410 2042 c0 -7 -12 -10 -30 -8 -16 2 -30 -1 -30 -5 0 -5 -14 -7
        -31 -4 -17 3 -28 2 -25 -3 2 -4 1 -14 -5 -22 -7 -12 -9 -9 -9 9 0 22 -1 23
        -17 9 -10 -9 -24 -13 -32 -10 -8 3 -11 0 -7 -7 5 -7 1 -9 -8 -5 -9 3 -16 1
        -16 -6 0 -6 -4 -9 -9 -5 -5 3 -12 -3 -14 -12 -4 -16 -5 -16 -6 1 -1 14 -4 16
        -14 8 -7 -6 -24 -13 -37 -16 -14 -2 -49 -16 -78 -31 -29 -14 -57 -23 -61 -20
        -5 3 -12 -2 -15 -11 -4 -10 -14 -14 -26 -11 -14 4 -20 0 -20 -13 0 -10 -9 -20
        -20 -23 -11 -3 -20 0 -20 5 0 6 -11 -1 -25 -17 -17 -18 -33 -25 -45 -22 -11 3
        -20 1 -20 -4 0 -4 -6 -6 -14 -3 -9 3 -17 -3 -21 -15 -3 -12 -10 -19 -15 -16
        -5 3 -11 -1 -14 -7 -5 -10 -7 -10 -12 -1 -8 17 -33 -7 -27 -25 4 -8 0 -10 -11
        -6 -16 6 -112 -21 -134 -39 -7 -6 -35 -21 -63 -33 -28 -13 -48 -28 -45 -33 3
        -5 -2 -15 -11 -22 -14 -12 -16 -12 -9 0 6 9 5 12 -5 9 -8 -3 -13 -11 -11 -17
        1 -7 -2 -10 -7 -6 -6 3 -17 -7 -25 -22 -7 -16 -24 -37 -36 -48 -25 -22 -49
        -62 -31 -51 7 5 9 1 5 -8 -3 -9 -9 -14 -13 -12 -4 3 -7 -3 -8 -12 0 -9 -4 -44
        -8 -77 -5 -44 -4 -56 4 -45 9 12 11 11 11 -8 0 -13 4 -21 9 -18 5 4 12 0 14
        -6 4 -10 6 -10 6 0 1 19 19 14 26 -8 8 -26 22 -25 31 3 7 20 8 20 20 -13 7
        -19 13 -30 13 -25 1 13 61 14 61 1 0 -5 6 -3 14 3 11 9 15 9 19 -1 4 -10 6
        -10 6 0 1 10 5 10 17 -2 11 -11 21 -13 32 -7 11 6 24 6 35 0 11 -7 17 -6 17 1
        0 5 7 10 15 10 8 0 15 -5 15 -12 0 -6 3 -8 7 -5 3 4 12 2 19 -4 11 -9 16 -6
        23 12 6 14 10 18 11 9 1 -10 4 -9 10 5 7 17 9 17 9 3 1 -10 8 -18 16 -18 8 0
        15 -5 15 -11 0 -6 14 -1 30 11 28 20 30 20 30 3 0 -14 2 -15 9 -4 5 8 11 9 15
        3 8 -13 35 -9 46 7 5 9 9 10 14 2 4 -6 12 -9 17 -6 5 4 9 0 9 -7 0 -9 3 -9 10
        2 8 13 10 13 10 1 0 -11 4 -9 15 5 14 19 14 19 15 -1 1 -11 4 -14 7 -7 2 6 10
        9 16 5 18 -11 50 -11 70 -1 11 5 17 5 17 -2 0 -17 28 -11 39 8 10 16 10 16 11
        -1 0 -11 4 -15 12 -11 6 4 17 -1 25 -11 12 -18 13 -17 13 6 0 13 4 30 9 38 7
        11 10 9 15 -7 4 -13 13 -19 22 -15 8 3 14 -1 14 -8 1 -10 5 -8 14 4 12 16 17
        16 35 5 12 -7 21 -16 21 -20 0 -5 5 -8 10 -8 6 0 10 8 10 18 0 13 2 14 9 3 6
        -10 11 -6 19 15 10 29 10 29 12 4 1 -14 4 -19 7 -12 7 17 23 15 23 -4 0 -32
        25 -6 31 32 6 36 6 36 8 8 1 -37 20 -57 41 -44 9 6 17 5 22 -3 4 -7 8 8 9 33
        l1 45 12 -45 c10 -37 13 -41 20 -25 6 16 9 17 16 5 7 -12 11 -10 19 10 l10 25
        1 -25 c1 -23 2 -23 10 -5 6 13 9 15 9 5 1 -22 71 -23 72 -1 0 12 2 11 8 -4 8
        -19 8 -19 19 0 11 19 11 19 12 -5 0 -14 4 -20 8 -15 4 6 14 10 22 10 8 0 18
        -4 22 -10 4 -6 8 -1 8 9 0 20 0 20 14 1 14 -19 15 -19 27 7 13 31 29 28 29 -5
        0 -18 2 -19 10 -7 8 12 10 12 16 -4 5 -14 9 -15 15 -4 7 11 11 10 19 -2 8 -12
        10 -11 10 8 0 22 20 32 20 10 0 -9 4 -8 10 2 8 12 10 10 10 -9 0 -18 3 -21 13
        -12 8 6 17 8 20 4 4 -3 7 5 7 18 0 19 2 21 10 9 8 -12 10 -12 11 5 0 13 5 9
        13 -14 8 -23 15 -31 20 -23 4 7 11 10 16 7 5 -3 13 3 19 12 9 16 10 15 11 -7
        0 -14 4 -20 8 -15 10 14 42 18 42 5 0 -6 5 -8 13 -3 6 4 20 6 30 5 9 -2 17 3
        17 10 0 10 3 9 10 -2 9 -13 12 -12 25 4 14 19 15 18 24 -5 7 -18 10 -20 15 -9
        8 20 56 23 56 4 0 -12 4 -12 20 -4 11 6 25 8 30 5 6 -3 10 2 10 12 0 12 3 14
        8 6 10 -16 72 -27 72 -13 0 6 5 8 10 5 6 -3 10 -1 10 4 0 6 7 11 15 11 8 0 15 -6 15 -12
        0 -8 3 -9 8 -3 10 14 62 15 62 1 0 -6 5 -4 10 4 5 8 10 11 10 6 0 -5 8 -2 17
        5 11 10 14 10 9 1 -4 -6 -3 -12 3 -12 5 0 13 4 16 10 3 5 22 8 40 5 30 -3 37
        0 48 22 l14 26 7 -28 7 -28 16 22 c11 16 14 35 10 64 -4 29 -3 36 3 22 5 -11
        9 -32 9 -47 1 -30 21 -40 21 -10 0 14 2 15 10 2 8 -12 10 -10 10 8 0 15 4 21
        12 16 12 -8 7 53 -8 90 -5 14 -4 17 4 12 8 -5 10 -2 6 8 -3 9 -10 16 -16 16
        -5 0 -6 5 -3 10 4 6 -1 23 -11 38 -10 15 -17 32 -15 37 1 6 -1 7 -5 2 -9 -9
        -44 21 -44 38 0 16 -36 40 -72 49 -15 3 -32 15 -38 26 -10 18 -86 60 -108 60
        -5 0 -22 6 -37 14 -15 8 -38 12 -50 10 -13 -2 -27 0 -30 6 -3 5 -1 10 4 10 6
        0 11 5 11 11 0 5 -5 7 -11 3 -6 -3 -15 0 -20 7 -8 12 -10 12 -18 0 -6 -9 -11
        -10 -15 -2 -4 6 -4 11 0 11 3 0 1 6 -5 14 -7 8 -21 12 -33 8 -16 -4 -19 -2
        -13 8 6 10 4 12 -10 7 -11 -5 -24 0 -36 14 -11 12 -19 19 -19 15 0 -4 -6 -1
        -14 7 -9 8 -26 12 -40 10 -26 -5 -37 11 -13 20 7 3 5 6 -6 6 -34 2 -97 26 -97
        37 0 7 -8 10 -20 7 -11 -3 -20 -1 -20 5 0 5 -7 13 -16 16 -8 3 -12 2 -9 -4 9
        -15 -2 -12 -19 6 -9 8 -16 11 -16 5 0 -6 -7 -11 -15 -11 -9 0 -12 6 -8 17 4
        10 2 14 -5 9 -6 -3 -14 -1 -17 5 -4 5 -13 8 -21 5 -8 -3 -14 -1 -14 5 0 5 -11
        7 -25 3 -17 -4 -27 -1 -31 9 -3 9 -13 13 -25 10 -11 -3 -19 0 -19 7 0 10 -3
        10 -14 1 -16 -14 -47 -11 -59 4 -6 6 -10 6 -14 -2 -7 -18 -26 -16 -19 2 3 8 3
        15 0 15 -2 0 -9 -10 -14 -22 l-9 -23 0 23 c-1 22 -2 22 -27 6 -21 -14 -27 -15
        -34 -4 -6 10 -9 7 -12 -11 l-5 -24 -11 25 c-6 14 -11 19 -11 12 -1 -7 -5 -11
        -10 -7 -5 3 -13 0 -17 -6 -4 -8 -9 -7 -15 2 -6 10 -9 7 -9 -11 -1 -25 -1 -25
        -13 -4 -8 14 -20 20 -34 18 -14 -2 -23 1 -23 9 0 8 -4 7 -10 -3 -9 -13 -11
        -13 -20 0 -8 12 -10 12 -10 1 0 -11 -3 -11 -15 -1 -8 7 -15 9 -15 5 0 -4 -7
        -2 -15 5 -12 10 -15 9 -15 -6 -1 -18 -1 -18 -15 0 -8 11 -15 15 -15 8z m515
        -42 c3 -5 1 -10 -4 -10 -6 0 -11 5 -11 10 0 6 2 10 4 10 3 0 8 -4 11 -10z
        m-1595 -667 c-11 -17 -11 -17 -6 0 3 10 6 24 7 30 0 9 2 9 5 0 3 -7 0 -20 -6
        -30z m1467 -15 c-3 -8 -6 -5 -6 6 -1 11 2 17 5 13 3 -3 4 -12 1 -19z"
              stroke="#000000"
              strokeWidth="100"
              strokeLinecap="round"
            />
          </g>
        );
      case "thick":
      return (
        <g transform="translate(105, 210) scale(0.04,-0.03)" fill={avatarConfig.mustacheColor}>
          <path
            d="
              M930 1921 c-14 -4 -37 -6 -52 -5 -16 2 -28 -2 -28 -7 0 -6 -4 -8 -9
              -5 -12 8 -71 -14 -71 -26 0 -5 -5 -6 -11 -2 -6 3 -24 -3 -40 -15 -15 -11 -33
              -21 -38 -21 -22 0 -130 -83 -211 -162 -84 -82 -177 -201 -172 -219 1 -5 -5
              -24 -14 -41 -9 -17 -17 -43 -19 -57 -1 -14 -10 -68 -18 -120 -9 -52 -14 -97
              -12 -102 3 -4 10 -43 15 -86 13 -113 32 -192 40 -168 5 14 12 -2 25 -54 11
              -46 21 -68 26 -60 5 9 10 5 14 -13 9 -37 76 -142 130 -204 61 -72 204 -196
              215 -189 5 3 24 -2 42 -11 l33 -17 -19 22 c-17 18 -17 21 -3 15 28 -10 20 11
              -26 68 -70 86 -177 281 -163 296 3 2 -3 21 -13 41 -30 59 -39 120 -37 241 1
              94 5 123 23 160 24 51 84 120 106 124 8 1 21 6 28 12 35 24 79 44 79 35 0 -6
              15 -4 35 5 20 8 70 16 113 17 42 1 83 6 90 10 6 5 12 4 12 -1 0 -5 23 -6 53
              -2 62 8 159 6 175 -4 7 -4 12 -2 12 5 0 8 4 8 15 -1 11 -9 15 -9 15 -1 0 7 5
              9 13 4 6 -4 32 -8 57 -9 25 -1 45 -3 45 -4 0 -1 15 -3 34 -6 19 -2 40 -9 48
              -16 11 -9 12 -7 6 8 -6 16 -3 15 25 -5 18 -12 36 -20 40 -17 5 3 16 -4 25 -15
              10 -11 22 -17 27 -14 6 3 10 1 10 -4 0 -6 6 -11 13 -11 6 0 22 -11 33 -23 60
              -63 90 -164 79 -266 -4 -36 -8 -88 -9 -115 -1 -28 -7 -51 -14 -54 -7 -2 -10
              -8 -7 -13 3 -4 -1 -22 -10 -40 -9 -17 -14 -33 -11 -36 3 -3 -18 -51 -46 -107
              -48 -94 -83 -150 -147 -235 -22 -29 -23 -34 -7 -28 17 7 17 6 5 -10 -13 -15
              -12 -16 11 -9 14 4 33 8 43 9 21 2 188 154 244 222 22 28 55 77 73 110 17 33
              35 59 40 58 4 -1 16 27 25 62 10 35 21 62 25 60 10 -6 18 16 35 95 22 105 27
              209 15 285 -7 39 -13 84 -14 100 -2 17 -11 46 -21 65 -11 19 -20 41 -21 47 -4
              20 -86 133 -129 177 -37 39 -83 79 -151 134 -74 59 -242 140 -258 125 -3 -4
              -6 -1 -6 7 0 10 -3 10 -15 0 -9 -7 -15 -8 -15 -2 0 13 -69 21 -74 7 -3 -6 -9
              -4 -15 5 -9 12 -14 13 -31 2 -16 -10 -20 -10 -20 0 0 8 -3 9 -8 3 -4 -5 -20
              -11 -37 -13 -16 -2 -34 -7 -40 -12 -5 -4 -21 -3 -35 3 -14 5 -34 11 -45 13
              -11 1 -38 4 -60 7 -22 3 -51 2 -65 -2z m1017 -1023 c-3 -8 -6 -5 -6 6 -1 11 2
              17 5 13 3 -3 4 -12 1 -19z"
            stroke="#000000"
            strokeWidth="70"
            strokeLinecap="round"
          />
        </g>
      );
      case "handlebar":
        return (
          <svg width="200" height="200" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(260, 515) scale(0.07,-0.07)" fill={avatarConfig.mustacheColor} stroke="none">
              <path
                d="
                  M1260 2051
                  c-48 -15 -106 -50 -245 -148
                  -184 -130 -249 -170 -382 -236
                  -173 -87 -394 -156 -543 -169
                  -33 -3 -30 -5 40 -31
                  105 -38 289 -83 395 -96
                  131 -16 389 -14 514 5
                  233 34 403 95 555 199
                  l67 45 47 -36
                  c104 -80 325 -165 517 -200
                  79 -15 151 -19 340 -19
                  212 0 254 3 354 23
                  110 22 317 85 334 101
                  5 5 -20 11 -55 15
                  -260 29 -552 162 -912 415
                  -177 125 -201 136 -306 136
                  -99 0 -172 -21 -258 -73
                  l-57 -34 -75 40
                  c-116 63 -248 88 -330 63 Z
                "
                fill={avatarConfig.mustacheColor}
                stroke="#000000"
                strokeWidth="50"
                strokeLinecap="round"
              />
            </g>
          </svg>
        );
      default:
        return null;
    }
  };

  const renderBeard = () => {
    switch (avatarConfig.beardStyle) {
      case "goatee":
        return (
          <ellipse
            cx="150"
            cy="190"
            rx="8"
            ry="12"
            fill={avatarConfig.beardColor}
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "full":
        return (
          <path
            d="M100 170 Q150 200 200 170 Q200 200 150 210 Q100 200 100 170 Z"
            fill={avatarConfig.beardColor}
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "stubble":
        return (
          <ellipse
            cx="150"
            cy="180"     // abbassata (da 170 a 180)
            rx="49"      // allargata (da 25 a 35)
            ry="22"
            fill={avatarConfig.beardColor}
            opacity="0.3"
          />
        );
      default:
        return null;
    }
  };

  const renderGlasses = () => {
    switch (avatarConfig.glassesStyle) {
      case "round":
        return (
          <g transform="translate(-50,-40) scale(1.3,1.3)">
            {/* Lente sinistra */}
            <circle cx="125" cy="125" r="12" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Lente destra */}
            <circle cx="175" cy="125" r="12" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Ponte centrale */}
            <path d="M137 125 L163 125" stroke="#333" strokeWidth="2"/>
            {/* Stanghette sinistra */}
            <path d="M105 125 L112 125" stroke="#333" strokeWidth="2"/>
            {/* Stanghetta destra */}
            <path d="M188 125 L195 125" stroke="#333" strokeWidth="2"/>
          </g>
        );
      case "square":
        return (
          <g transform="translate(-50,-40) scale(1.3,1.3)">
            {/* Lente sinistra */}
            <rect x="113" y="113" width="24" height="24" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Lente destra */}
            <rect x="163" y="113" width="24" height="24" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Ponte centrale */}
            <path d="M137 125 L163 125" stroke="#333" strokeWidth="2"/>
            {/* Stanghette sinistra */}
            <path d="M105 125 L112 125" stroke="#333" strokeWidth="2"/>
            {/* Stanghetta destra */}
            <path d="M188 125 L195 125" stroke="#333" strokeWidth="2"/>
          </g>
        );
      case "aviator":
        return (
          <g transform="translate(-50,-40) scale(1.3,1.3)">
            {/* Lente sinistra - forma aviator con parte superiore piatta */}
            <path d="M110 113 L140 113 Q140 137 125 147 Q110 137 110 113 Z" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Lente destra - forma aviator con parte superiore piatta */}
            <path d="M160 113 L190 113 Q190 137 175 147 Q160 137 160 113 Z" fill="none" stroke="#333" strokeWidth="2"/>
            {/* Ponte centrale */}
            <path d="M137 125 L163 125" stroke="#333" strokeWidth="2"/>
            {/* Stanghette sinistra */}
            <path d="M105 125 L112 125" stroke="#333" strokeWidth="2"/>
            {/* Stanghetta destra */}
            <path d="M188 125 L195 125" stroke="#333" strokeWidth="2"/>
          </g>
        );
      default:
        return null;
    }
  };

  const renderNose = () => {
    switch (avatarConfig.noseStyle) {
      case "small":
        return <path d="M 148 135 Q 150 138 152 135" stroke="#000" strokeWidth="2" fill="none" />;
      case "large":
        return <path d="M 145 132 Q 150 142 155 132" stroke="#000" strokeWidth="3" fill="none" />;
      case "pointed":
        return <path d="M 148 133 L 150 140 L 152 133" stroke="#000" strokeWidth="2" fill="none" />;
      case "button":
        return <circle cx="150" cy="135" r="3" fill={avatarConfig.skinColor} stroke="#000" strokeWidth="2" />;
      default: // normal
        return <path d="M 145 135 Q 150 140 155 135" stroke="#000" strokeWidth="3" fill="none" />;
    }
  };

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 300 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* Mascheramento circolare per nascondere gli angoli dell'avatar */}
        <defs>
          <clipPath id="circleClip">
            <circle cx="150" cy="150" r="145"/>
          </clipPath>
        </defs>
        
        {/* Cerchio azzurro di sfondo */}
        <circle cx="150" cy="150" r="145" fill="#38BDF8"/>
        
        {/* Applico il clipping circolare a tutto l'avatar */}
        <g clipPath="url(#circleClip)">
          {/* Orecchie (dietro) */}
          <ellipse cx="90" cy="130" rx="15" ry="22" fill={avatarConfig.skinColor} />
          <ellipse cx="210" cy="130" rx="15" ry="22" fill={avatarConfig.skinColor} />
          
          {/* Collo trapezoidale (dietro) */}
          <path
            d="M130 195 L170 195 L180 225 L120 225 Z"
            fill={avatarConfig.skinColor}
            stroke="#000"
            strokeWidth="3"
          />
          
          {/* Spalle con braccia ancora più in alto */}
          <ellipse
            cx="150"
            cy="249"
            rx="122"
            ry="40"
            fill={avatarConfig.suitColor}
            stroke="#000"
            strokeWidth="3"
          />
          
          {/* Giacca con forma migliorata */}
          <path
            d="M60 220 Q120 210 150 210 Q180 210 240 220 L240 300 L60 300 Z"
            fill={avatarConfig.suitColor}
            stroke="#000"
            strokeWidth="3"
          />
          
          {/* Lapels della giacca */}
          <path
            d="M105 225 L125 240 L135 210 L115 210 Z"
            fill={avatarConfig.suitColor}
            stroke="#000"
            strokeWidth="3"
          />
          <path
            d="M195 225 L175 240 L165 210 L185 210 Z"
            fill={avatarConfig.suitColor}
            stroke="#000"
            strokeWidth="3"
          />
          
          {/* Camicia */}
          <path
            d="M130 210 Q140 205 150 205 Q160 205 170 210 L170 300 L130 300 Z"
            fill="#FFFFFF"
            stroke="#000"
            strokeWidth="3"
          />
          
          {/* Colletto della camicia */}
          <path
            d="M135 210 L145 200 L150 215 L155 200 L165 210"
            fill="#FFFFFF"
            stroke="#000"
            strokeWidth="3"
          />
          
          {/* Nodo cravatta */}
          <ellipse
            cx="150"
            cy="220"
            rx="10"
            ry="8"
            fill={avatarConfig.tieColor}
            stroke="#000"
            strokeWidth="3"
          />
          
          {/* Cravatta */}
          <path
            d="M140 227 L160 227 L158 275 L150 285 L142 275 Z"
            fill={avatarConfig.tieColor}
            stroke="#000"
            strokeWidth="3"
          />
          
          {/* Testa più larga e allungata */}
          <path
            d="M90 130 Q90 60 150 55 Q210 60 210 130 Q210 200 150 205 Q90 200 90 130 Z"
            fill={avatarConfig.skinColor}
            stroke="#000"
            strokeWidth="4"
           />
          
          {/* Capelli */}
          {renderHair()}
          
          {/* Occhi */}
          <ellipse cx="125" cy="125" rx="6" ry="9" fill="#000" />
          <ellipse cx="175" cy="125" rx="6" ry="9" fill="#000" />
          
          {/* Naso */}
          {renderNose()}
          
          {/* Bocca */}
          <path d="M 135 165 Q 150 175 165 165" stroke="#000" strokeWidth="3" fill="none" />
          
          {/* Baffi */}
          {renderMustache()}
          
          {/* Barba */}
          {renderBeard()}

          {/* Occhiali */}
          {renderGlasses()}
        </g>
      </svg>
    </div>
  );
}