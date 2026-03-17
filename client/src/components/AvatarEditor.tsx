import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { HairStyleSelector } from "@/components/HairStyleSelector";
import { BeardStyleSelector } from "@/components/BeardStyleSelector";
import { MustacheStyleSelector } from "@/components/MustacheStyleSelector";
import { NoseStyleSelector } from "@/components/NoseStyleSelector";
import { ColorSelector } from "@/components/ColorSelector";
import { GlassesStyleSelector } from "@/components/GlassesStyleSelector";

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

interface AvatarEditorProps {
  onSave: (config: AvatarConfig) => void;
  initialConfig?: AvatarConfig;
  isSaving?: boolean;
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
  glassesStyle: "none",
  glassesColor: "#333333"
};

export function AvatarEditor({ onSave, initialConfig = defaultConfig, isSaving = false }: AvatarEditorProps) {
  // Normalizza la configurazione iniziale assicurandoci che tutti i campi siano definiti
  const normalizedInitialConfig = {
    ...defaultConfig,
    ...initialConfig,
    glassesStyle: initialConfig.glassesStyle || "none",
    glassesColor: initialConfig.glassesColor || "#333333"
  };
  
  const [config, setConfig] = useState<AvatarConfig>(normalizedInitialConfig);







  const skinColors = [
    { name: "Molto Chiaro", value: "#FFE5D9" },
    { name: "Chiaro", value: "#FDBCB4" },
    { name: "Medio", value: "#F1C27D" },
    { name: "Olivastro", value: "#E0AC69" },
    { name: "Scuro", value: "#C68642" },
    { name: "Molto Scuro", value: "#8D5524" },
    { name: "Ebano", value: "#5D4037" },
    { name: "Albino", value: "#FFF8F0" },
    { name: "Crema", value: "#F5DEB3" },
    { name: "Miele", value: "#D2691E" },
    { name: "Cioccolato", value: "#654321" },
    { name: "Carbone", value: "#2F2F2F" }
  ];

  const hairColors = [
    { name: "Biondo Platino", value: "#FFF8DC" },
    { name: "Biondo Giallo", value: "#FFD700" },
    { name: "Castano", value: "#8B4513" },
    { name: "Marrone Chiaro", value: "#CD853F" },
    { name: "Nero", value: "#2F2F2F" },
    { name: "Rosso", value: "#B22222" },
    { name: "Arancione", value: "#FF8C00" },
    { name: "Grigio", value: "#A9A9A9" },
    { name: "Bianco", value: "#F5F5F5" },
    { name: "Bianco Totale", value: "#FFFFFF" }
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

  const glassesColors = [
    { name: "Nero", value: "#333333" },
    { name: "Marrone", value: "#8B4513" },
    { name: "Blu", value: "#3B82F6" },
    { name: "Verde Scuro", value: "#2E7D32" },
    { name: "Rosso Scuro", value: "#8B0000" },
    { name: "Grigio", value: "#5D6D7E" }
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
            className="rounded-full border-4 border-gray-300"
          />
        </div>
      </div>

      {/* Personalizzazione Avatar - SOTTO CON SCHEDE */}
      <div className="space-y-6">
        
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
                <ColorSelector
                  label="Colore Pelle"
                  colors={skinColors}
                  selectedColor={config.skinColor}
                  onColorChange={(color) => setConfig({ ...config, skinColor: color })}
                  buttonSize="large"
                  gridCols={6}
                />

                <NoseStyleSelector
                  selectedNoseStyle={config.noseStyle}
                  skinColor={config.skinColor}
                  onNoseStyleChange={(style) => setConfig({ ...config, noseStyle: style })}
                />
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
                <HairStyleSelector
                  selectedHairStyle={config.hairStyle}
                  hairColor={config.hairColor}
                  onHairStyleChange={(style) => setConfig({ ...config, hairStyle: style })}
                />

                 <div className="flex justify-center">
                   <ColorSelector
                     label="Colore Capelli"
                     colors={hairColors}
                     selectedColor={config.hairColor}
                     onColorChange={(color) => setConfig({ ...config, hairColor: color })}
                     buttonSize="small"
                     gridCols={5}
                   />
                 </div>

                <MustacheStyleSelector
                  mustacheStyle={config.mustacheStyle}
                  mustacheColor={config.mustacheColor}
                  onMustacheStyleChange={(style) => setConfig({ ...config, mustacheStyle: style })}
                />

                 <div className="flex justify-center">
                   <ColorSelector
                     label="Colore Baffi"
                     colors={hairColors}
                     selectedColor={config.mustacheColor}
                     onColorChange={(color) => setConfig({ ...config, mustacheColor: color })}
                     buttonSize="small"
                     gridCols={5}
                   />
                 </div>

                <BeardStyleSelector
                  beardStyle={config.beardStyle}
                  beardColor={config.beardColor}
                  onBeardStyleChange={(style) => setConfig({ ...config, beardStyle: style })}
                />

                 <div className="flex justify-center">
                   <ColorSelector
                     label="Colore Barba"
                     colors={hairColors}
                     selectedColor={config.beardColor}
                     onColorChange={(color) => setConfig({ ...config, beardColor: color })}
                     buttonSize="small"
                     gridCols={5}
                   />
                 </div>
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
                <ColorSelector
                  label="Colore Giacca"
                  colors={suitColors}
                  selectedColor={config.suitColor}
                  onColorChange={(color) => setConfig({ ...config, suitColor: color })}
                  buttonSize="large"
                  gridCols={6}
                />

                <ColorSelector
                  label="Colore Cravatta"
                  colors={tieColors}
                  selectedColor={config.tieColor}
                  onColorChange={(color) => setConfig({ ...config, tieColor: color })}
                  buttonSize="large"
                  gridCols={6}
                />

                <GlassesStyleSelector
                  selectedGlassesStyle={config.glassesStyle}
                  glassesColor={config.glassesColor}
                  onGlassesStyleChange={(style) => setConfig({ ...config, glassesStyle: style })}
                  onGlassesColorChange={(color) => setConfig({ ...config, glassesColor: color })}
                />

                <div className="flex justify-center">
                  <ColorSelector
                    label="Colore Occhiali"
                    colors={glassesColors}
                    selectedColor={config.glassesColor}
                    onColorChange={(color) => setConfig({ ...config, glassesColor: color })}
                    buttonSize="large"
                    gridCols={6}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button 
          onClick={() => onSave(config)} 
          className="w-full"
          size="lg"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salva Avatar"
          )}
        </Button>
      </div>
    </div>
  );
}
