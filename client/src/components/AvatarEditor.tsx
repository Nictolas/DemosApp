import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface AvatarConfig {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  mustache: boolean;
  suitColor: string;
  tieColor: string;
}

interface AvatarEditorProps {
  onSave: (config: AvatarConfig) => void;
  initialConfig?: AvatarConfig;
}

const defaultConfig: AvatarConfig = {
  skinColor: "#E6B894",
  hairColor: "#8B4513",
  hairStyle: "bald",
  mustache: false,
  suitColor: "#2C3E50",
  tieColor: "#E74C3C"
};

const skinColors = [
  { name: "Chiaro", value: "#FDBCB4" },
  { name: "Medio", value: "#E6B894" },
  { name: "Olivastro", value: "#C68642" },
  { name: "Scuro", value: "#8D5524" },
  { name: "Molto Scuro", value: "#654321" }
];

const hairColors = [
  { name: "Biondo", value: "#F4E4BC" },
  { name: "Castano", value: "#8B4513" },
  { name: "Nero", value: "#2C1810" },
  { name: "Rosso", value: "#B22222" },
  { name: "Grigio", value: "#808080" },
  { name: "Bianco", value: "#F5F5F5" }
];

const hairStyles = [
  { name: "Calvo", value: "bald" },
  { name: "Corti", value: "short" },
  { name: "Lunghi", value: "long" }
];

const suitColors = [
  { name: "Blu Scuro", value: "#2C3E50" },
  { name: "Nero", value: "#1A1A1A" },
  { name: "Grigio", value: "#7F8C8D" },
  { name: "Marrone", value: "#8B4513" }
];

const tieColors = [
  { name: "Rosso", value: "#E74C3C" },
  { name: "Blu", value: "#3498DB" },
  { name: "Verde", value: "#27AE60" },
  { name: "Giallo", value: "#F1C40F" },
  { name: "Viola", value: "#9B59B6" }
];

export function AvatarEditor({ onSave, initialConfig = defaultConfig }: AvatarEditorProps) {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig);

  const updateConfig = (key: keyof AvatarConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const renderHair = () => {
    if (config.hairStyle === "bald") return null;
    
    const hairPath = config.hairStyle === "short" 
      ? "M85 45 Q50 35 115 45 Q150 35 215 45 Q215 60 200 70 Q100 70 85 60 Z"
      : "M75 40 Q50 30 125 40 Q150 30 225 40 Q225 80 200 90 Q100 90 75 80 Z";
    
    return (
      <path
        d={hairPath}
        fill={config.hairColor}
        stroke="#000"
        strokeWidth="3"
      />
    );
  };

  const renderMustache = () => {
    if (!config.mustache) return null;
    
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Preview dell'avatar */}
      <Card>
        <CardHeader>
          <CardTitle>Anteprima Avatar</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="bg-gray-100 p-8 rounded-lg">
            <svg width="300" height="400" viewBox="0 0 300 400">
              {/* Sfondo */}
              <rect width="300" height="400" fill="#F5F5F5" />
              
              {/* Capelli */}
              {renderHair()}
              
              {/* Testa */}
              <circle
                cx="150"
                cy="100"
                r="65"
                fill={config.skinColor}
                stroke="#000"
                strokeWidth="4"
              />
              
              {/* Orecchie */}
              <circle cx="95" cy="100" r="12" fill={config.skinColor} stroke="#000" strokeWidth="3" />
              <circle cx="205" cy="100" r="12" fill={config.skinColor} stroke="#000" strokeWidth="3" />
              
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
              <rect x="130" y="160" width="40" height="30" fill={config.skinColor} stroke="#000" strokeWidth="3" />
              
              {/* Camicia */}
              <rect x="110" y="185" width="80" height="120" fill="#FFFFFF" stroke="#000" strokeWidth="3" />
              
              {/* Cravatta */}
              <polygon 
                points="140,185 160,185 155,250 145,250" 
                fill={config.tieColor} 
                stroke="#000" 
                strokeWidth="2" 
              />
              
              {/* Giacca */}
              <path
                d="M80 200 L80 400 L220 400 L220 200 L200 185 L190 190 L190 200 L110 200 L110 190 L100 185 Z"
                fill={config.suitColor}
                stroke="#000"
                strokeWidth="4"
              />
              
              {/* Risvolti giacca */}
              <path d="M100 185 L120 205 L120 240 L100 220 Z" fill={config.suitColor} stroke="#000" strokeWidth="2" />
              <path d="M200 185 L180 205 L180 240 L200 220 Z" fill={config.suitColor} stroke="#000" strokeWidth="2" />
              
              {/* Colletto camicia */}
              <path d="M120 185 L140 185 L140 200 L120 200 Z" fill="#FFFFFF" stroke="#000" strokeWidth="2" />
              <path d="M160 185 L180 185 L180 200 L160 200 Z" fill="#FFFFFF" stroke="#000" strokeWidth="2" />
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Controlli di personalizzazione */}
      <Card>
        <CardHeader>
          <CardTitle>Personalizza Avatar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Colore pelle */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Colore Pelle</Label>
            <div className="grid grid-cols-3 gap-2">
              {skinColors.map((color) => (
                <button
                  key={color.value}
                  className={`w-full h-10 rounded-md border-2 transition-all ${
                    config.skinColor === color.value ? 'border-primary scale-105' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => updateConfig('skinColor', color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Stile capelli */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Stile Capelli</Label>
            <div className="grid grid-cols-3 gap-2">
              {hairStyles.map((style) => (
                <Button
                  key={style.value}
                  variant={config.hairStyle === style.value ? "default" : "outline"}
                  className="text-xs"
                  onClick={() => updateConfig('hairStyle', style.value)}
                >
                  {style.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Colore capelli (solo se non calvo) */}
          {config.hairStyle !== "bald" && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Colore Capelli</Label>
              <div className="grid grid-cols-3 gap-2">
                {hairColors.map((color) => (
                  <button
                    key={color.value}
                    className={`w-full h-10 rounded-md border-2 transition-all ${
                      config.hairColor === color.value ? 'border-primary scale-105' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => updateConfig('hairColor', color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Baffi */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Baffi</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={!config.mustache ? "default" : "outline"}
                onClick={() => updateConfig('mustache', false)}
              >
                Senza
              </Button>
              <Button
                variant={config.mustache ? "default" : "outline"}
                onClick={() => updateConfig('mustache', true)}
              >
                Con Baffi
              </Button>
            </div>
          </div>

          {/* Colore giacca */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Colore Giacca</Label>
            <div className="grid grid-cols-2 gap-2">
              {suitColors.map((color) => (
                <button
                  key={color.value}
                  className={`w-full h-10 rounded-md border-2 transition-all flex items-center justify-center text-white text-xs font-medium ${
                    config.suitColor === color.value ? 'border-primary scale-105' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => updateConfig('suitColor', color.value)}
                >
                  {color.name}
                </button>
              ))}
            </div>
          </div>

          {/* Colore cravatta */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Colore Cravatta</Label>
            <div className="grid grid-cols-3 gap-2">
              {tieColors.map((color) => (
                <button
                  key={color.value}
                  className={`w-full h-10 rounded-md border-2 transition-all ${
                    config.tieColor === color.value ? 'border-primary scale-105' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => updateConfig('tieColor', color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Pulsante salva */}
          <Button 
            onClick={() => onSave(config)} 
            className="w-full"
            size="lg"
          >
            Salva Avatar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}