interface AvatarConfig {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  mustache: boolean;
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
  mustache: false,
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
            d="M95 85 Q150 60 205 85 Q205 100 150 95 Q95 100 95 85 Z"
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        );
      case "long":
        return (
          <g>
            <path
              d="M85 80 Q150 50 215 80 Q220 120 200 150 Q180 160 150 155 Q120 160 100 150 Q80 120 85 80 Z"
              fill={hairColor}
              stroke="#000"
              strokeWidth="3"
            />
          </g>
        );
      case "curly":
        return (
          <g>
            <circle cx="120" cy="80" r="15" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="150" cy="70" r="18" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="180" cy="80" r="15" fill={hairColor} stroke="#000" strokeWidth="2" />
          </g>
        );
      case "messy":
        return (
          <path
            d="M90 90 Q110 60 130 80 Q140 55 150 75 Q160 50 170 80 Q180 65 200 85 Q190 100 150 95 Q110 100 90 90 Z"
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        );
      case "wavy":
        return (
          <path
            d="M95 85 Q120 65 150 75 Q180 65 205 85 Q200 105 150 100 Q100 105 95 85 Z"
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        );
      case "buzz":
        return (
          <path
            d="M100 90 Q150 75 200 90 Q195 100 150 98 Q105 100 100 90 Z"
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
    if (!avatarConfig.mustache) return null;
    
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
  };

  return (
    <div className={`inline-block ${className}`}>
      <svg width={size} height={size} viewBox="0 0 300 300" className="rounded-full overflow-hidden">
        {/* Sfondo */}
        <rect width="300" height="300" fill="#F5F5F5" />
        
        {/* Orecchie (dietro, senza bordo nero visibile) */}
        <ellipse cx="95" cy="125" rx="15" ry="22" fill={avatarConfig.skinColor} />
        <ellipse cx="205" cy="125" rx="15" ry="22" fill={avatarConfig.skinColor} />
        
        {/* Collo realistico */}
        <ellipse
          cx="150"
          cy="185"
          rx="30"
          ry="25"
          fill={avatarConfig.skinColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Spalle rotonde */}
        <ellipse
          cx="150"
          cy="275"
          rx="110"
          ry="40"
          fill={avatarConfig.suitColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Giacca con forma migliorata */}
        <path
          d="M60 235 Q120 225 150 225 Q180 225 240 235 L240 300 L60 300 Z"
          fill={avatarConfig.suitColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Lapels della giacca */}
        <path
          d="M105 240 L125 255 L135 225 L115 225 Z"
          fill={avatarConfig.suitColor}
          stroke="#000"
          strokeWidth="3"
        />
        <path
          d="M195 240 L175 255 L165 225 L185 225 Z"
          fill={avatarConfig.suitColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Camicia */}
        <path
          d="M130 225 Q140 220 150 220 Q160 220 170 225 L170 300 L130 300 Z"
          fill="#FFFFFF"
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Colletto della camicia */}
        <path
          d="M135 225 L145 215 L150 230 L155 215 L165 225"
          fill="#FFFFFF"
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Nodo cravatta */}
        <ellipse
          cx="150"
          cy="235"
          rx="10"
          ry="8"
          fill={avatarConfig.tieColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Cravatta */}
        <path
          d="M140 242 L160 242 L158 290 L150 300 L142 290 Z"
          fill={avatarConfig.tieColor}
          stroke="#000"
          strokeWidth="3"
        />
        
        {/* Testa ovale */}
        <ellipse
          cx="150"
          cy="125"
          rx="60"
          ry="70"
          fill={avatarConfig.skinColor}
          stroke="#000"
          strokeWidth="4"
        />
        
        {/* Capelli */}
        {renderHair()}
        
        {/* Occhi */}
        <ellipse cx="125" cy="110" rx="6" ry="9" fill="#000" />
        <ellipse cx="175" cy="110" rx="6" ry="9" fill="#000" />
        
        {/* Naso */}
        <path d="M 148 125 Q 150 130 152 125" stroke="#000" strokeWidth="3" fill="none" />
        
        {/* Bocca */}
        <path d="M 135 150 Q 150 160 165 150" stroke="#000" strokeWidth="3" fill="none" />
        
        {/* Baffi */}
        {renderMustache()}
      </svg>
    </div>
  );
}