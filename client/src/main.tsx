import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import GestisciGrazia from "./pages/GestisciGrazia";
import Limiti from "./pages/Limiti";
import GestisciGoverno from "./pages/GestisciGoverno";

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
