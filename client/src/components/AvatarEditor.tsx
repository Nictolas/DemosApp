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
                          {/* CAPELLI CORTI IDENTICI ALL'AVATAR - PATH MATEMATICAMENTE SCALATO */}
                          <g fill="#8B4513" stroke="black" strokeWidth="1">
                            <path d="
                              M72 158 
                              c-12 -2 -21 -7 -25 -13 
                              -2 -3 -2 -3 -5 -5 
                              -7 0 -16 -4 -21 -10 
                              -3 -3 -6 -9 -7 -14 
                              -2 -5 -2 -26 0 -35 
                              1 -7 3 -12 5 -12 
                              1 0 2 -1 3 -2 
                              2 -2 3 -2 4 -2 
                              1 1 1 1 2 4 
                              1 5 3 11 4 12 
                              1 1 3 2 4 3 
                              5 2 10 8 13 15 
                              2 3 3 6 3 6 
                              0 0 2 -1 5 -2 
                              7 -4 15 -7 22 -8 
                              8 -2 11 -2 21 -2 
                              9 0 16 2 17 4 
                              1 2 2 2 4 2 
                              6 0 11 -3 13 -9 
                              2 -3 3 -11 4 -19 
                              0 -5 0 -5 2 -6 
                              1 -1 2 0 3 2 
                              1 1 2 3 3 3 
                              0 0 1 -1 2 -3 
                              2 -5 4 -15 3 -28 
                              0 -12 -2 -17 -6 -26 
                              -3 -5 -4 -7 -9 -12 
                              -8 -8 -16 -12 -28 -15 
                              -11 -3 -27 -4 -36 -2
                            " />
                          </g>
                        </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "long" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "long" })}
                       title="Lunghi"
                     >
                                               <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
                          {/* Testa */}
                          <circle cx="150" cy="150" r="100" fill="#FDBCB4"/>
                          {/* CAPELLI LUNGHI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
                          <g
                            transform="translate(10,285) scale(0.03,-0.03)"
                            fill="#8B4513"
                            stroke="black"
                            strokeWidth="80"
                          >
                            <path d="M4175 8349 c-406 -54 -755 -201 -1090 -458 -88 -67 -288 -264 -362 -356 -252 -314 -427 -676 -569 -1176 -168 -595 -240 -1234 -238 -2124 0 -551 24 -896 100 -1465 96 -722 209 -1111 389 -1338 139 -176 335 -270 425 -204 25 19 26 19 60 -5 97 -68 269 -123 379 -122 81 0 128 16 154 51 l20 27 -46 183 c-40 157 -68 295 -91 438 -20 125 -52 476 -81 885 -17 240 -37 394 -61 477 -9 29 -58 166 -109 303 -110 294 -171 497 -219 736 -65 322 -96 627 -96 966 l0 191 69 105 c38 58 169 269 292 469 273 447 344 557 471 725 385 514 826 813 1198 813 74 0 110 -6 162 -24 95 -34 222 -106 340 -193 126 -92 382 -348 495 -493 218 -281 421 -637 648 -1135 l78 -170 -6 -290 c-7 -367 -32 -608 -98 -960 -57 -300 -119 -521 -267 -955 -67 -193 -87 -307 -162 -915 -61 -497 -107 -729 -192 -988 -39 -120 -41 -130 -27 -155 19 -35 67 -51 155 -51 102 -1 240 46 301 102 l22 20 30 -32 c24 -26 36 -31 73 -31 87 1 206 67 309 172 253 260 417 757 538 1628 68 487 93 866 94 1415 1 493 -20 818 -79 1200 -114 748 -313 1330 -595 1745 -357 524 -954 872 -1551 904 -51 3 -121 15 -170 30 -149 45 -243 58 -438 61 -102 2 -216 -1 -255 -6z" />
                          </g>
                        </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "curly" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "curly" })}
                       title="Ricci"
                     >
                                               <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
                          {/* Testa */}
                          <circle cx="150" cy="150" r="100" fill="#FDBCB4"/>
                          {/* CAPELLI RICCI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
                          <g fill="#8B4513" stroke="black" strokeWidth="40" transform="translate(25,230) scale(0.06,-0.06)">
                            <path d="M2054 3585 
                              c-80 -17 -136 -46 -195 -102 l-49 -46 -58 26 
                              c-83 38 -154 50 -245 44 
                              -147 -10 -283 -101 -321 -214 
                              -9 -26 -16 -57 -16 -70 
                              0 -21 -4 -23 -48 -23 
                              -154 0 -290 -98 -338 -242 
                              -16 -50 -16 -160 1 -214 
                              6 -19 1 -24 -32 -34 
                              -87 -29 -148 -85 -190 -175 
                              -67 -145 -26 -340 96 -459 
                              l40 -39 -49 -54 
                              c-65 -71 -95 -162 -88 -262 
                              11 -143 86 -240 248 -317 
                              52 -25 104 -50 114 -56 
                              17 -9 18 -7 12 14 
                              -51 175 -60 285 -28 347 
                              9 19 22 36 28 38 
                              6 2 21 -48 37 -125 
                              30 -146 88 -330 109 -344 
                              15 -10 97 -1 114 13 
                              8 7 7 30 -3 87 
                              -9 42 -16 131 -17 197 
                              l-1 120 50 105 
                              c50 105 50 105 51 212 
                              1 102 2 108 31 145 
                              16 21 39 55 52 75 
                              17 29 30 39 59 43 
                              20 4 59 13 85 21 
                              44 14 52 13 115 -7 
                              45 -14 105 -23 184 -26 
                              104 -5 125 -3 205 20 
                              48 14 126 35 171 46 
                              91 23 199 73 275 128 
                              l49 34 74 -36 
                              c44 -22 105 -42 149 -50 
                              124 -21 145 -53 154 -235 
                              7 -132 11 -145 86 -280 
                              39 -70 52 -184 37 -323 
                              -7 -62 -19 -140 -27 -173 
                              -16 -70 -10 -82 55 -94 
                              49 -9 66 3 98 67 
                              37 73 102 295 102 347 
                              0 14 4 26 8 26 
                              33 0 43 -163 17 -260 
                              -8 -30 -15 -56 -15 -57 
                              0 -4 76 11 80 16 
                              3 3 27 16 53 29 
                              211 99 280 384 137 564 
                              -17 20 -30 40 -30 43 
                              0 4 11 21 24 38 
                              13 18 34 61 46 97 
                              51 152 -6 326 -139 421 
                              l-56 40 -1 77 
                              c-1 151 -89 266 -228 297 
                              l-50 11 -13 65 
                              c-41 204 -198 338 -398 339 
                              -44 0 -87 -9 -170 -34 
                              -15 -5 -25 2 -42 27 
                              -33 52 -131 113 -212 131 
                              -82 19 -105 19 -187 1z" 
                            />
                          </g>
                        </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "messy" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "messy" })}
                       title="Spettinati"
                     >
                                               <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
                          {/* Testa */}
                          <circle cx="150" cy="150" r="100" fill="#FDBCB4"/>
                          {/* CAPELLI SPETTINATI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
                          <g
                            transform="translate(27,220) scale(0.035,-0.035)"
                            fill="#8B4513"
                            stroke="black"
                            strokeWidth="90"
                          >
                            <path d="M2918 5295 c3 -5 23 -33 44 -61 21 -28 38 -53 38 -56 0 -3 -84 -8
        -187 -11 -182 -7 -354 -29 -485 -62 -77 -21 -216 -68 -251 -87 l-29 -14 91
        -45 c50 -24 90 -46 90 -49 0 -3 -26 -17 -57 -32 -135 -64 -271 -172 -376 -298
        -162 -193 -267 -439 -301 -700 -14 -108 -8 -133 33 -148 l29 -10 7 -128 c13
        -253 72 -601 119 -706 9 -21 17 -44 17 -52 0 -9 13 -22 30 -31 16 -8 37 -26
        46 -40 9 -13 25 -27 36 -31 11 -3 37 -21 57 -39 38 -34 81 -53 81 -36 0 49 24
        340 36 430 44 346 133 598 255 723 31 32 73 65 92 73 25 10 99 16 273 20 463
        11 718 37 1019 104 72 16 131 28 133 26 1 -1 -30 -39 -69 -84 -39 -46 -68 -85
        -65 -89 4 -3 63 0 132 7 167 16 324 61 474 134 83 41 88 42 185 42 94 0 105
        -2 170 -34 75 -37 176 -126 227 -199 119 -172 196 -427 243 -797 6 -48 25
        -290 25 -317 0 -28 28 -16 110 43 69 51 89 80 109 159 6 25 23 88 36 140 37
        142 67 340 81 533 5 82 7 87 29 87 43 0 49 20 41 164 -10 214 -50 381 -131
        551 -109 227 -283 351 -546 388 -82 12 -82 12 -95 49 -34 99 -136 217 -251
        292 -134 87 -245 121 -505 155 -231 31 -1054 59 -1040 36z" />
                          </g>
                        </svg>
                     </button>
                    
                                         <button
                       className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                         config.hairStyle === "wavy" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                       }`}
                       onClick={() => setConfig({ ...config, hairStyle: "wavy" })}
                       title="Ondulati"
                     >
                                               <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
                          {/* Testa */}
                          <circle cx="150" cy="150" r="100" fill="#FDBCB4"/>
                          {/* CAPELLI ONDULATI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
                          <path
                            d="M90 60 
                               Q110 40 150 45 
                               Q190 40 210 60 
                               Q220 80 215 100 
                               Q210 115 200 120 
                               Q195 100 195 85 
                               Q195 70 180 65 
                               Q165 60 150 62 
                               Q135 60 120 65 
                               Q105 70 105 85 
                               Q105 100 100 120 
                               Q90 115 85 100 
                               Q80 80 90 60 
                               Z"
                            fill="#8B4513"
                            stroke="#000"
                            strokeWidth="3"
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
                                               <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
                          {/* Testa */}
                          <circle cx="150" cy="150" r="100" fill="#FDBCB4"/>
                          {/* CAPELLI RASATI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
                          <g>
                            {/* Ciocca sinistra abbassata con punta più verso l'interno */}
                            <path
                              d="
                                M90 80 
                                Q80 110 90 140 
                                Q95 130 100 110 
                                Q95 90 90 80 
                                Z
                              "
                              fill="#8B4513"
                              stroke="#000"
                              strokeWidth="3"
                            />

                            {/* Ciocca destra abbassata con punta più verso l'interno */}
                            <path
                              d="
                                M210 80 
                                Q220 110 210 140 
                                Q205 130 200 110 
                                Q205 90 210 80 
                                Z
                              "
                              fill="#8B4513"
                              stroke="#000"
                              strokeWidth="3"
                            />
                          </g>
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
                                               <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
                          {/* Testa */}
                          <circle cx="150" cy="150" r="100" fill="#FDBCB4"/>
                          {/* BAFFI CLASSICI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
                          <g transform="translate(111, 193) scale(0.025,-0.018)" fill="#8B4513">
                            <path
                              d="M1410 2042 c0 -7 -12 -10 -30 -8 -16 2 -30 -1 -30 -5 0 -5 -14 -7
        -31 -4 -17 3 -28 2 -25 -3 2 -4 1 -14 -5 -22 -7 -12 -9 -9 -9 9 0 22 -1 23
        -17 9 -10 -9 -24 -13 -32 -10 -8 3 -11 0 -7 -7 5 -7 1 -9 -8 -5 -9 3 -16 1
        -16 -6 0 -6 -4 -9 -9 -5 -5 3 -12 -3 -14 -12 -4 -16 -5 -16 -6 1 -1 14 -4 16
        -14 8 -7 -6 -24 -13 -37 -16 -14 -2 -49 -16 -78 -31 -29 -14 -57 -23 -61 -20
        -5 3 -12 -2 -15 -11 -4 -10 -14 -14 -26 -11 -14 4 -20 0 -20 -13 0 -10 -9 -20
        -20 -23 -11 -3 -20 0 -20 5 0 6 -11 -1 -25 -17 -17 -18 -33 -25 -45 -22 -11 3
        -20 1 -20 -4 0 -4 -6 -6 -14 -3 -9 3 -17 -3 -21 -15 -3 -12 -10 -19 -15 -16
        -5 3 -11 -1 -14 -7 -5 -10 -7 -10 -12 -1 -8 17 -33 -7 -27 -25 4 -8 0 -10 -11
        -6 -16 6 -112 -21 -134 -39 -7 -6 -35 -21 -63 -33 -28 -13 -48 -28 -45 -33 3
        -5 -2 -15 -11 -22 -14 -12 -16 -12 -9 0 6 9 5 12 -5 9 -8 -3 -13 -11 -11 -17
        1 -7 -2 -10 -7 -6 -6 3 -17 -7 -25 -22 -7 -16 -24 -37 -36 -48 -25 -22 -49
        -62 -31 -51 7 5 9 1 5 -8 -3 -9 -9 -14 -13 -12 -4 3 -7 -3 -8 -12 0 -9 -4 -44
        -8 -77 -5 -44 -4 -56 4 -45 9 12 11 11 11 -8 0 -13 4 -21 9 -18 5 4 12 0 14
        -6 4 -10 6 -10 6 0 1 19 19 14 26 -8 8 -26 22 -25 31 3 7 20 8 20 20 -13 7
        -19 13 -30 13 -25 1 13 61 14 61 1 0 -5 6 -3 14 3 11 9 15 9 19 -1 4 -10 6
        -10 6 0 1 10 5 10 17 -2 11 -11 21 -13 32 -7 11 6 24 6 35 0 11 -7 17 -6 17 1
        0 5 7 10 15 10 8 0 15 -5 15 -12 0 -6 3 -8 7 -5 3 4 12 2 19 -4 11 -9 16 -6
        23 12 6 14 10 18 11 9 1 -10 4 -9 10 5 7 17 9 17 9 3 1 -10 8 -18 16 -18 8 0
        15 -5 15 -11 0 -6 14 -1 30 11 28 20 30 20 30 3 0 -14 2 -15 9 -4 5 8 11 9 15
        3 8 -13 35 -9 46 7 5 9 9 10 14 2 4 -6 12 -9 17 -6 5 4 9 0 9 -7 0 -9 3 -9 10
        2 8 13 10 13 10 1 0 -11 4 -9 15 5 14 19 14 19 15 -1 1 -11 4 -14 7 -7 2 6 10
        9 16 5 18 -11 50 -11 70 -1 11 5 17 5 17 -2 0 -17 28 -11 39 8 10 16 10 16 11
        -1 0 -11 4 -15 12 -11 6 4 17 -1 25 -11 12 -18 13 -17 13 6 0 13 4 30 9 38 7
        11 10 9 15 -7 4 -13 13 -19 22 -15 8 3 14 -1 14 -8 1 -10 5 -8 14 4 12 16 17
        16 35 5 12 -7 21 -16 21 -20 0 -5 5 -8 10 -8 6 0 10 8 10 18 0 13 2 14 9 3 6
        -10 11 -6 19 15 10 29 10 29 12 4 1 -14 4 -19 7 -12 7 17 23 15 23 -4 0 -32
        25 -6 31 32 6 36 6 36 8 8 1 -37 20 -57 41 -44 9 6 17 5 22 -3 4 -7 8 8 9 33
        l1 45 12 -45 c10 -37 13 -41 20 -25 6 16 9 17 16 5 7 -12 11 -10 19 10 l10 25
        1 -25 c1 -23 2 -23 10 -5 6 13 9 15 9 5 1 -22 71 -23 72 -1 0 12 2 11 8 -4 8
        -19 8 -19 19 0 11 19 11 19 12 -5 0 -14 4 -20 8 -15 4 6 14 10 22 10 8 0 18
        -4 22 -10 4 -6 8 -1 8 9 0 20 0 20 14 1 14 -19 15 -19 27 7 13 31 29 28 29 -5
        0 -18 2 -19 10 -7 8 12 10 12 16 -4 5 -14 9 -15 15 -4 7 11 11 10 19 -2 8 -12
        10 -11 10 8 0 22 20 32 20 10 0 -9 4 -8 10 2 8 12 10 10 10 -9 0 -18 3 -21 13
        -12 8 6 17 8 20 4 4 -3 7 5 7 18 0 19 2 21 10 9 8 -12 10 -12 11 5 0 13 5 9
        13 -14 8 -23 15 -31 20 -23 4 7 11 10 16 7 5 -3 13 3 19 12 9 16 10 15 11 -7
        0 -14 4 -20 8 -15 10 14 42 18 42 5 0 -6 5 -8 13 -3 6 4 20 6 30 5 9 -2 17 3
        17 10 0 10 3 9 10 -2 9 -13 12 -12 25 4 14 19 15 18 24 -5 7 -18 10 -20 15 -9
        8 20 56 23 56 4 0 -12 4 -12 20 -4 11 6 25 8 30 5 6 -3 10 2 10 12 0 12 3 14
        8 6 10 -16 72 -27 72 -13 0 6 5 8 10 5 6 -3 10 -1 10 4 0 6 7 11 15 11 8 0 15 -6 15 -12
        0 -8 3 -9 8 -3 10 14 62 15 62 1 0 -6 5 -4 10 4 5 8 10 11 10 6 0 -5 8 -2 17
        5 11 10 14 10 9 1 -4 -6 -3 -12 3 -12 5 0 13 4 16 10 3 5 22 8 40 5 30 -3 37
        0 48 22 l14 26 7 -28 7 -28 16 22 c11 16 14 35 10 64 -4 29 -3 36 3 22 5 -11
        9 -32 9 -47 1 -30 21 -40 21 -10 0 14 2 15 10 2 8 -12 10 -10 10 8 0 15 4 21
        12 16 12 -8 7 53 -8 90 -5 14 -4 17 4 12 8 -5 10 -2 6 8 -3 9 -10 16 -16 16
        -5 0 -6 5 -3 10 4 6 -1 23 -11 38 -10 15 -17 32 -15 37 1 6 -1 7 -5 2 -9 -9
        -44 21 -44 38 0 16 -36 40 -72 49 -15 3 -32 15 -38 26 -10 18 -86 60 -108 60
        -5 0 -22 6 -37 14 -15 8 -38 12 -50 10 -13 -2 -27 0 -30 6 -3 5 -1 10 4 10 6
        0 11 5 11 11 0 5 -5 7 -11 3 -6 -3 -15 0 -20 7 -8 12 -10 12 -18 0 -6 -9 -11
        -10 -15 -2 -4 6 -4 11 0 11 3 0 1 6 -5 14 -7 8 -21 12 -33 8 -16 -4 -19 -2
        -13 8 6 10 4 12 -10 7 -11 -5 -24 0 -36 14 -11 12 -19 19 -19 15 0 -4 -6 -1
        -14 7 -9 8 -26 12 -40 10 -26 -5 -37 11 -13 20 7 3 5 6 -6 6 -34 2 -97 26 -97
        37 0 7 -8 10 -20 7 -11 -3 -20 -1 -20 5 0 5 -7 13 -16 16 -8 3 -12 2 -9 -4 9
        -15 -2 -12 -19 6 -9 8 -16 11 -16 5 0 -6 -7 -11 -15 -11 -9 0 -12 6 -8 17 4
        10 2 14 -5 9 -6 -3 -14 -1 -17 5 -4 5 -13 8 -21 5 -8 -3 -14 -1 -14 5 0 5 -11
        7 -25 3 -17 -4 -27 -1 -31 9 -3 9 -13 13 -25 10 -11 -3 -19 0 -19 7 0 10 -3
        10 -14 1 -16 -14 -47 -11 -59 4 -6 6 -10 6 -14 -2 -7 -18 -26 -16 -19 2 3 8 3
        15 0 15 -2 0 -9 -10 -14 -22 l-9 -23 0 23 c-1 22 -2 22 -27 6 -21 -14 -27 -15
        -34 -4 -6 10 -9 7 -12 -11 l-5 -24 -11 25 c-6 14 -11 19 -11 12 -1 -7 -5 -11
        -10 -7 -5 3 -13 0 -17 -6 -4 -8 -9 -7 -15 2 -6 10 -9 7 -9 -11 -1 -25 -1 -25
        -13 -4 -8 14 -20 20 -34 18 -14 -2 -23 1 -23 9 0 8 -4 7 -10 -3 -9 -13 -11
        -13 -20 0 -8 12 -10 12 -10 1 0 -11 -3 -11 -15 -1 -8 7 -15 9 -15 5 0 -4 -7
        -2 -15 5 -12 10 -15 9 -15 -6 -1 -18 -1 -18 -15 0 -8 11 -15 15 -15 8z m515
        -42 c3 -5 1 -10 -4 -10 -6 0 -11 5 -11 10 0 6 2 10 4 10 3 0 8 -4 11 -10z
        m-1595 -667 c-11 -17 -11 -17 -6 0 3 10 6 24 7 30 0 9 2 9 5 0 3 -7 0 -20 -6
        -30z m1467 -15 c-3 -8 -6 -5 -6 6 -1 11 2 17 5 13 3 -3 4 -12 1 -19z"
                              stroke="#000000"
                              strokeWidth="100"
                              strokeLinecap="round"
                            />
                          </g>
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