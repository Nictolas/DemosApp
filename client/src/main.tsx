import React from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";
import GestisciGrazia from "./pages/GestisciGrazia";
import Limiti from "./pages/Limiti";
import GestisciGoverno from "./pages/GestisciGoverno";
import { assertLivePrivacyStartupReady } from "./lib/privacy/livePrivacyStartupGuard";

// Inizializza Capacitor se disponibile (app native)
if (typeof window !== 'undefined') {
  try {
    // Capacitor si auto-inizializza, ma possiamo verificare che sia disponibile
    if ((window as any).Capacitor) {
      console.log('✅ Capacitor inizializzato');
    }
  } catch (error) {
    console.debug('Capacitor non disponibile (modalità web)');
  }
}

// Service Worker temporaneamente disabilitato per risolvere problemi di cache
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js')
//       .then((registration) => {
//         console.log('SW registrato con successo:', registration.scope);
//       })
//       .catch((registrationError) => {
//         console.log('Registrazione SW fallita:', registrationError);
//       });
//   });
// }

assertLivePrivacyStartupReady();
createRoot(document.getElementById("root")!).render(<App />);
