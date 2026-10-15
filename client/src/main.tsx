import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installNativeApiFetchBridge } from "./lib/native-api-fetch-bridge";
import GestisciGrazia from "./pages/GestisciGrazia";
import Limiti from "./pages/Limiti";
import GestisciGoverno from "./pages/GestisciGoverno";

// Prima di montare React, normalizza le vecchie fetch relative /api nella build
// Capacitor. Sul web il bridge è un no-op.
installNativeApiFetchBridge();

// Inizializza Capacitor se disponibile (app native)
if (typeof window !== 'undefined') {
  try {
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

createRoot(document.getElementById("root")!).render(<App />);
