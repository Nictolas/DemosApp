import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth.js"; 

// Importa tutti i servizi con l'estensione .js
import UserService from "./user.service.js";
import VotoService from "./voto.service.js";
import AdminService from "./admin.service.js";
import ComunicazioneService from "./comunicazione.service.js";
import ElezioneService from "./elezione.service.js";
import ComizioService from "./comizio.service.js";
import NotificaService from "./notifica.service.js";
import { storage } from "./storage.js";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Non autenticato" });
    }
    next();
  };

  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || req.user?.ruolo !== 'Admin') {
      return res.status(403).json({ error: "Accesso negato. Riservato agli amministratori." });
    }
    next();
  };

  // =========================================================
  // ROTTE UTENTE (gestite da UserService)
  // =========================================================
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const users = await UserService.getAllUsers();
      return res.status(200).json(users);
    } catch (error) {
      return res.status(500).json({ error: 'Errore nel recupero utenti' });
    }
  });

  app.get('/api/users/:email', requireAuth, async (req, res) => {
    try {
      const userData = await UserService.getUserByEmail(decodeURIComponent(req.params.email));
      if (!userData) return res.status(404).json({ error: 'Utente non trovato' });
      return res.status(200).json(userData);
    } catch (error) {
      return res.status(500).json({ error: 'Errore nel recupero utente' });
    }
  });

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

  app.post('/api/opinioni', requireAuth, async (req, res) => {
    try {
      const result = await UserService.saveUserOpinions(req.user!.email!, req.body);
      if (!result.success) return res.status(500).json({ error: result.error });
      return res.status(200).json({ message: 'Opinioni salvate', data: result.data });
    } catch (error) {
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  app.get('/api/opinioni', requireAuth, async (req, res) => {
    try {
      const opinions = await UserService.getUserOpinions(req.user!.email!);
      return res.status(200).json(opinions || {});
    } catch (error) {
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  app.get('/api/candidati', requireAuth, async (req, res) => {
    try {
      const candidati = await UserService.AssgetCandidati();
      return res.status(200).json(candidati);
    }olutamente. Hai ragione, è fondamentale avere il file completo per evitare errori.

 catch (error) {
      return res.status(500).json({ error: 'Errore nelEcco la versione completa e corretta di `server/routes.ts`. Ho sostituito il blocco di routing per recupero candidati' });
    }
  });

  app.get('/api/search-politicians', requireAuth i voti con la versione esplicita che non usa più la funzione "magica" `kebabToPascal`, risolvendo, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') return res.status(400).json({ error così l'errore `TypeError` che vedevi nei log.

---

### File da Sostituire: `routes.ts`

**Azione:** Copia e incolla questo intero blocco di codice,: 'Query mancante' });
      const politicians = await UserService.searchPoliticians(q);
      return sostituendo tutto il contenuto del tuo file `server/routes.ts`.

**File: `server/routes. res.status(200).json(politicians);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });ts` (versione definitiva e completa)**
```typescript
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth }

  // =========================================================
  // ROTTE VOTO (gestite da VotoService)
  // =========================================================

  app.post('/api/governo/vota', requireAuth, from "./auth.js"; 

// Importa tutti i servizi con l'estensione .js
import UserService from "./user.service.js";
import VotoService from "./voto.service.js";
import async (req, res) => {
      const { categoria, nomeMinistro } = req.body;
      const AdminService from "./admin.service.js";
import ComunicazioneService from "./comunicazione.service.js";
import ElezioneService from "./elezione.service.js";
import ComizioService from "./comizio result = await VotoService.voteMinistro(req.user!.uid!, categoria, nomeMinistro);
      if (!result.success) return res.status(500).json({ error: result.error });
      .service.js";
import NotificaService from "./notifica.service.js";
import { storage } from "./storage.js";

export async function registerRoutes(app: Express): Promise<Server> {
  return res.status(200).json({ message: 'Voto registrato' });
  });

  app.get('/api/governo/voti', requireAuth, async (req, res) => {
      setupAuth(app);

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).jsonconst voti = await VotoService.getUserVotiMinistri(req.user!.uid!);
      return res.status(200).json(voti);
  });

  app.get('/api/governo({ error: "Non autenticato" });
    }
    next();
  };

  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || req.user?.ruolo !== 'Admin') {
      return res.status(403)./classifiche', async (req, res) => {
      const classifiche = await VotoService.getAllClassificheMinistri();
      return res.status(200).json(classifiche);
  });

  // Funzione helper generica per creare le rotte di voto
  const createVotingEndpoints = (path: string, methods: { vote: string, getUserVoti: string, removeVote?:json({ error: "Accesso negato. Riservato agli amministratori." });
    }
    next();
  };

  // =========================================================
  // ROTTE UTENTE (gestite da string, getClassifica: string }, entityKey: 'nome' | 'legge' = 'nome') => { UserService)
  // =========================================================
  app.get('/api/users', requireAuth, async
    app.post(`/api/${path}/vota`, requireAuth, async (req, res) => {
       (req, res) => {
    try {
      const users = await UserService.getAllUsers();
      const { [entityKey]: name } = req.body;
      if (!name) return res.status(400return res.status(200).json(users);
    } catch (error) {
      return).json({ error: "Nome o legge mancante" });
      const result = await (VotoService as any)[methods res.status(500).json({ error: 'Errore nel recupero utenti' });
    }.vote](req.user!.uid!, name);
      if (!result.success) return res.status(
  });

  app.get('/api/users/:email', requireAuth, async (req, res)500).json({ error: result.error });
      return res.status(200).json => {
    try {
      const userData = await UserService.getUserByEmail(decodeURIComponent(req.params({ message: "Voto registrato" });
    });

    app.get(`/api/${path}/v.email));
      if (!userData) return res.status(404).json({ error: 'Utoti`, requireAuth, async (req, res) => {
      const voti = await (VotoService as any)[ente non trovato' });
      return res.status(200).json(userData);
    } catch (error) {
      return res.status(500).json({ error: 'Errore nel recupermethods.getUserVoti](req.user!.uid!);
      return res.status(200).json(votio utente' });
    }
  });

  app.put('/api/users/:email', require);
    });

    if (methods.removeVote) {
      app.delete(`/api/${Auth, async (req, res) => {
    try {
      const { email } = req.paramspath}/voti/:name`, requireAuth, async (req, res) => {
        const result = await;
      const isOwnProfile = req.user?.email === email;
      const isAdmin = req.user (VotoService as any)[methods.removeVote](req.user!.uid!, decodeURIComponent(req.params.name));
        if (!result.success) return res.status(404).json({ error:?.ruolo === 'Admin';
      if (!isOwnProfile && !isAdmin) return res.status(403).json({ error: 'Permessi non sufficienti' });
      const result = await UserService.update result.error });
        return res.status(200).json({ message: "Voto rimosso" });
      });
    }

    app.get(`/api/${path}/classifica`, async (req, resUserData(email, req.body);
      if (!result.success) return res.status(500).json({ error: result.error });
      return res.status(200).json({ message:) => {
      const classifica = await (VotoService as any)[methods.getClassifica]();
      return res.status(200).json(classifica);
    });
  };

  // Mappatura esplic 'Profilo aggiornato', data: result.data });
    } catch (error) {
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  app.post('/api/users/:email/avatar', requireAuth, async (req, res)ita e corretta: "URL" -> { nomi ESATTI dei metodi nel servizio }
  createVotingEndpoints('capo-stato', {
    vote: 'voteCapoDiStato',
    getUserVoti => {
    try {
      const { email } = req.params;
      const { avatar_config } = req.body;
      const result = await UserService.updateUserData(decodeURIComponent(email), { avatar_config });
      if (!result.success) return res.status(500).json({ error:: 'getUserVotiCapoDiStato',
    removeVote: 'removeVoteCapoDiStato',
    getClassifica: 'getClassificaCapoDiStato'
  });

  createVotingEndpoints('grazia', {
    vote: 'voteGrazia',
    getUserVoti: 'getUserVotiGraz result.error });
      res.json({ success: true, message: 'Configurazione avatar salvata' });
    } catch (error) {
      return res.status(500).json({ error: 'Errore internoia',
    removeVote: 'removeVoteGrazia',
    getClassifica: 'getClassificaGrazia' del server' });
    }
  });

  app.post('/api/opinioni', requireAuth, async (req, res) => {
    try {
      const result = await UserService.saveUserOpinions
  });

  createVotingEndpoints('amnistia', {
    vote: 'voteAmnistia',
    getUserVoti: 'getUserVotiAmnistia',
    removeVote: 'removeVoteAmnistia',
    getClassifica: 'getClassificaAmnistia'
  }, 'legge');

  createVotingEndpoints('iniziativa-popolare', {
    vote: 'voteIniziativaPopolare',
    (req.user!.email!, req.body);
      if (!result.success) return res.status(500).json({ error: result.error });
      return res.status(200).json({ message: 'Opinioni salvate', data: result.data });
    } catch (error) {
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  app.get('/api/opinioni', requireAuth, async (req, res)getUserVoti: 'getUserVotiIniziativaPopolare',
    getClassifica: 'getClassificaIniziativaPopolare'
  });

  createVotingEndpoints('referendum-abrogativo', {
    vote: 'voteReferendumAbrogativo',
    getUserVoti: 'getUserVotiReferendumAbrogativo',
    getClassifica: 'getClassificaReferendumAbrogativo'
  });

  // =========================================================
  // ROTTE AMMINISTRAZIONE (gestite da AdminService)
  // =========================================================

  app.delete('/api/users/:email', requireAdmin, async (req, res) => {
    const result = await AdminService.deleteUserByEmail(req.params.email);
    if (!result.success) return res.status(500).json({ error: result.error });
     => {
    try {
      const opinions = await UserService.getUserOpinions(req.user!.email!);
      return res.status(200).json(opinions || {});
    } catch (error) {
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  app.get('/api/candidati', requireAuth, async (req, res) => {
    try {
      const candidati = await UserService.getCandidati();
      return res.status(200).json(candidati);
    } catch (error) {
      return res.status(500).json({ error: 'Errore nel recupero candidati' });
    }
  });

  app.get('/api/search-politicians', requireAuth, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') return res.status(400).json({ error: 'Query mancante' });
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

  // =========================================================
  // ROTTE COMUNICAZIONI (gestite da ComunicazioneService)
  // =========================================================

  app.post('/api/comunicazioni', requireAuth      const politicians = await UserService.searchPoliticians(q);
      return res.status(200).json(politicians);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // =========================================================
  // ROTTE VOTO (gestite da VotoService)
  // =========================================================

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

  // Funzione helper generica per creare le rotte di voto
  const createVotingEndpoints = (path: string, methods: { vote: string, getUserVoti: string, removeVote?: string, getClassifica: string }, entityKey: 'nome' | 'legge' = 'nome') => {
    app.post(`/api/${path}/vota`, requireAuth, async (req, res) => {
      const { [entityKey]: name } = req.body;
      if (!name) return res.status(400).json({ error: "Nome o legge mancante" });
      const result = await (VotoService as any)[methods.vote](req.user!.uid!, name);
      if (!result.success) return res.status(500, async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}