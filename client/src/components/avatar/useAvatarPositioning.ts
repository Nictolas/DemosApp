import { useMemo } from "react";

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
  glassesColor: string;
}

export function useAvatarPositioning() {
  // Funzione per scurire i colori
  const darkenColor = useMemo(() => (hexColor: string, amount: number = 20) => {
    let color = hexColor.replace("#", "");
    if (color.length === 3) {
      color = color.split("").map((c: string) => c + c).join("");
    }

    const num = parseInt(color, 16);
    let r = (num >> 16) & 0xFF;
    let g = (num >> 8) & 0xFF;
    let b = num & 0xFF;

    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);

    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }, []);

  // Coordinate per gli elementi dell'avatar
  const positions = useMemo(() => ({
    // Testa
    head: {
      x: 150,
      y: 130,
      width: 120,
      height: 150
    },
    // Occhi
    eyes: {
      left: { x: 125, y: 125, rx: 6, ry: 9 },
      right: { x: 175, y: 125, rx: 6, ry: 9 }
    },
    // Naso
    nose: {
      x: 150,
      y: 135,
      width: 10
    },
    // Bocca
    mouth: {
      x: 150,
      y: 165,
      width: 30
    },
    // Orecchie
    ears: {
      left: { x: 90, y: 130, rx: 15, ry: 22 },
      right: { x: 210, y: 130, rx: 15, ry: 22 }
    },
    // Collo
    neck: {
      x: 150,
      y: 195,
      width: 50,
      height: 30
    },
    // Spalle
    shoulders: {
      x: 150,
      y: 225,
      width: 120,
      height: 40
    },
    // Giacca
    jacket: {
      x: 150,
      y: 210,
      width: 180,
      height: 80
    },
    // Cravatta
    tie: {
      knot: { x: 150, y: 220, rx: 10, ry: 8 },
      body: { x: 150, y: 250, width: 20, height: 60 }
    }
  }), []);

  // Stili predefiniti per l'avatar
  const defaultStyles = useMemo(() => ({
    skinColor: "#FDBCB4",
    hairColor: "#8B4513",
    suitColor: "#2C3E50",
    tieColor: "#E74C3C",
    glassesColor: "#333333"
  }), []);

  return {
    darkenColor,
    positions,
    defaultStyles
  };
}
