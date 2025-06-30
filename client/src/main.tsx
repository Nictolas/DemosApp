import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import GestisciGrazia from "./pages/GestisciGrazia";
import Limiti from "./pages/Limiti";
import GestisciGoverno from "./pages/GestisciGoverno";

createRoot(document.getElementById("root")!).render(<App />);
