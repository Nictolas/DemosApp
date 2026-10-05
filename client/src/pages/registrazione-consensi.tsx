import React, { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ITALY_DATA } from "@/data/italyData";
import { ItalyMapButton } from "@/components/ItalyMapButton";
import { ItalyFlagButton } from "@/components/ItalyFlagButton";
import { SanMarinoFlagButton } from "@/components/SanMarinoFlagButton";
import { SwitzerlandFlagButton } from "@/components/SwitzerlandFlagButton";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export default function RegistrazioneConsensiWizard() {
  const [location, navigate] = useLocation();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>(1);

  // Stato locale per la residenza (riusato negli step 7-10)
  const [paeseResidenza, setPaeseResidenza] = useState<string>(() => {
    return typeof window !== "undefined"
      ? localStorage.getItem("registrazione_paese_residenza") || "Italia"
      : "Italia";
  });
  const [regioneResidenza, setRegioneResidenza] = useState<string>("");
  const [provinciaResidenza, setProvinciaResidenza] = useState<string>("");
  const [comuneResidenza, setComuneResidenza] = useState<string>("");
  // Effetto "press" stile Preferiti (solo estetico, non blocca il click/tap)
  const handlePressStart = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add("scale-95", "shadow-md");
  };

  const handlePressEnd = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove("scale-95", "shadow-md");
  };

  // Allineamento iniziale sullo step (partenza sempre da 1 per evitare comportamenti legacy strani)
  useEffect(() => {
    const stepFromQuery = searchParams.get("step");
    const stepNum = stepFromQuery ? parseInt(stepFromQuery, 10) : NaN;

    if (!isNaN(stepNum) && stepNum >= 1 && stepNum <= 8) {
      setStep(stepNum as Step);
      return;
    }

    if (location.includes("termini")) {
      setStep(2);
    } else if (location.includes("opinioni")) {
      setStep(3);
    } else {
      setStep(1);
    }
  }, [location, searchParams]);

  const isPasskeyFlow = () =>
    typeof window !== "undefined" && !!window.localStorage.getItem("registrazione_passkey_flow");

  const handleNext = () => {
    if (step === 1) {
      localStorage.setItem("registrazione_privacy_consent", "true");
      setStep(2);
      return;
    }
    if (step === 2) {
      localStorage.setItem("registrazione_terms_consent", "true");
      setStep(3);
      return;
    }
    if (step === 3) {
      localStorage.setItem("registrazione_political_opinions_consent", "true");
      localStorage.setItem("registrazione_passkey_flow", "1");
      // Vai alla cittadinanza
      setStep(4);
      return;
    }
    if (step === 4) {
      // Dopo aver scelto la cittadinanza andiamo al Paese di residenza
      if (!isPasskeyFlow()) {
        navigate("/registrazione-3-residenza");
        return;
      }
      setStep(5);
      return;
    }
    if (step === 5) {
      if (!paeseResidenza) return;
      localStorage.setItem("registrazione_paese_residenza", paeseResidenza);
      setStep(6);
      return;
    }
    if (step === 6) {
      if (!regioneResidenza) return;
      localStorage.setItem("registrazione_regione_residenza", regioneResidenza);
      setStep(7);
      return;
    }
    if (step === 7) {
      if (!provinciaResidenza) return;
      localStorage.setItem("registrazione_provincia_residenza", provinciaResidenza);
      setStep(8);
      return;
    }
    if (step === 8) {
      if (!comuneResidenza) return;
      localStorage.setItem("registrazione_comune_residenza", comuneResidenza);

      // Flusso passkey: salva profilo locale e vai alla creazione passkey
      if (typeof window !== "undefined" && isPasskeyFlow()) {
        const profiloLocale = {
          cittadinanza: localStorage.getItem("registrazione_cittadinanza"),
          paese_residenza: localStorage.getItem("registrazione_paese_residenza"),
          regione_residenza: localStorage.getItem("registrazione_regione_residenza"),
          provincia_residenza: localStorage.getItem("registrazione_provincia_residenza"),
          comune_residenza: localStorage.getItem("registrazione_comune_residenza"),
        };
        try {
          window.localStorage.setItem("profilo_locale", JSON.stringify(profiloLocale));
        } catch (_) {}
        navigate("/registrazione-crea-passkey");
        return;
      }

      // Fallback sicurezza: se non è flusso passkey, vai alla vecchia pagina
      navigate("/registrazione-3-residenza");
    }
  };

  const handleBack = () => {
    if (step === 1) {
      navigate("/auth");
    } else if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      // Torna al consenso opinioni politiche
      setStep(3);
    } else if (step === 5) {
      // Torna alla cittadinanza
      setStep(4);
    } else if (step === 6) {
      setStep(5);
    } else if (step === 7) {
      setStep(6);
    } else if (step === 8) {
      setStep(7);
    }
  };

  const step1Content = (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        <p className="text-sm text-gray-500 mt-1">1 di 8</p>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Informativa sulla privacy
      </h2>
      <p className="text-gray-600 text-sm mb-6">
        Leggi come trattiamo i tuoi dati personali, i tuoi diritti (accesso, rettifica, cancellazione) 
        e come puoi revocare il consenso. Accettando, dichiari di aver letto e compreso l&apos;informativa.
      </p>
      <Button
        type="button"
        className="w-full h-12 text-lg font-semibold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md mb-4"
        onClick={handleNext}
      >
        Accetto
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full text-sm"
        onClick={() => navigate("/privacy-policy?from=/registrazione-consensi-privacy")}
      >
        Leggi la Privacy Policy
      </Button>
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Indietro
        </Button>
      </div>
    </div>
  );

  const step2Content = (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        <p className="text-sm text-gray-500 mt-1">2 di 8</p>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Termini di servizio
      </h2>
      <p className="text-gray-600 text-sm mb-6">
        Leggi le condizioni d&apos;uso della piattaforma Demos: regole, responsabilità e 
        utilizzo del servizio. Accettando, dichiari di aver letto e di accettare i termini.
      </p>
      <Button
        type="button"
        className="w-full h-12 text-lg font-semibold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md mb-4"
        onClick={handleNext}
      >
        Accetto
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full text-sm"
        onClick={() => navigate("/terms-of-service?from=/registrazione-consensi-termini")}
      >
        Leggi i Termini di Servizio
      </Button>
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Indietro
        </Button>
      </div>
    </div>
  );

  const step3Content = (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        <p className="text-sm text-gray-500 mt-1">3 di 8</p>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Consenso opinioni politiche
      </h2>
      <p className="text-gray-600 text-sm mb-4">
        <strong>Consento esplicitamente</strong> al trattamento delle mie opinioni politiche (GDPR Art. 9). 
        Questo consenso è necessario per esprimere opinioni e votare sulla piattaforma. 
        Puoi revocarlo in qualsiasi momento dalle impostazioni; in quel caso alcune funzionalità saranno limitate.
      </p>
      <Button
        type="button"
        className="w-full h-12 text-lg font-semibold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md mb-4"
        onClick={handleNext}
      >
        Accetto
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full text-sm"
        onClick={() => navigate("/privacy-policy?from=/registrazione-consensi-opinioni#4.1")}
      >
        Maggiori informazioni
      </Button>
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Indietro
        </Button>
      </div>
    </div>
  );

  const step5Content = (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        <p className="text-sm text-gray-500 mt-1">4 di 8</p>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Cittadinanza
      </h2>
      <div className="flex flex-col items-center gap-3 mb-2">
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mx-auto">
          <SanMarinoFlagButton
            label="San Marino"
            onClick={() => {
              localStorage.setItem("registrazione_cittadinanza", "sm");
              setStep(5);
            }}
          />
          <SwitzerlandFlagButton
            label="Svizzera"
            onClick={() => {
              localStorage.setItem("registrazione_cittadinanza", "ch");
              setStep(5);
            }}
          />
        </div>
        <ItalyFlagButton
          label="Italiana"
          onClick={() => {
            localStorage.setItem("registrazione_cittadinanza", "Italiana");
            setStep(5);
          }}
        />
      </div>
      <p className="text-xs text-gray-500 text-center mb-2">
        Scegli la cittadinanza.
      </p>
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Indietro
        </Button>
      </div>
    </div>
  );

  // Step 7: Paese di residenza
  const step7Content = (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        <p className="text-sm text-gray-500 mt-1">5 di 8</p>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        In quale Paese hai la residenza?
      </h2>
      <p className="text-gray-600 text-sm mb-4">
        Registrazione disponibile per residenti in Italia, San Marino e Svizzera (Canton Ticino).
      </p>
      <div className="flex flex-col items-center gap-3 mb-2">
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mx-auto">
          <SanMarinoFlagButton
            label="San Marino"
            onClick={() => {
              setPaeseResidenza("San Marino");
              setRegioneResidenza("");
              setProvinciaResidenza("");
              setComuneResidenza("");
              localStorage.setItem("registrazione_paese_residenza", "San Marino");
              localStorage.removeItem("registrazione_regione_residenza");
              localStorage.removeItem("registrazione_provincia_residenza");
              localStorage.removeItem("registrazione_comune_residenza");
              setStep(6);
            }}
          />
          <SwitzerlandFlagButton
            label="Svizzera"
            onClick={() => {
              setPaeseResidenza("Svizzera");
              setRegioneResidenza("");
              setProvinciaResidenza("");
              setComuneResidenza("");
              localStorage.setItem("registrazione_paese_residenza", "Svizzera");
              localStorage.removeItem("registrazione_regione_residenza");
              localStorage.removeItem("registrazione_provincia_residenza");
              localStorage.removeItem("registrazione_comune_residenza");
              setStep(6);
            }}
          />
        </div>
        <ItalyFlagButton
          label="Italia"
          onClick={() => {
            setPaeseResidenza("Italia");
            setRegioneResidenza("");
            setProvinciaResidenza("");
            setComuneResidenza("");
            localStorage.setItem("registrazione_paese_residenza", "Italia");
            localStorage.removeItem("registrazione_regione_residenza");
            localStorage.removeItem("registrazione_provincia_residenza");
            localStorage.removeItem("registrazione_comune_residenza");
            setStep(6);
          }}
        />
      </div>
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Indietro
        </Button>
      </div>
    </div>
  );

  // Helper per options di regioni/province/comuni (in base al paese selezionato)
  const countryData = (ITALY_DATA as Record<string, { regioni: typeof ITALY_DATA.Italia.regioni }>)[paeseResidenza];
  const regioni = countryData?.regioni ?? [];
  const regioneSelezionata = regioni.find((r) => r.nome === regioneResidenza) || null;
  const province = regioneSelezionata?.province || [];
  const provinciaSelezionata = province.find((p) => p.nome === provinciaResidenza) || null;
  const comuni = provinciaSelezionata?.comuni || [];

  // Step 8: Regione
  const step8Content = (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        <p className="text-sm text-gray-500 mt-1">6 di 8</p>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        In quale Regione hai la residenza?
      </h2>
      <div
        className="grid grid-cols-3 gap-3 mb-4 overflow-y-auto overflow-x-hidden max-h-[50vh] overscroll-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {regioni.map((regione) => {
          const isSelected = regioneResidenza === regione.nome;
          return (
            <button
              key={regione.nome}
              type="button"
              className={`text-xs font-medium rounded-lg border px-2 py-2 flex items-center justify-center text-center transition-colors ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => {
                const val = regione.nome;
                setRegioneResidenza(val);
                setProvinciaResidenza("");
                setComuneResidenza("");
                localStorage.setItem("registrazione_regione_residenza", val);
                localStorage.removeItem("registrazione_provincia_residenza");
                localStorage.removeItem("registrazione_comune_residenza");
              }}
            >
              {regione.nome}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        className="w-full h-12 text-lg font-semibold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
        onClick={handleNext}
        disabled={!regioneResidenza}
      >
        Continua
      </Button>
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Indietro
        </Button>
      </div>
    </div>
  );

  // Step 9: Provincia
  const step9Content = (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        <p className="text-sm text-gray-500 mt-1">7 di 8</p>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        In quale Provincia hai la residenza?
      </h2>
      <div
        className="grid grid-cols-2 gap-3 mb-4 overflow-y-auto overflow-x-hidden max-h-[50vh] overscroll-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {province.map((provincia) => {
          const isSelected = provinciaResidenza === provincia.nome;
          return (
            <button
              key={provincia.nome}
              type="button"
              className={`text-xs font-medium rounded-lg border px-2 py-2 flex items-center justify-center text-center transition-colors ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => {
                const val = provincia.nome;
                setProvinciaResidenza(val);
                setComuneResidenza("");
                localStorage.setItem("registrazione_provincia_residenza", val);
                localStorage.removeItem("registrazione_comune_residenza");
              }}
            >
              {provincia.nome}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        className="w-full h-12 text-lg font-semibold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
        onClick={handleNext}
        disabled={!provinciaResidenza}
      >
        Continua
      </Button>
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Indietro
        </Button>
      </div>
    </div>
  );

  // Step 10: Comune
  const step10Content = (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        <p className="text-sm text-gray-500 mt-1">8 di 8</p>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        In quale Comune hai la residenza?
      </h2>
      <p className="text-gray-600 text-sm mb-4">
        Ci serve per sapere quali candidati e politici comunali proporti.
      </p>
      <div
        className="grid grid-cols-3 gap-3 mb-4 overflow-y-auto overflow-x-hidden max-h-[50vh] overscroll-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {comuni.map((comune) => {
          const isSelected = comuneResidenza === comune;
          return (
            <button
              key={comune}
              type="button"
              className={`text-xs font-medium rounded-lg border px-2 py-2 flex items-center justify-center text-center transition-colors ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => {
                setComuneResidenza(comune);
                localStorage.setItem("registrazione_comune_residenza", comune);
              }}
            >
              {comune}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        className="w-full h-12 text-lg font-semibold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
        onClick={handleNext}
        disabled={!comuneResidenza}
      >
        Continua
      </Button>
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Indietro
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 overflow-x-hidden overflow-y-auto">
      {/* Contenitore orizzontale: ogni step è un intero riquadro che scorre */}
      <div className="w-full max-w-md overflow-x-hidden min-h-0">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${(step - 1) * 100}%)` }}
        >
          <div
            className="w-full shrink-0 grow-0 basis-full flex justify-center transition-transform duration-300 ease-out"
            style={{ transform: `scale(${step === 1 ? 1 : 0.8})` }}
          >
            {step1Content}
          </div>
          <div
            className="w-full shrink-0 grow-0 basis-full flex justify-center transition-transform duration-300 ease-out"
            style={{ transform: `scale(${step === 2 ? 1 : 0.8})` }}
          >
            {step2Content}
          </div>
          <div
            className="w-full shrink-0 grow-0 basis-full flex justify-center transition-transform duration-300 ease-out"
            style={{ transform: `scale(${step === 3 ? 1 : 0.8})` }}
          >
            {step3Content}
          </div>
          <div
            className="w-full shrink-0 grow-0 basis-full flex justify-center transition-transform duration-300 ease-out"
            style={{ transform: `scale(${step === 4 ? 1 : 0.8})` }}
          >
            {step5Content}
          </div>
          <div
            className="w-full shrink-0 grow-0 basis-full flex justify-center transition-transform duration-300 ease-out"
            style={{ transform: `scale(${step === 5 ? 1 : 0.8})` }}
          >
            {step7Content}
          </div>
          <div
            className="w-full shrink-0 grow-0 basis-full flex justify-center transition-transform duration-300 ease-out"
            style={{ transform: `scale(${step === 6 ? 1 : 0.8})` }}
          >
            {step8Content}
          </div>
          <div
            className="w-full shrink-0 grow-0 basis-full flex justify-center transition-transform duration-300 ease-out"
            style={{ transform: `scale(${step === 7 ? 1 : 0.8})` }}
          >
            {step9Content}
          </div>
          <div
            className="w-full shrink-0 grow-0 basis-full flex justify-center transition-transform duration-300 ease-out"
            style={{ transform: `scale(${step === 8 ? 1 : 0.8})` }}
          >
            {step10Content}
          </div>
        </div>
      </div>
    </div>
  );
}

