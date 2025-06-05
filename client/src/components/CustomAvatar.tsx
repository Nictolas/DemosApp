interface AvatarConfig {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  mustacheStyle: string;
  beardStyle: string;
  noseStyle: string;
  suitColor: string;
  tieColor: string;
}

interface CustomAvatarProps {
  config: AvatarConfig | null;
  size?: number;
  className?: string;
}

const defaultConfig: AvatarConfig = {
  skinColor: "#FDBCB4",
  hairColor: "#8B4513",
  hairStyle: "short",
  mustacheStyle: "none",
  beardStyle: "none",
  noseStyle: "normal",
  suitColor: "#2C3E50",
  tieColor: "#E74C3C"
};

export function CustomAvatar({ config, size = 100, className = "" }: CustomAvatarProps) {
  const avatarConfig = config || defaultConfig;

  const renderHair = () => {
    const hairColor = avatarConfig.hairColor;
    
    switch (avatarConfig.hairStyle) {
      case "bald":
        return null;
      case "short":
        return (
          <path
            d="M95 85 Q150 65 205 85 Q205 100 150 95 Q95 100 95 85 Z"
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        );
      case "long":
        return (
          <g>
            <path
              d="M85 80 Q150 65 215 80 Q220 120 200 150 Q180 160 150 155 Q120 160 100 150 Q80 120 85 80 Z"
              fill={hairColor}
              stroke="#000"
              strokeWidth="3"
            />
          </g>
        );
      case "curly":
        return (
          <g>
            <circle cx="120" cy="75" r="12" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="150" cy="70" r="15" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="180" cy="75" r="12" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="110" cy="90" r="10" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="190" cy="90" r="10" fill={hairColor} stroke="#000" strokeWidth="2" />
          </g>
        );
      case "messy":
        return (
          <path
            d="M90 90 Q110 65 130 80 Q140 60 150 75 Q160 55 170 80 Q180 70 200 85 Q190 100 150 95 Q110 100 90 90 Z"
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        );
      case "wavy":
        return (
          <path
            d="M95 85 Q120 70 150 75 Q180 70 205 85 Q200 105 150 100 Q100 105 95 85 Z"
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        );
      case "buzz":
        return (
          <path
            d="M100 85 Q150 75 200 85 Q195 95 150 93 Q105 95 100 85 Z"
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
          <ellipse
            cx="150"
            cy="140"
            rx="12"
            ry="4"
            fill="#2C1810"
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "thick":
        return (
          <ellipse
            cx="150"
            cy="140"
            rx="15"
            ry="6"
            fill="#2C1810"
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "handlebar":
        return (
          <g>
            <ellipse cx="150" cy="140" rx="10" ry="3" fill="#2C1810" />
            <circle cx="135" cy="138" r="4" fill="#2C1810" />
            <circle cx="165" cy="138" r="4" fill="#2C1810" />
          </g>
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
            cy="165"
            rx="8"
            ry="12"
            fill="#2C1810"
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "full":
        return (
          <path
            d="M110 150 Q150 170 190 150 Q190 175 150 180 Q110 175 110 150 Z"
            fill="#2C1810"
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "stubble":
        return (
          <ellipse
            cx="150"
            cy="160"
            rx="25"
            ry="8"
            fill="#2C1810"
            opacity="0.3"
          />
        );
      default:
        return null;
    }
  };

  const renderNose = () => {
    switch (avatarConfig.noseStyle) {
      case "small":
        return <path d="M 148 125 Q 150 128 152 125" stroke="#000" strokeWidth="2" fill="none" />;
      case "large":
        return <path d="M 145 122 Q 150 132 155 122" stroke="#000" strokeWidth="3" fill="none" />;
      case "pointed":
        return <path d="M 148 123 L 150 130 L 152 123" stroke="#000" strokeWidth="2" fill="none" />;
      case "button":
        return <circle cx="150" cy="125" r="3" fill={avatarConfig.skinColor} stroke="#000" strokeWidth="2" />;
      default: // normal
        return <path d="M 145 125 Q 150 130 155 125" stroke="#000" strokeWidth="3" fill="none" />;
    }
  };

  return (
    <div className={`inline-block ${className}`}>
      <svg width={size} height={size} viewBox="0 0 300 300" className="rounded-full overflow-hidden">
        {/* Sfondo */}
        <rect width="300" height="300" fill="#F5F5F5" />
        
        {/* Orecchie (dietro) */}
        <ellipse cx="95" cy="130" rx="15" ry="22" fill={avatarConfig.skinColor} stroke="#000" strokeWidth="3" />
        <ellipse cx="205" cy="130" rx="15" ry="22" fill={avatarConfig.skinColor} stroke="#000" strokeWidth="3" />
        
        {/* Collo trapezoidale (dietro) */}
        <path
          d="M135 195 L165 195 L175 225 L125 225 Z"
          fill={avatarConfig.skinColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Spalle con braccia più in alto */}
        <ellipse
          cx="150"
          cy="270"
          rx="110"
          ry="40"
          fill={avatarConfig.suitColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Giacca con forma migliorata */}
        <path
          d="M60 230 Q120 220 150 220 Q180 220 240 230 L240 300 L60 300 Z"
          fill={avatarConfig.suitColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Lapels della giacca */}
        <path
          d="M105 235 L125 250 L135 220 L115 220 Z"
          fill={avatarConfig.suitColor}
          stroke="#000"
          strokeWidth="3"
        />
        <path
          d="M195 235 L175 250 L165 220 L185 220 Z"
          fill={avatarConfig.suitColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Camicia */}
        <path
          d="M130 220 Q140 215 150 215 Q160 215 170 220 L170 300 L130 300 Z"
          fill="#FFFFFF"
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Colletto della camicia */}
        <path
          d="M135 220 L145 210 L150 225 L155 210 L165 220"
          fill="#FFFFFF"
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Nodo cravatta */}
        <ellipse
          cx="150"
          cy="230"
          rx="10"
          ry="8"
          fill={avatarConfig.tieColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Cravatta */}
        <path
          d="M140 237 L160 237 L158 285 L150 295 L142 285 Z"
          fill={avatarConfig.tieColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Testa più alta e allungata (schiacciata sopra e sotto) */}
        <path
          d="M100 130 Q100 60 150 55 Q200 60 200 130 Q200 200 150 205 Q100 200 100 130 Z"
          fill={avatarConfig.skinColor}
          stroke="#000"
          strokeWidth="4"
        />
        
        {/* Capelli */}
        {renderHair()}
        
        {/* Occhi */}
        <ellipse cx="125" cy="115" rx="6" ry="9" fill="#000" />
        <ellipse cx="175" cy="115" rx="6" ry="9" fill="#000" />
        
        {/* Naso */}
        {renderNose()}
        
        {/* Bocca */}
        <path d="M 135 155 Q 150 165 165 155" stroke="#000" strokeWidth="3" fill="none" />
        
        {/* Baffi */}
        {renderMustache()}
        
        {/* Barba */}
        {renderBeard()}
      </svg>
    </div>
  );
}