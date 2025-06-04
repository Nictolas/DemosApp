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
  skinColor: "#E6B894",
  hairColor: "#8B4513",
  hairStyle: "bald",
  mustache: false,
  suitColor: "#2C3E50",
  tieColor: "#E74C3C"
};

export function CustomAvatar({ config, size = 100, className = "" }: CustomAvatarProps) {
  const avatarConfig = config || defaultConfig;

  const renderHair = () => {
    if (avatarConfig.hairStyle === "bald") return null;
    
    const hairPath = avatarConfig.hairStyle === "short" 
      ? "M85 45 Q50 35 115 45 Q150 35 215 45 Q215 60 200 70 Q100 70 85 60 Z"
      : "M75 40 Q50 30 125 40 Q150 30 225 40 Q225 80 200 90 Q100 90 75 80 Z";
    
    return (
      <path
        d={hairPath}
        fill={avatarConfig.hairColor}
        stroke="#000"
        strokeWidth="3"
      />
    );
  };

  const renderMustache = () => {
    if (!avatarConfig.mustache) return null;
    
    return (
      <ellipse
        cx="150"
        cy="130"
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
      <svg width={size} height={size * 1.33} viewBox="0 0 300 400">
        {/* Sfondo */}
        <rect width="300" height="400" fill="#F5F5F5" />
        
        {/* Capelli */}
        {renderHair()}
        
        {/* Testa */}
        <circle
          cx="150"
          cy="100"
          r="65"
          fill={avatarConfig.skinColor}
          stroke="#000"
          strokeWidth="4"
        />
        
        {/* Orecchie */}
        <circle cx="95" cy="100" r="12" fill={avatarConfig.skinColor} stroke="#000" strokeWidth="3" />
        <circle cx="205" cy="100" r="12" fill={avatarConfig.skinColor} stroke="#000" strokeWidth="3" />
        
        {/* Occhi */}
        <ellipse cx="125" cy="85" rx="6" ry="8" fill="#000" />
        <ellipse cx="175" cy="85" rx="6" ry="8" fill="#000" />
        
        {/* Naso */}
        <path d="M145 105 Q150 110 155 105" stroke="#000" strokeWidth="2" fill="none" />
        
        {/* Bocca */}
        <path d="M135 125 Q150 135 165 125" stroke="#000" strokeWidth="3" fill="none" />
        
        {/* Baffi */}
        {renderMustache()}
        
        {/* Collo */}
        <rect x="130" y="160" width="40" height="30" fill={avatarConfig.skinColor} stroke="#000" strokeWidth="3" />
        
        {/* Camicia */}
        <rect x="110" y="185" width="80" height="120" fill="#FFFFFF" stroke="#000" strokeWidth="3" />
        
        {/* Cravatta */}
        <polygon 
          points="140,185 160,185 155,250 145,250" 
          fill={avatarConfig.tieColor} 
          stroke="#000" 
          strokeWidth="2" 
        />
        
        {/* Giacca */}
        <path
          d="M80 200 L80 400 L220 400 L220 200 L200 185 L190 190 L190 200 L110 200 L110 190 L100 185 Z"
          fill={avatarConfig.suitColor}
          stroke="#000"
          strokeWidth="4"
        />
        
        {/* Risvolti giacca */}
        <path d="M100 185 L120 205 L120 240 L100 220 Z" fill={avatarConfig.suitColor} stroke="#000" strokeWidth="2" />
        <path d="M200 185 L180 205 L180 240 L200 220 Z" fill={avatarConfig.suitColor} stroke="#000" strokeWidth="2" />
        
        {/* Colletto camicia */}
        <path d="M120 185 L140 185 L140 200 L120 200 Z" fill="#FFFFFF" stroke="#000" strokeWidth="2" />
        <path d="M160 185 L180 185 L180 200 L160 200 Z" fill="#FFFFFF" stroke="#000" strokeWidth="2" />
      </svg>
    </div>
  );
}