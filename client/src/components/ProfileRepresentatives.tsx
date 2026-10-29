import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { UserInfo } from "@/types/profile";

interface ProfileRepresentativesProps {
  userInfo: UserInfo | null;
  rappresentantiDetails?: Record<string, any>;
}

export function ProfileRepresentatives({ userInfo, rappresentantiDetails }: ProfileRepresentativesProps) {
  const [representativeNames, setRepresentativeNames] = useState<Record<string, string>>({});
  const [representativeAvatars, setRepresentativeAvatars] = useState<Record<string, any>>({});

  const fetchRepresentativeNames = async (userInfo: any) => {


    
    const representatives = {
      rappresentante_europeo: userInfo.rappresentante_europeo,
      rappresentante_camera: userInfo.rappresentante_camera,
      rappresentante_senato: userInfo.rappresentante_senato,
      rappresentante_regionale: userInfo.rappresentante_regionale,
      rappresentante_comune: userInfo.rappresentante_comune,
    };

    
    const names: Record<string, string> = {};
    const avatars: Record<string, any> = {};
    
    // Mappa delle categorie per i dettagli
    const categoryMap: Record<string, string> = {
      'rappresentante_europeo': 'europeo',
      'rappresentante_camera': 'camera',
      'rappresentante_senato': 'senato',
      'rappresentante_regionale': 'regione',  // Corretto: l'API usa 'regione', non 'regionale'
      'rappresentante_comune': 'comune'
    };
    
    for (const [key, value] of Object.entries(representatives)) {

      
      if (value && typeof value === 'string') {
        // Cerca nei dettagli completi
        const category = categoryMap[key];


        if (rappresentantiDetails && rappresentantiDetails[category] && rappresentantiDetails[category].length > 0) {
          // Cerca il rappresentante con l'ID corrispondente
          const representative = rappresentantiDetails[category].find((r: any) => r.id === value);
          if (representative) {

            names[key] = `${representative.nome} ${representative.cognome}`;
            if (representative.avatar_config) {
              try {
                // Gestisci il caso di doppia serializzazione JSON
                let config;
                if (typeof representative.avatar_config === 'string') {
                  // Prima prova a fare il parse diretto
                  config = JSON.parse(representative.avatar_config);
                  // Se il risultato è ancora una stringa, fai un secondo parse
                  if (typeof config === 'string') {
                    config = JSON.parse(config);
                  }
                } else {
                  config = representative.avatar_config;
                }
                avatars[key] = config;
              } catch (e) {

                avatars[key] = null;
              }
            }
          } else {

            names[key] = "Non selezionato";
          }
        } else {

          names[key] = "Non selezionato";
        }
      } else {

        names[key] = "Non selezionato";
      }
    }


    
    setRepresentativeNames(names);
    setRepresentativeAvatars(avatars);
  };

  useEffect(() => {
    if (userInfo) {
      fetchRepresentativeNames(userInfo);
    }
  }, [userInfo, rappresentantiDetails]);

  if (!userInfo) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-medium">Rappresentanti Selezionati</h3>
        <Link
          href="/rappresentanti"
          className="hidden lg:inline-flex shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
        >
          Scegli Rappresentanti
        </Link>
      </div>
      
      {/* Rappresentante Europeo */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_europeo ? (
            <CustomAvatar config={representativeAvatars.rappresentante_europeo} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Europeo</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_europeo || "Non selezionato"}</p>
        </div>
      </div>

      {/* Rappresentante Camera */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_camera ? (
            <CustomAvatar config={representativeAvatars.rappresentante_camera} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Camera</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_camera || "Non selezionato"}</p>
        </div>
      </div>

      {/* Rappresentante Senato */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_senato ? (
            <CustomAvatar config={representativeAvatars.rappresentante_senato} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Senato</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_senato || "Non selezionato"}</p>
        </div>
      </div>

      {/* Rappresentante Regionale */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_regionale ? (
            <CustomAvatar config={representativeAvatars.rappresentante_regionale} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Regionale</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_regionale || "Non selezionato"}</p>
        </div>
      </div>

      {/* Rappresentante Comunale */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_comune ? (
            <CustomAvatar config={representativeAvatars.rappresentante_comune} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Comunale</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_comune || "Non selezionato"}</p>
        </div>
      </div>
    </div>
  );
}
