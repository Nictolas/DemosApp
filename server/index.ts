import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes.js";
import dotenv from "dotenv";
import { setupAuth } from "./auth.js";

// Carica le variabili d'ambiente all'inizio
dotenv.config();

// Imposta una chiave di sessione di default se non presente
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "demos_application_secret_key_default";
}

const app = express();

// Middleware di base (vengono eseguiti sempre)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
});

// Setup dell'autenticazione (session, passport, etc.)
setupAuth(app);

// Registra tutte le altre rotte API
registerRoutes(app);

// Middleware per la gestione degli errori (deve stare dopo la registrazione delle rotte)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("ERRORE SERVER NON GESTITO:", err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// ===================================================================
// Blocco di esecuzione per SVILUPPO LOCALE (es. su Replit)
// Questo codice NON viene eseguito su Vercel.
// ===================================================================
if (process.env.NODE_ENV === "development") {
  (async () => {
    // Importa Vite dinamicamente solo in sviluppo
    const { setupVite, log } = await import("./vite.js");

    // Crea un server HTTP standard che wrappa l'app Express
    const server = createServer(app);

    // Collega il middleware di Vite per l'hot-reloading
    await setupVite(app, server);

    const port = 5000;
    server.listen(port, () => {
      log(`Server di sviluppo attivo su http://localhost:${port}`);
    });
  })();
}

// ===================================================================
// Esporta l'app Express per VERCEL
// Vercel prenderà questa 'app' e la gestirà come una funzione serverless.
// Non ha bisogno di server.listen().
// ===================================================================
export default app;