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

// Rimuove i vecchi Service Worker PWA che possono tenere in cache l'HTML
// e mostrare una build precedente. Non tocca firebase-messaging-sw.js (FCM).
// Il vecchio /sw.js resta disponibile come worker di dismissione per le installazioni pregresse.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (!isNative) {
    window.addEventListener("load", () => {
      void (async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          const legacy = registrations.filter((registration) =>
            [registration.active, registration.waiting, registration.installing]
              .some((worker) => worker && new URL(worker.scriptURL).pathname === "/sw.js")
          );
          const controlledByLegacy = navigator.serviceWorker.controller
            ? new URL(navigator.serviceWorker.controller.scriptURL).pathname === "/sw.js"
            : false;
          const unregistered = await Promise.all(legacy.map((registration) => registration.unregister()));

          if ("caches" in window) {
            const names = await caches.keys();
            await Promise.all(
              names.filter((name) => /^demos-v\d+$/.test(name)).map((name) => caches.delete(name))
            );
          }
          if (controlledByLegacy && unregistered.some(Boolean)) {
            window.location.reload();
          }
        } catch (error) {
          console.warn("Impossibile completare la rimozione della cache PWA precedente:", error);
        }
      })();
    }, { once: true });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
