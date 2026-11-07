import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Rappresentante } from "../types";
import { getTitolo, getFieldName } from "../utils/rappresentanteUtils";
import { getTitolo as getTitoloCandidati } from "../utils/candidatoUtils";
import { useLocation } from "wouter";
import { provincialOfficeFromCategory, PROVINCIAL_UI_RELEASED } from "@/lib/provincialSelection";

const useOpinioniCheck = (grado: string) => {
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);

  const checkOpinioni = useCallback(async () => {
    if (!grado) return null;

    setIsChecking(true);
    try {
      const response = await apiRequest("GET", `/api/opinioni/check-missing/${grado}`);
      if (response?.ok && response?.data?.success) {
        setCheckResult(response.data.data);
        return response.data.data;
      }
    } catch (error) {
      console.error("Errore nel controllo opinioni:", error);
    } finally {
      setIsChecking(false);
    }
    return null;
  }, [grado]);

  return { checkOpinioni, isChecking, checkResult };
};

const normalizeGrade = (value: unknown) => String(value ?? "").trim().toUpperCase();

const filterEligibleRepresentatives = (rows: Rappresentante[], categoria: string) => {
  const office = provincialOfficeFromCategory(categoria);
  const expectedGrade = normalizeGrade(getTitolo(categoria));

  return rows.filter((rappresentante) => {
    const hasRepresentativeRole = rappresentante.ruolo === "P" || rappresentante.ruolo === "CP";
    // The provincial endpoint has already checked the canonical office,
    // mandate and residence. Do not filter it with legacy grade letters.
    const hasExpectedGrade = !!office || normalizeGrade(rappresentante.grado_elezione) === expectedGrade;
    return hasRepresentativeRole && hasExpectedGrade;
  });
};

export const useRappresentantiData = (user: any, categoria: string) => {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [location] = useLocation();
  const provincialOffice = provincialOfficeFromCategory(categoria);
  const isCandidateRoute = location === "/candidati" || location.startsWith("/candidati/");

  const [rappresentanti, setRappresentanti] = useState<Rappresentante[]>([]);
  const [loading, setLoading] = useState(true);
  const [rappresentanteSelezionato, setRappresentanteSelezionato] = useState<string | null>(null);
  const [showOpinioniAlert, setShowOpinioniAlert] = useState(false);
  const [opinioniAlertData, setOpinioniAlertData] = useState<any>(null);

  const gradoMapping: Record<string, string> = {
    camera: "N",
    senato: "N",
    europeo: "E",
    regione: "R",
    comune: "CO",
    "provinciale-trento": "C",
    "provinciale-bolzano": "C",
  };

  const grado = gradoMapping[categoria] || "N";
  const { checkOpinioni } = useOpinioniCheck(grado);

  useEffect(() => {
    if (!user || !grado || (provincialOffice && !PROVINCIAL_UI_RELEASED)) return;

    checkOpinioni()
      .then((opinioniCheck) => {
        if (opinioniCheck && !opinioniCheck.isComplete) {
          setOpinioniAlertData(opinioniCheck);
          setShowOpinioniAlert(true);
        }
      })
      .catch((error) => {
        console.error("Errore nel controllo opinioni:", error);
      });
  }, [user, grado, checkOpinioni, provincialOffice]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || (provincialOffice && !PROVINCIAL_UI_RELEASED)) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let url: string;

        if (isCandidateRoute) {
          if (provincialOffice) {
            url = `/api/candidati/disponibili?grado_candidatura=${encodeURIComponent(provincialOffice.officeId)}`;
          } else if (categoria === "europeo") {
            url = "/api/candidati/europei";
          } else {
            const gradoCandidatura = getTitoloCandidati(categoria);
            url = `/api/candidati/disponibili?grado_candidatura=${encodeURIComponent(gradoCandidatura)}`;
          }
        } else {
          const gradoElezione = provincialOffice?.officeId || getTitolo(categoria);
          url = `/api/rappresentanti/disponibili?grado_elezione=${encodeURIComponent(gradoElezione)}`;
        }

        const response = await apiRequest("GET", url);
        const result = response?.data;

        if (!response?.ok || !result?.success) {
          throw new Error(result?.error || result?.message || "Errore nel caricamento dei dati dal server.");
        }

        if (isCandidateRoute) {
          const candidati = result.data || [];

          try {
            if (provincialOffice) {
              const selectionResponse = await apiRequest("GET",
                `/api/users/${user.id}/provincial-selection?kind=candidate&officeId=${encodeURIComponent(provincialOffice.officeId)}`);
              setRappresentanteSelezionato(selectionResponse.data?.selection?.selectedUserId || null);
            } else {
            const selezioniResponse = await apiRequest("GET", "/api/elezioni/candidati");
            const selezioniResult = selezioniResponse?.data;
            if (selezioniResponse?.ok && selezioniResult?.success) {
              const candidatoSelezionato = selezioniResult.data?.candidati?.[categoria]?.[0];
              setRappresentanteSelezionato(candidatoSelezionato?.id || null);
            }
            }
          } catch (error) {
            console.warn("Impossibile recuperare la selezione candidato corrente:", error);
            setRappresentanteSelezionato(null);
          }

          setRappresentanti(candidati);
        } else {
          const { candidati, utente } = result.data || {};
          const candidatiRicevuti: Rappresentante[] = Array.isArray(candidati) ? candidati : [];
          const rappresentantiValidi = filterEligibleRepresentatives(candidatiRicevuti, categoria);

          if (rappresentantiValidi.length !== candidatiRicevuti.length) {
            console.warn("⚠️ Rimossi rappresentanti non coerenti con ruolo/grado", {
              categoria,
              ricevuti: candidatiRicevuti.length,
              validi: rappresentantiValidi.length,
            });
          }

          if (provincialOffice) {
            const selectionResponse = await apiRequest("GET",
              `/api/users/${user.id}/provincial-selection?kind=representative&officeId=${encodeURIComponent(provincialOffice.officeId)}`);
            setRappresentanteSelezionato(selectionResponse.data?.selection?.selectedUserId || null);
          } else {
            const fieldName = getFieldName(categoria, false);
            setRappresentanteSelezionato(utente?.[fieldName] || null);
          }
          setRappresentanti(rappresentantiValidi);
        }
      } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
        toastRef.current({
          title: "Errore",
          description: isCandidateRoute
            ? "Impossibile caricare i candidati."
            : "Impossibile caricare i rappresentanti.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, categoria, isCandidateRoute, provincialOffice]);

  return {
    rappresentanti,
    loading,
    rappresentanteSelezionato,
    setRappresentanteSelezionato,
    showOpinioniAlert,
    setShowOpinioniAlert,
    opinioniAlertData,
  };
};
