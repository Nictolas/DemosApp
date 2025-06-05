import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
}

interface AvatarEditorProps {
  onSave: (config: AvatarConfig) => void;
  initialConfig?: AvatarConfig;
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
  tieColor: "#E74C3C"
};

export function AvatarEditor({ onSave, initialConfig = defaultConfig }: AvatarEditorProps) {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig);

  const skinColors = [
    { name: "Molto Chiaro", value: "#FFE5D9" },
    { name: "Chiaro", value: "#FDBCB4" },
    { name: "Medio", value: "#F1C27D" },
    { name: "Olivastro", value: "#E0AC69" },
    { name: "Scuro", value: "#C68642" },
    { name: "Molto Scuro", value: "#8D5524" }
  ];

  const hairColors = [
    { name: "Biondo", value: "#F5F5DC" },
    { name: "Castano", value: "#8B4513" },
    { name: "Nero", value: "#2F2F2F" },
    { name: "Rosso", value: "#B22222" },
    { name: "Grigio", value: "#A9A9A9" },
    { name: "Bianco", value: "#F5F5F5" }
  ];

  const suitColors = [
    { name: "Blu Scuro", value: "#2C3E50" },
    { name: "Nero", value: "#2F2F2F" },
    { name: "Grigio", value: "#5D6D7E" },
    { name: "Marrone", value: "#8B4513" }
  ];

  const tieColors = [
    { name: "Rosso", value: "#E74C3C" },
    { name: "Blu", value: "#3498DB" },
    { name: "Verde", value: "#27AE60" },
    { name: "Giallo", value: "#F1C40F" },
    { name: "Viola", value: "#9B59B6" }
  ];

  const renderHair = () => {
    const hairColor = config.hairColor;
    
    switch (config.hairStyle) {
      case "bald":
        return null;
      case "short":
        return (
          <path
            d="M90 80 Q150 60 210 80 Q210 95 150 90 Q90 95 90 80 Z"
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        );
      case "long":
        return (
          <g>
            <path
              d="M80 75 Q150 60 220 75 Q225 115 205 145 Q195 155 150 150 Q105 155 95 145 Q75 115 80 75 Z"
              fill={hairColor}
              stroke="#000"
              strokeWidth="3"
            />
          </g>
        );
      case "curly":
        return (
          <g>
            <circle cx="125" cy="70" r="12" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="150" cy="65" r="15" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="175" cy="70" r="12" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="115" cy="85" r="10" fill={hairColor} stroke="#000" strokeWidth="2" />
            <circle cx="185" cy="85" r="10" fill={hairColor} stroke="#000" strokeWidth="2" />
          </g>
        );
      case "messy":
        return (
          <path
            d="M85 85 Q105 60 125 75 Q135 55 150 70 Q155 50 165 75 Q175 65 195 80 Q185 95 150 90 Q105 95 85 85 Z"
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        );
      case "wavy":
        return (
          <path
            d="M90 80 Q115 65 150 70 Q165 65 210 80 Q205 100 150 95 Q95 100 90 80 Z"
            fill={hairColor}
            stroke="#000"
            strokeWidth="3"
          />
        );
      case "buzz":
        return (
          <path
            d="M95 80 Q150 70 205 80 Q200 90 150 88 Q100 90 95 80 Z"
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
    switch (config.mustacheStyle) {
      case "classic":
        return (
          <ellipse
            cx="150"
            cy="150"
            rx="12"
            ry="4"
            fill={config.mustacheColor}
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "thick":
        return (
          <ellipse
            cx="150"
            cy="150"
            rx="15"
            ry="6"
            fill={config.mustacheColor}
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "handlebar":
        return (
          <g>
            <ellipse cx="150" cy="150" rx="10" ry="3" fill={config.mustacheColor} />
            <circle cx="135" cy="148" r="4" fill={config.mustacheColor} />
            <circle cx="165" cy="148" r="4" fill={config.mustacheColor} />
          </g>
        );
      default:
        return null;
    }
  };

  const renderBeard = () => {
    switch (config.beardStyle) {
      case "goatee":
        return (
          <ellipse
            cx="150"
            cy="175"
            rx="8"
            ry="12"
            fill={config.beardColor}
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "full":
        return (
          <path
            d="M110 160 Q150 180 190 160 Q190 185 150 190 Q110 185 110 160 Z"
            fill={config.beardColor}
            stroke="#000"
            strokeWidth="1"
          />
        );
      case "stubble":
        return (
          <ellipse
            cx="150"
            cy="170"
            rx="25"
            ry="8"
            fill={config.beardColor}
            opacity="0.3"
          />
        );
      default:
        return null;
    }
  };

  const renderNose = () => {
    switch (config.noseStyle) {
      case "small":
        return <path d="M 148 135 Q 150 138 152 135" stroke="#000" strokeWidth="2" fill="none" />;
      case "large":
        return <path d="M 145 132 Q 150 142 155 132" stroke="#000" strokeWidth="3" fill="none" />;
      case "pointed":
        return <path d="M 148 133 L 150 140 L 152 133" stroke="#000" strokeWidth="2" fill="none" />;
      case "button":
        return <circle cx="150" cy="135" r="3" fill={config.skinColor} stroke="#000" strokeWidth="2" />;
      default: // normal
        return <path d="M 145 135 Q 150 140 155 135" stroke="#000" strokeWidth="3" fill="none" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Anteprima Avatar - A SINISTRA */}
      <div className="flex flex-col items-center space-y-4 order-1 lg:order-1">
        <h3 className="text-lg font-semibold">Anteprima Avatar</h3>
        <div className="p-6 bg-gray-50 rounded-lg">
          <svg width="200" height="200" viewBox="0 0 300 300" className="rounded-full border-4 border-gray-300">
            {/* Sfondo */}
            <rect width="300" height="300" fill="#F5F5F5" />
            
            {/* Orecchie (dietro) */}
            <ellipse cx="90" cy="130" rx="15" ry="22" fill={config.skinColor} stroke="#000" strokeWidth="3" />
            <ellipse cx="210" cy="130" rx="15" ry="22" fill={config.skinColor} stroke="#000" strokeWidth="3" />
            
            {/* Collo trapezoidale (dietro) */}
            <path
              d="M130 195 L170 195 L180 225 L120 225 Z"
              fill={config.skinColor}
              stroke="#000"
              strokeWidth="3"
            />
            
            {/* Spalle con braccia ancora più in alto */}
            <ellipse
              cx="150"
              cy="260"
              rx="110"
              ry="40"
              fill={config.suitColor}
              stroke="#000"
              strokeWidth="3"
            />
            
            {/* Giacca con forma migliorata */}
            <path
              d="M60 220 Q120 210 150 210 Q180 210 240 220 L240 300 L60 300 Z"
              fill={config.suitColor}
              stroke="#000"
              strokeWidth="3"
            />
            
            {/* Lapels della giacca */}
            <path
              d="M105 225 L125 240 L135 210 L115 210 Z"
              fill={config.suitColor}
              stroke="#000"
              strokeWidth="3"
            />
            <path
              d="M195 225 L175 240 L165 210 L185 210 Z"
              fill={config.suitColor}
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
              fill={config.tieColor}
              stroke="#000"
              strokeWidth="3"
            />
            
            {/* Cravatta */}
            <path
              d="M140 227 L160 227 L158 275 L150 285 L142 275 Z"
              fill={config.tieColor}
              stroke="#000"
              strokeWidth="3"
            />
            
            {/* Testa più larga e allungata */}
            <path
              d="M90 130 Q90 60 150 55 Q210 60 210 130 Q210 200 150 205 Q90 200 90 130 Z"
              fill={config.skinColor}
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
          </svg>
        </div>
      </div>

      {/* Personalizzazione Avatar - A DESTRA */}
      <div className="space-y-6 order-2 lg:order-2">
        <h3 className="text-lg font-semibold">Personalizzazione Avatar</h3>
        
        <Card>
          <CardHeader>
            <CardTitle>Aspetto Fisico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Colore Pelle</Label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {skinColors.map((color) => (
                  <button
                    key={color.value}
                    className={`w-10 h-10 rounded-full border-2 ${
                      config.skinColor === color.value ? "border-black" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setConfig({ ...config, skinColor: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Stile Capelli</Label>
              <Select
                value={config.hairStyle}
                onValueChange={(value) => setConfig({ ...config, hairStyle: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bald">Calvo</SelectItem>
                  <SelectItem value="short">Corti</SelectItem>
                  <SelectItem value="long">Lunghi</SelectItem>
                  <SelectItem value="curly">Ricci</SelectItem>
                  <SelectItem value="messy">Spettinati</SelectItem>
                  <SelectItem value="wavy">Ondulati</SelectItem>
                  <SelectItem value="buzz">Rasati</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Colore Capelli</Label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {hairColors.map((color) => (
                  <button
                    key={color.value}
                    className={`w-8 h-8 rounded-full border-2 ${
                      config.hairColor === color.value ? "border-black" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setConfig({ ...config, hairColor: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Stile Baffi</Label>
              <Select
                value={config.mustacheStyle}
                onValueChange={(value) => setConfig({ ...config, mustacheStyle: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuno</SelectItem>
                  <SelectItem value="classic">Classici</SelectItem>
                  <SelectItem value="thick">Spessi</SelectItem>
                  <SelectItem value="handlebar">A Manubrio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.mustacheStyle !== "none" && (
              <div>
                <Label>Colore Baffi</Label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {hairColors.map((color) => (
                    <button
                      key={color.value}
                      className={`w-8 h-8 rounded-full border-2 ${
                        config.mustacheColor === color.value ? "border-black" : "border-gray-300"
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setConfig({ ...config, mustacheColor: color.value })}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Stile Barba</Label>
              <Select
                value={config.beardStyle}
                onValueChange={(value) => setConfig({ ...config, beardStyle: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  <SelectItem value="goatee">Pizzetto</SelectItem>
                  <SelectItem value="full">Piena</SelectItem>
                  <SelectItem value="stubble">Barba Incolta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.beardStyle !== "none" && (
              <div>
                <Label>Colore Barba</Label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {hairColors.map((color) => (
                    <button
                      key={color.value}
                      className={`w-8 h-8 rounded-full border-2 ${
                        config.beardColor === color.value ? "border-black" : "border-gray-300"
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setConfig({ ...config, beardColor: color.value })}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Stile Naso</Label>
              <Select
                value={config.noseStyle}
                onValueChange={(value) => setConfig({ ...config, noseStyle: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="small">Piccolo</SelectItem>
                  <SelectItem value="large">Grande</SelectItem>
                  <SelectItem value="pointed">Appuntito</SelectItem>
                  <SelectItem value="button">A Bottone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abbigliamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Colore Giacca</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {suitColors.map((color) => (
                  <button
                    key={color.value}
                    className={`w-10 h-10 rounded-full border-2 ${
                      config.suitColor === color.value ? "border-black" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setConfig({ ...config, suitColor: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Colore Cravatta</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {tieColors.map((color) => (
                  <button
                    key={color.value}
                    className={`w-10 h-10 rounded-full border-2 ${
                      config.tieColor === color.value ? "border-black" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setConfig({ ...config, tieColor: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          onClick={() => onSave(config)} 
          className="w-full"
          size="lg"
        >
          Salva Avatar
        </Button>
      </div>
    </div>
  );
}