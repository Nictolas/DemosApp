import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CustomAvatar } from "@/components/CustomAvatar";

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
    { name: "Molto Scuro", value: "#8D5524" },
    { name: "Ebano", value: "#5D4037" }
  ];

  const hairColors = [
    { name: "Biondo", value: "#F5F5DC" },
    { name: "Biondo Platino", value: "#FFF8DC" },
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
    { name: "Marrone", value: "#8B4513" },
    { name: "Blu Navy", value: "#1A237E" },
    { name: "Verde Scuro", value: "#2E7D32" }
  ];

  const tieColors = [
    { name: "Rosso", value: "#E74C3C" },
    { name: "Blu", value: "#3498DB" },
    { name: "Verde", value: "#27AE60" },
    { name: "Giallo", value: "#F1C40F" },
    { name: "Viola", value: "#9B59B6" },
    { name: "Arancione", value: "#FF5722" }
  ];



  return (
    <div className="flex flex-col gap-6 px-4 lg:px-0">
      {/* Anteprima Avatar - IN ALTO */}
      <div className="flex flex-col items-center space-y-4">
        <h3 className="text-lg font-semibold">Anteprima Avatar</h3>
        <div className="p-6 bg-gray-50 rounded-full">
          <CustomAvatar 
            config={config} 
            size={200} 
            className="border-4 border-gray-300"
          />
        </div>
      </div>

      {/* Personalizzazione Avatar - SOTTO CON SCHEDE */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Personalizzazione Avatar</h3>
        
        <Tabs defaultValue="aspetto" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="aspetto">Aspetto</TabsTrigger>
            <TabsTrigger value="capelli">Capelli</TabsTrigger>
            <TabsTrigger value="abbigliamento">Abbigliamento</TabsTrigger>
          </TabsList>
          
          {/* Scheda ASPETTO - Pelle e Naso */}
          <TabsContent value="aspetto" className="mt-6">
            <Card className="bg-white">
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
                  <Label>Stile Naso</Label>
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.noseStyle === "normal" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, noseStyle: "normal" })}
                      title="Normale"
                    >
                      <svg className="w-10 h-8" viewBox="0 0 40 32" fill="currentColor">
                        <path d="M20 8 Q24 16 20 24 Q16 16 20 8" fill="#FDBCB4"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.noseStyle === "small" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, noseStyle: "small" })}
                      title="Piccolo"
                    >
                      <svg className="w-10 h-8" viewBox="0 0 40 32" fill="currentColor">
                        <path d="M20 10 Q22 16 20 22 Q18 16 20 10" fill="#FDBCB4"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.noseStyle === "large" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, noseStyle: "large" })}
                      title="Grande"
                    >
                      <svg className="w-10 h-8" viewBox="0 0 40 32" fill="currentColor">
                        <path d="M20 6 Q26 16 20 26 Q14 16 20 6" fill="#FDBCB4"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.noseStyle === "pointed" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, noseStyle: "pointed" })}
                      title="Appuntito"
                    >
                      <svg className="w-10 h-8" viewBox="0 0 40 32" fill="currentColor">
                        <path d="M20 8 L24 20 L20 24 L16 20 Z" fill="#FDBCB4"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.noseStyle === "button" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, noseStyle: "button" })}
                      title="A Bottone"
                    >
                      <svg className="w-10 h-8" viewBox="0 0 40 32" fill="currentColor">
                        <circle cx="20" cy="16" r="4" fill="#FDBCB4"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Scheda CAPELLI - Capelli, Baffi e Barba */}
          <TabsContent value="capelli" className="mt-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Capelli e Barba</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Stile Capelli</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.hairStyle === "bald" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, hairStyle: "bald" })}
                      title="Calvo"
                    >
                      <div className="w-12 h-8 flex items-center justify-center text-gray-500 text-xs">
                        Calvo
                      </div>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.hairStyle === "short" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, hairStyle: "short" })}
                      title="Corti"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Capelli corti realistici */}
                        <path d="M8 8 Q16 4 24 8 Q32 4 40 8 L40 12 Q32 16 24 12 Q16 16 8 12 Z" fill="#8B4513"/>
                        <path d="M10 10 Q16 6 24 10 Q32 6 38 10 L38 14 Q32 18 24 14 Q16 18 10 14 Z" fill="#8B4513"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.hairStyle === "long" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, hairStyle: "long" })}
                      title="Lunghi"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Capelli lunghi realistici */}
                        <path d="M8 8 Q16 2 24 8 Q32 2 40 8 L40 32 Q32 38 24 32 Q16 38 8 32 Z" fill="#8B4513"/>
                        <path d="M10 10 Q16 4 24 10 Q32 4 38 10 L38 30 Q32 36 24 30 Q16 36 10 30 Z" fill="#8B4513"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.hairStyle === "curly" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, hairStyle: "curly" })}
                      title="Ricci"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Capelli ricci realistici */}
                        <path d="M8 8 Q16 2 24 8 Q32 2 40 8 L40 16 Q32 22 24 16 Q16 22 8 16 Z" fill="#8B4513"/>
                        <path d="M10 10 Q16 4 24 10 Q32 4 38 10 L38 18 Q32 24 24 18 Q16 24 10 18 Z" fill="#8B4513"/>
                        {/* Riccioli aggiuntivi */}
                        <circle cx="12" cy="12" r="1.5" fill="#8B4513"/>
                        <circle cx="24" cy="12" r="1.5" fill="#8B4513"/>
                        <circle cx="36" cy="12" r="1.5" fill="#8B4513"/>
                        <circle cx="18" cy="14" r="1" fill="#8B4513"/>
                        <circle cx="30" cy="14" r="1" fill="#8B4513"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.hairStyle === "messy" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, hairStyle: "messy" })}
                      title="Spettinati"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Capelli spettinati realistici */}
                        <path d="M8 8 Q16 2 24 8 Q32 2 40 8 L40 16 Q32 22 24 16 Q16 22 8 16 Z" fill="#8B4513"/>
                        <path d="M10 10 Q16 4 24 10 Q32 4 38 10 L38 18 Q32 24 24 18 Q16 24 10 18 Z" fill="#8B4513"/>
                        {/* Ciocche spettinate */}
                        <path d="M6 6 L10 10 M34 6 L38 10 M20 4 L24 8 M16 6 L20 10 M28 6 L32 10" stroke="#8B4513" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.hairStyle === "wavy" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, hairStyle: "wavy" })}
                      title="Ondulati"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Capelli ondulati realistici */}
                        <path d="M8 8 Q16 2 24 8 Q32 2 40 8 L40 16 Q32 22 24 16 Q16 22 8 16 Z" fill="#8B4513"/>
                        <path d="M10 10 Q16 4 24 10 Q32 4 38 10 L38 18 Q32 24 24 18 Q16 24 10 18 Z" fill="#8B4513"/>
                        {/* Onde realistiche */}
                        <path d="M8 12 Q16 8 24 12 Q32 8 40 12" stroke="#8B4513" strokeWidth="2" fill="none"/>
                        <path d="M8 14 Q16 10 24 14 Q32 10 40 14" stroke="#8B4513" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.hairStyle === "buzz" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, hairStyle: "buzz" })}
                      title="Rasati"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Capelli rasati realistici */}
                        <rect x="8" y="8" width="32" height="6" fill="#8B4513"/>
                        <rect x="10" y="10" width="28" height="4" fill="#8B4513"/>
                        {/* Punti per effetto realistico */}
                        <circle cx="12" cy="12" r="0.5" fill="#8B4513"/>
                        <circle cx="24" cy="12" r="0.5" fill="#8B4513"/>
                        <circle cx="36" cy="12" r="0.5" fill="#8B4513"/>
                      </svg>
                    </button>
                  </div>
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
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.mustacheStyle === "none" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, mustacheStyle: "none" })}
                      title="Nessuno"
                    >
                      <div className="w-12 h-8 flex items-center justify-center text-gray-500 text-xs">
                        Nessuno
                      </div>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.mustacheStyle === "classic" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, mustacheStyle: "classic" })}
                      title="Classici"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Baffi classici realistici */}
                        <path d="M8 16 Q16 10 24 16 Q32 10 40 16 L40 18 Q32 24 24 18 Q16 24 8 18 Z" fill="#8B4513"/>
                        <path d="M10 17 Q16 11 24 17 Q32 11 38 17 L38 19 Q32 25 24 19 Q16 25 10 19 Z" fill="#8B4513"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.mustacheStyle === "thick" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, mustacheStyle: "thick" })}
                      title="Spessi"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Baffi spessi realistici */}
                        <path d="M6 18 Q16 8 24 18 Q32 8 42 18 L42 20 Q32 30 24 20 Q16 30 6 20 Z" fill="#8B4513"/>
                        <path d="M8 19 Q16 9 24 19 Q32 9 40 19 L40 21 Q32 31 24 21 Q16 31 8 21 Z" fill="#8B4513"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.mustacheStyle === "handlebar" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, mustacheStyle: "handlebar" })}
                      title="A Manubrio"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Baffi a manubrio realistici */}
                        <path d="M8 16 Q16 8 24 16 Q32 8 40 16 L40 20 Q32 28 24 20 Q16 28 8 20 Z" fill="#8B4513"/>
                        <path d="M10 17 Q16 9 24 17 Q32 9 38 17 L38 21 Q32 29 24 21 Q16 29 10 21 Z" fill="#8B4513"/>
                        {/* Estremità arricciate */}
                        <circle cx="6" cy="18" r="2" fill="#8B4513"/>
                        <circle cx="42" cy="18" r="2" fill="#8B4513"/>
                        <circle cx="5" cy="19" r="1.5" fill="#8B4513"/>
                        <circle cx="43" cy="19" r="1.5" fill="#8B4513"/>
                      </svg>
                    </button>
                  </div>
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
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.beardStyle === "none" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, beardStyle: "none" })}
                      title="Nessuna"
                    >
                      <div className="w-12 h-8 flex items-center justify-center text-gray-500 text-xs">
                        Nessuna
                      </div>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.beardStyle === "goatee" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, beardStyle: "goatee" })}
                      title="Pizzetto"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Pizzetto realistico */}
                        <path d="M20 8 Q24 18 28 8 L28 22 Q24 30 20 22 Z" fill="#8B4513"/>
                        <path d="M22 10 Q24 20 26 10 L26 20 Q24 28 22 20 Z" fill="#8B4513"/>
                        {/* Dettagli realistici */}
                        <circle cx="22" cy="12" r="0.8" fill="#8B4513"/>
                        <circle cx="26" cy="12" r="0.8" fill="#8B4513"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.beardStyle === "full" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, beardStyle: "full" })}
                      title="Piena"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Barba piena realistica */}
                        <path d="M8 8 Q16 2 24 8 Q32 2 40 8 L40 22 Q32 28 24 22 Q16 28 8 22 Z" fill="#8B4513"/>
                        <path d="M10 10 Q16 4 24 10 Q32 4 38 10 L38 20 Q32 26 24 20 Q16 26 10 20 Z" fill="#8B4513"/>
                        {/* Dettagli realistici */}
                        <circle cx="16" cy="12" r="1" fill="#8B4513"/>
                        <circle cx="24" cy="12" r="1" fill="#8B4513"/>
                        <circle cx="32" cy="12" r="1" fill="#8B4513"/>
                      </svg>
                    </button>
                    
                    <button
                      className={`p-2 rounded-lg border-2 ${
                        config.beardStyle === "stubble" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onClick={() => setConfig({ ...config, beardStyle: "stubble" })}
                      title="Barba Incolta"
                    >
                      <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                        {/* Barba incolta realistica */}
                        <circle cx="12" cy="10" r="1.2" fill="#8B4513"/>
                        <circle cx="24" cy="8" r="1.2" fill="#8B4513"/>
                        <circle cx="36" cy="10" r="1.2" fill="#8B4513"/>
                        <circle cx="16" cy="18" r="1" fill="#8B4513"/>
                        <circle cx="32" cy="18" r="1" fill="#8B4513"/>
                        <circle cx="20" cy="16" r="0.8" fill="#8B4513"/>
                        <circle cx="28" cy="16" r="0.8" fill="#8B4513"/>
                      </svg>
                    </button>
                  </div>
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
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Scheda ABBIGLIAMENTO */}
          <TabsContent value="abbigliamento" className="mt-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Abbigliamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Colore Giacca</Label>
                  <div className="grid grid-cols-6 gap-2 mt-2">
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
                  <div className="grid grid-cols-6 gap-2 mt-2">
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
          </TabsContent>
        </Tabs>

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