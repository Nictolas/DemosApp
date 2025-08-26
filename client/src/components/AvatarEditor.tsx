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
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "bald" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "bald" })}
                       title="Calvo"
                     >
                       <div className="text-gray-500 text-xs">
                         Calvo
                       </div>
                     </button>
                    
                                                              <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "short" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "short" })}
                       title="Corti"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Capelli corti scalati */}
                         <path d="M8 12 Q24 8 40 12 Q40 20 24 24 Q8 20 8 12 Z" fill="#8B4513"/>
                         <path d="M10 14 Q24 10 38 14 Q38 18 24 22 Q10 18 10 14 Z" fill="#8B4513"/>
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "long" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "long" })}
                       title="Lunghi"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Capelli lunghi scalati */}
                         <path d="M8 8 Q24 4 40 8 Q40 32 24 36 Q8 32 8 8 Z" fill="#8B4513"/>
                         <path d="M10 10 Q24 6 38 10 Q38 30 24 34 Q10 30 10 10 Z" fill="#8B4513"/>
                         <path d="M12 12 Q24 8 36 12 Q36 28 24 32 Q12 28 12 12 Z" fill="#8B4513"/>
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "curly" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "curly" })}
                       title="Ricci"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Capelli ricci scalati */}
                         <path d="M8 12 Q24 8 40 12 Q40 20 24 24 Q8 20 8 12 Z" fill="#8B4513"/>
                         <path d="M10 14 Q24 10 38 14 Q38 18 24 22 Q10 18 10 14 Z" fill="#8B4513"/>
                         <path d="M12 16 Q24 12 36 16 Q36 20 24 24 Q12 20 12 16 Z" fill="#8B4513"/>
                         {/* Riccioli */}
                         <circle cx="12" cy="12" r="1.5" fill="#8B4513"/>
                         <circle cx="24" cy="12" r="1.5" fill="#8B4513"/>
                         <circle cx="36" cy="12" r="1.5" fill="#8B4513"/>
                         <circle cx="18" cy="14" r="1" fill="#8B4513"/>
                         <circle cx="30" cy="14" r="1" fill="#8B4513"/>
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "messy" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "messy" })}
                       title="Spettinati"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Capelli spettinati scalati */}
                         <path d="M8 12 Q24 8 40 12 Q40 20 24 24 Q8 20 8 12 Z" fill="#8B4513"/>
                         <path d="M10 14 Q24 10 38 14 Q38 18 24 22 Q10 18 10 14 Z" fill="#8B4513"/>
                         <path d="M12 16 Q24 12 36 16 Q36 20 24 24 Q12 20 12 16 Z" fill="#8B4513"/>
                         {/* Ciocche spettinate */}
                         <path d="M6 6 L10 10 M34 6 L38 10 M20 4 L24 8 M16 6 L20 10 M28 6 L32 10" stroke="#8B4513" strokeWidth="1.5" fill="none"/>
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "wavy" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "wavy" })}
                       title="Ondulati"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Capelli ondulati scalati dal path originale */}
                         <path
                           d="M8 12 Q24 8 40 12 Q40 20 24 24 Q8 20 8 12 Z"
                           fill="#8B4513"
                         />
                         <path
                           d="M10 14 Q24 10 38 14 Q38 18 24 22 Q10 18 10 14 Z"
                           fill="#8B4513"
                         />
                         {/* Onde scalate */}
                         <path
                           d="M12 16 Q24 12 36 16 Q36 20 24 24 Q12 20 12 16 Z"
                           fill="#8B4513"
                         />
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "buzz" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "buzz" })}
                       title="Rasati"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Capelli rasati scalati dal path originale */}
                         <path
                           d="M12 16 Q10 20 12 24 Q13 22 14 20 Q13 18 12 16 Z"
                           fill="#8B4513"
                         />
                         <path
                           d="M36 16 Q38 20 36 24 Q35 22 34 20 Q35 18 36 16 Z"
                           fill="#8B4513"
                         />
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
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.mustacheStyle === "none" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, mustacheStyle: "none" })}
                       title="Nessuno"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Nessun baffo - solo testa */}
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.mustacheStyle === "classic" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, mustacheStyle: "classic" })}
                       title="Classici"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Baffi classici scalati dal path originale */}
                         <path
                           d="M16 28 Q24 26 32 28 Q32 30 24 32 Q16 30 16 28 Z"
                           fill="#8B4513"
                         />
                         <path
                           d="M18 30 Q24 28 30 30 Q30 32 24 34 Q18 32 18 30 Z"
                           fill="#8B4513"
                         />
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.mustacheStyle === "thick" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, mustacheStyle: "thick" })}
                       title="Spessi"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Baffi spessi scalati dal path originale */}
                         <path
                           d="M14 28 Q24 26 34 28 Q34 32 24 34 Q14 32 14 28 Z"
                           fill="#8B4513"
                         />
                         <path
                           d="M16 30 Q24 28 32 30 Q32 34 24 36 Q16 34 16 30 Z"
                           fill="#8B4513"
                         />
                         <path
                           d="M18 32 Q24 30 30 32 Q30 36 24 38 Q18 36 18 32 Z"
                           fill="#8B4513"
                         />
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.mustacheStyle === "handlebar" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, mustacheStyle: "handlebar" })}
                       title="A Manubrio"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Baffi a manubrio scalati dal path originale */}
                         <path
                           d="M12 28 Q24 26 36 28 Q36 32 24 34 Q12 32 12 28 Z"
                           fill="#8B4513"
                         />
                         <path
                           d="M14 30 Q24 28 34 30 Q34 34 24 36 Q14 34 14 30 Z"
                           fill="#8B4513"
                         />
                         {/* Estensioni laterali */}
                         <path
                           d="M8 26 Q12 24 16 26 Q16 28 12 30 Q8 28 8 26 Z"
                           fill="#8B4513"
                         />
                         <path
                           d="M32 26 Q36 24 40 26 Q40 28 36 30 Q32 28 32 26 Z"
                           fill="#8B4513"
                         />
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
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.beardStyle === "none" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, beardStyle: "none" })}
                       title="Nessuna"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Nessuna barba - solo testa */}
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.beardStyle === "goatee" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, beardStyle: "goatee" })}
                       title="Pizzetto"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Pizzetto scalato dal path originale */}
                         <ellipse
                           cx="24"
                           cy="32"
                           rx="4"
                           ry="6"
                           fill="#8B4513"
                         />
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.beardStyle === "full" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, beardStyle: "full" })}
                       title="Piena"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Barba piena scalata dal path originale */}
                         <path
                           d="M16 32 Q24 36 32 32 Q32 36 24 38 Q16 36 16 32 Z"
                           fill="#8B4513"
                         />
                         <path
                           d="M18 34 Q24 38 30 34 Q30 38 24 40 Q18 38 18 34 Z"
                           fill="#8B4513"
                         />
                       </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.beardStyle === "stubble" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, beardStyle: "stubble" })}
                       title="Barba Incolta"
                     >
                       <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
                         {/* Testa */}
                         <circle cx="24" cy="24" r="20" fill="#FDBCB4"/>
                         {/* Barba incolta scalata dal path originale */}
                         <ellipse
                           cx="24"
                           cy="34"
                           rx="16"
                           ry="8"
                           fill="#8B4513"
                           opacity="0.3"
                         />
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