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
  { name: "Lunghi", value: "long" },
  { name: "Ricci", value: "curly" },
  { name: "Spettinati", value: "spiky" },
  { name: "Ondulati", value: "wavy" },
  { name: "Rasati", value: "buzz" }
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
    
    let hairPath = "";
    
    switch (config.hairStyle) {
      case "short":
        hairPath = "M85 80 Q50 70 115 80 Q150 70 215 80 Q215 95 200 100 Q100 100 85 95 Z";
        break;
      case "long":
        hairPath = "M75 70 Q50 60 125 70 Q150 60 225 70 Q225 120 200 130 Q100 130 75 120 Z";
        break;
      case "curly":
        hairPath = "M85 75 Q60 65 90 80 Q120 70 150 85 Q180 70 210 80 Q240 65 215 80 Q215 110 190 115 Q150 120 110 115 Q85 110 85 75 Z";
        break;
      case "spiky":
        hairPath = "M85 85 L90 65 L95 85 L105 70 L115 85 L130 75 L145 65 L160 75 L175 65 L190 75 L205 70 L215 85 Q215 100 200 105 Q100 105 85 100 Z";
        break;
      case "wavy":
        hairPath = "M80 80 Q60 70 85 85 Q110 75 135 85 Q160 75 185 85 Q210 75 220 80 Q220 105 200 110 Q100 110 80 105 Z";
        break;
      case "buzz":
        hairPath = "M90 85 Q70 80 120 85 Q150 80 180 85 Q230 80 210 85 Q210 95 195 98 Q105 98 90 95 Z";
        break;
      default:
        hairPath = "M85 80 Q50 70 115 80 Q150 70 215 80 Q215 95 200 100 Q100 100 85 95 Z";
    }
    
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
            <svg width="300" height="300" viewBox="0 0 300 300" className="rounded-lg shadow-sm">
              {/* Sfondo */}
              <rect width="300" height="300" fill="#F5F5F5" />
              
              {/* Collo (dietro la faccia) */}
              <rect x="130" y="155" width="40" height="40" fill={config.skinColor} stroke="#000" strokeWidth="3" />
              
              {/* Orecchie (dietro la faccia, più esterne) */}
              <circle cx="88" cy="120" r="12" fill={config.skinColor} stroke="#000" strokeWidth="3" />
              <circle cx="212" cy="120" r="12" fill={config.skinColor} stroke="#000" strokeWidth="3" />
              
              {/* Capelli (dietro se lunghi) */}
              {config.hairStyle === "long" && renderHair()}
              
              {/* Giacca */}
              <path
                d="M80 190 L80 300 L220 300 L220 190 L200 180 L190 185 L190 195 L110 195 L110 185 L100 180 Z"
                fill={config.suitColor}
                stroke="#000"
                strokeWidth="4"
              />
              
              {/* Camicia */}
              <rect x="110" y="185" width="80" height="115" fill="#FFFFFF" stroke="#000" strokeWidth="3" />
              
              {/* Cravatta completa */}
              <polygon 
                points="140,185 160,185 158,220 155,240 150,260 145,240 142,220" 
                fill={config.tieColor} 
                stroke="#000" 
                strokeWidth="2" 
              />
              
              {/* Nodo cravatta */}
              <polygon 
                points="140,185 160,185 155,200 145,200" 
                fill={config.tieColor} 
                stroke="#000" 
                strokeWidth="2" 
              />
              
              {/* Risvolti giacca */}
              <path d="M100 180 L120 200 L120 230 L100 210 Z" fill={config.suitColor} stroke="#000" strokeWidth="2" />
              <path d="M200 180 L180 200 L180 230 L200 210 Z" fill={config.suitColor} stroke="#000" strokeWidth="2" />
              
              {/* Colletto camicia */}
              <path d="M120 185 L140 185 L140 195 L120 195 Z" fill="#FFFFFF" stroke="#000" strokeWidth="2" />
              <path d="M160 185 L180 185 L180 195 L160 195 Z" fill="#FFFFFF" stroke="#000" strokeWidth="2" />
              
              {/* Testa */}
              <circle
                cx="150"
                cy="120"
                r="65"
                fill={config.skinColor}
                stroke="#000"
                strokeWidth="4"
              />
              
              {/* Capelli corti (davanti alla faccia) */}
              {config.hairStyle !== "long" && renderHair()}
              
              {/* Occhi */}
              <ellipse cx="125" cy="105" rx="6" ry="8" fill="#000" />
              <ellipse cx="175" cy="105" rx="6" ry="8" fill="#000" />
              
              {/* Naso */}
              <path d="M145 125 Q150 130 155 125" stroke="#000" strokeWidth="2" fill="none" />
              
              {/* Bocca */}
              <path d="M135 145 Q150 155 165 145" stroke="#000" strokeWidth="3" fill="none" />
              
              {/* Baffi */}
              {renderMustache()}
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
            <Label className="text-sm font-medium mb-3 block">Stile Capelli</Label>
            <div className="grid grid-cols-2 gap-2">
              {hairStyles.map((style) => (
                <Button
                  key={style.value}
                  variant={config.hairStyle === style.value ? "default" : "outline"}
                  className="text-xs h-9"
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