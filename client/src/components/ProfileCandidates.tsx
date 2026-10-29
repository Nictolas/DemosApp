import { useMemo } from "react";
import { Link } from "wouter";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { UserInfo } from "@/types/profile";

interface ProfileCandidatesProps {
  userInfo: UserInfo | null;
  candidatiDetails?: Record<string, any>;
  canEditSelections?: boolean;
  showHeading?: boolean;
}

export function ProfileCandidates({ userInfo, candidatiDetails, canEditSelections = true, showHeading = true }: ProfileCandidatesProps) {
  // I nomi e gli avatar derivano esclusivamente dai dati già ricevuti:
  // calcolarli durante il render evita un secondo aggiornamento visivo.
  const { names: candidateNames, avatars: candidateAvatars } = useMemo(() => {
    if (!userInfo) return {
      names: {} as Record<string, string>,
      avatars: {} as Record<string, any>,
    };
    const profile = userInfo as any;


    
    const candidates = {
      candidato_europeo: profile.candidato_europeo,
      candidato_camera: profile.candidato_camera,
      candidato_senato: profile.candidato_senato,
      candidato_regionale: profile.candidato_regionale,
      candidato_comune: profile.candidato_comune,
    };

    
    const names: Record<string, string> = {};
    const avatars: Record<string, any> = {};
    
    // Mappa delle categorie per i dettagli
    const categoryMap: Record<string, string> = {
      'candidato_europeo': 'europeo',
      'candidato_camera': 'camera',
      'candidato_senato': 'senato',
      'candidato_regionale': 'regione',  // Corretto: era 'regionale'
      'candidato_comune': 'comune'
    };
    
    for (const [key, value] of Object.entries(candidates)) {

      
      if (value && typeof value === 'string') {
        // Cerca nei dettagli completi
        const category = categoryMap[key];


        
        if (candidatiDetails && candidatiDetails[category] && candidatiDetails[category].length > 0) {
          // Cerca il candidato con l'ID corrispondente
          const candidate = candidatiDetails[category].find((c: any) => c.id === value);
          if (candidate) {

            names[key] = `${candidate.nome} ${candidate.cognome}`;
            if (candidate.avatar_config) {
              try {
                // Gestisci il caso di doppia serializzazione JSON
                let config;
                if (typeof candidate.avatar_config === 'string') {
                  // Prima prova a fare il parse diretto
                  config = JSON.parse(candidate.avatar_config);
                  // Se il risultato è ancora una stringa, fai un secondo parse
                  if (typeof config === 'string') {
                    config = JSON.parse(config);
                  }
                } else {
                  config = candidate.avatar_config;
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


    
    return { names, avatars };
  }, [userInfo, candidatiDetails]);

  if (!userInfo) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        {showHeading && <h3 className="text-lg font-medium">Candidati Selezionati</h3>}
        {canEditSelections && (
          <Link
          href="/candidati"
          className="inline-flex shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
        >
          Scegli Candidati
          </Link>
        )}
      </div>
      
      {/* Candidato Europeo */}
      <div className="flex items-center gap-2 py-1">
        <div className="w-9 h-9 shrink-0">
          {candidateAvatars.candidato_europeo ? (
            <CustomAvatar config={candidateAvatars.candidato_europeo} size={36} />
          ) : (
            <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Candidato Europeo</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_europeo || "Non selezionato"}</p>
        </div>
      </div>

      {/* Candidato Camera */}
      <div className="flex items-center gap-2 py-1">
        <div className="w-9 h-9 shrink-0">
          {candidateAvatars.candidato_camera ? (
            <CustomAvatar config={candidateAvatars.candidato_camera} size={36} />
          ) : (
            <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Candidato Camera</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_camera || "Non selezionato"}</p>
        </div>
      </div>

      {/* Candidato Senato */}
      <div className="flex items-center gap-2 py-1">
        <div className="w-9 h-9 shrink-0">
          {candidateAvatars.candidato_senato ? (
            <CustomAvatar config={candidateAvatars.candidato_senato} size={36} />
          ) : (
            <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Candidato Senato</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_senato || "Non selezionato"}</p>
        </div>
      </div>

      {/* Candidato Regionale */}
      <div className="flex items-center gap-2 py-1">
        <div className="w-9 h-9 shrink-0">
          {candidateAvatars.candidato_regionale ? (
            <CustomAvatar config={candidateAvatars.candidato_regionale} size={36} />
          ) : (
            <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Candidato Regionale</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_regionale || "Non selezionato"}</p>
        </div>
      </div>

      {/* Candidato Comunale */}
      <div className="flex items-center gap-2 py-1">
        <div className="w-9 h-9 shrink-0">
          {candidateAvatars.candidato_comune ? (
            <CustomAvatar config={candidateAvatars.candidato_comune} size={36} />
          ) : (
            <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Candidato Comunale</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_comune || "Non selezionato"}</p>
        </div>
      </div>
    </div>
  );
}
