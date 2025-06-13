import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";

// ===== IMPORT DAI NUOVI SERVIZI SPECIALIZZATI =====
import UserService from "./user.service";
import VotoService from "./voto.service";
import AdminService from "./admin.service";
import ComunicazioneService from "./comunicazione.service";
import ElezioneService from "./elezione.service";
import ComizioService from "./comizio.service";
import NotificaService from "./notifica.service";

// La logica di 'storage' e 'db' locale è mantenuta se serve per altro.
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes (Passport.js, etc.)
  setupAuth(app);

  // Middleware di autenticazione per le rotte protette
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Non autenticato" });
    }
    next();
  };

  // Middleware per le rotte da amministratore
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || req.user?.ruolo !== 'Admin') {
      return res.status(403).json({ error: "Accesso negato. Riservato agli amministratori." });
    }
    next();
  };

  // =========================================================
  // ROTTE UTENTE (gestite da UserService)
  // =========================================================

  // Ottieni tutti gli utenti
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const users = await UserService.getAllUsers();
      return res.status(200).json(users);
    } catch (error) {
      return res.status(500).json({ error: 'Errore nel recupero utenti' });
    }
  });

  // Ottieni un singolo utente tramite email
  app.get('/api/users/:email', requireAuth, async (req, res) => {
    try {
      const userData = await UserService.getUserByEmail(decodeURIComponent(req.params.email));
      if (!userData) return res.status(404).json({ error: 'Utente non trovato' });
      return res.status(200).json(userData);
    } catch (error) {
      return res.status(500).json({ error: 'Errore nel recupero utente' });
    }
  });

  // Aggiorna un utente
  app.put('/api/users/:email', requireAuth, async (req, res) => {
    try {
      const { email } = req.params;
      const isOwnProfile = req.user?.email === email;
      const isAdmin = req.user?.ruolo === 'Admin';
      if (!isOwnProfile && !isAdmin) return res.status(403).json({ error: 'Permessi non sufficienti' });

      const result = await UserService.updateUserData(email, req.body);
      if (!result.success) return res.status(500).json({ error: result.error });

      return res.status(200).json({ message: 'Profilo aggiornato', data: result.data });
    } catch (error) {
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Salva/Aggiorna la configurazione dell'avatar
  app.post('/api/users/:email/avatar', requireAuth, async (req, res) => {
    try {
      const { email } = req.params;
      const { avatar_config } = req.body;
      const result = await UserService.updateUserData(decodeURIComponent(email), { avatar_config });
      if (!result.success) return res.status(500).json({ error: result.error });
      res.json({ success: true, message: 'Configurazione avatar salvata' });
    } catch (error) {
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Salva le opinioni di un utente
  app.post('/api/opinioni', requireAuth, async (req, res) => {
    try {
      const result = await UserService.saveUserOpinions(req.user!.email!, req.body);
      if (!result.success) return res.status(500).json({ error: result.error });
      return res.status(200).json({ message: 'Opinioni salvate', data: result.data });
    } catch (error) {
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Ottieni le opinioni dell'utente loggato
  app.get('/api/opinioni', requireAuth, async (req, res) => {
    try {
      const opinions = await UserService.getUserOpinions(req.user!.email!);
      return res.status(200).json(opinions || {});
    } catch (error) {
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Recupera i candidati
  app.get('/api/candidati', requireAuth, async (req, res) => {
    try {
      const candidati = await UserService.getCandidati();
      return res.status(200).json(candidati);
    } catch (error) {
      return res.status(500).json({ error: 'Errore nel recupero candidati' });
    }
  });

  // Cerca politici
  app.get('/api/search-politicians', requireAuth, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') return res.status(400).json({ error: 'Query mancante' });
      const politicians = await UserService.searchPoliticians(q);
      return res.status(200).json(politicians);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // =========================================================
  // ROTTE VOTO (gestite da VotoService)
  // =========================================================

  // --- Governo Ideale ---
  app.post('/api/governo/vota', requireAuth, async (req, res) => {
      const { categoria, nomeMinistro } = req.body;
      const result = await VotoService.voteMinistro(req.user!.uid!, categoria, nomeMinistro);
      if (!result.success) return res.status(500).json({ error: result.error });
      return res.status(200).json({ message: 'Voto registrato' });
  });

  app.get('/api/governo/voti', requireAuth, async (req, res) => {
      const voti = await VotoService.getUserVotiMinistri(req.user!.uid!);
      return res.status(200).json(voti);
  });

  app.get('/api/governo/classifiche', async (req, res) => {
      const classifiche = await VotoService.getAllClassificheMinistri();
      return res.status(200).json(classifiche);
  });

  // --- Capo di Stato, Grazia, Amnistia, Iniziative, Referendum ---
  // Questo schema si ripete per tutte le categorie di voto
  const setupVotingRoutes = (app: Express, category: string, service: typeof VotoService) => {
    const basePath = `/api/${category}`;
    const entityName = category === 'amnistia' ? 'legge' : 'nome';

    app.post(`${basePath}/vota`, requireAuth, async (req, res) => {
      const { [entityName]: name } = req.body;
      const result = await (service as any)[`vote${capitalize(category)}`](req.user!.uid!, name);
      if (!result.success) return res.status(500).json({ error: result.error });
      return res.status(200).json({ message: "Voto registrato" });
    });

    app.get(`${basePath}/voti`, requireAuth, async (req, res) => {
      const voti = await (service as any)[`getUserVoti${capitalize(category)}`](req.user!.uid!);
      return res.status(200).json(voti);
    });

    app.delete(`${basePath}/voti/:name`, requireAuth, async (req, res) => {
      const result = await (service as any)[`removeVote${capitalize(category)}`](req.user!.uid!, decodeURIComponent(req.params.name));
      if (!result.success) return res.status(404).json({ error: result.error });
      return res.status(200).json({ message: "Voto rimosso" });
    });

    app.get(`${basePath}/classifica`, async (req, res) => {
      const classifica = await (service as any)[`getClassifica${capitalize(category)}`]();
      return res.status(200).json(classifica);
    });
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/i$/, 'o'); // Gestisce capo-stato, grazia ecc.

  setupVotingRoutes(app, 'capoDiStato', VotoService);
  setupVotingRoutes(app, 'grazia', VotoService);
  setupVotingRoutes(app, 'amnistia', VotoService);
  setupVotingRoutes(app, 'iniziativaPopolare', VotoService);
  setupVotingRoutes(app, 'referendumAbrogativo', VotoService);

  // =========================================================
  // ROTTE AMMINISTRAZIONE (gestite da AdminService)
  // =========================================================

  app.delete('/api/users/:email', requireAdmin, async (req, res) => {
    const result = await AdminService.deleteUserByEmail(req.params.email);
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.status(200).json({ message: 'Utente eliminato' });
  });

  app.get('/api/pending-users', requireAdmin, async (req, res) => {
    const users = await AdminService.getPendingUsers();
    return res.status(200).json(users);
  });

  app.post('/api/approve-user', requireAdmin, async (req, res) => {
    const result = await AdminService.approveUser(req.body.userId);
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.status(200).json({ message: 'Utente approvato' });
  });

  app.post('/api/reject-user', requireAdmin, async (req, res) => {
    const result = await AdminService.rejectUser(req.body.userId, req.body.reason);
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.status(200).json({ message: 'Utente rifiutato' });
  });

  // ... e così via per le richieste premium, claim profilo ecc.

  // =========================================================
  // ROTTE COMUNICAZIONI (gestite da ComunicazioneService)
  // =========================================================

  app.post('/api/comunicazioni', requireAuth, async (req, res) => {
    const result = await ComunicazioneService.createComunicazione(req.user!, req.body);
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.status(201).json(result);
  });

  app.get('/api/podio-trasparenza', async (req, res) => {
    const podio = await ComunicazioneService.getPodioTrasparenza();
    return res.status(200).json(podio);
  });

  app.post('/api/comunicazioni/:id/react', requireAuth, async (req, res) => {
    const result = await ComunicazioneService.reactToComunicazione(req.params.id, req.user!.uid!, req.body.reaction);
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.status(200).json({ message: 'Reazione registrata' });
  });

  // =========================================================
  // ROTTE NOTIFICHE (gestite da NotificaService)
  // =========================================================

  app.get('/api/notifiche', requireAuth, async (req, res) => {
    const notifiche = await NotificaService.getUserNotifications(req.user!.uid!);
    return res.status(200).json(notifiche);
  });

  app.patch('/api/notifiche/:id/read', requireAuth, async (req, res) => {
    const result = await NotificaService.markNotificationAsRead(req.params.id, req.user!.uid!);
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.status(200).json({ message: 'Notifica letta' });
  });

  // =========================================================
  // ROTTE ELEZIONI, COMIZI, ECC.
  // =========================================================

  app.get('/api/elezioni', requireAuth, async (req, res) => {
    const elezioni = await ElezioneService.getAllElezioni();
    return res.status(200).json(elezioni);
  });

  app.post('/api/comizi', requireAuth, async (req, res) => {
      const result = await ComizioService.saveComizio(req.body, req.user!);
      if(!result.success) return res.status(500).json({ error: result.error });
      return res.status(201).json(result.data);
  });

  app.get('/api/comizi', async (req, res) => {
      const comizi = await ComizioService.getAllComizi();
      return res.status(200).json(comizi);
  });

  // Crea e restituisce il server HTTP
  const httpServer = createServer(app);
  return httpServer;
}