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
    } catchAss (error) {
      return res.status(500).json({ error: 'Errore nel recuperolutamente. Ecco la versione completa, corretta e non abbreviata del tuo file `server/o utente' });
    }
  });

  app.put('/api/users/:email', requireAuth, async (req, res) => {
    try {
      const { email } = req.paramsroutes.ts`.

Ho sostituito il blocco di codice per il routing dei voti con la versione esplicita che non;
      const isOwnProfile = req.user?.email === email;
      const isAdmin = req.user usa più funzioni "magiche" per indovinare i nomi dei metodi, risolvendo così l'errore ?.ruolo === 'Admin';
      if (!isOwnProfile && !isAdmin) return res.status(4`TypeError: service[methodNamePart] is not a function`.

---

### File da Sostituire: `routes.03).json({ error: 'Permessi non sufficienti' });
      const result = await UserService.updatets`

**Azione:** Copia e incolla questo intero blocco di codice, sostituendo tutto ilUserData(email, req.body);
      if (!result.success) return res.status(500 contenuto del tuo file `server/routes.ts`.

**File: `server/routes.ts` (vers).json({ error: result.error });
      return res.status(200).json({ message:ione definitiva, completa e corretta)**
 'Profilo aggiornato', data: result.data });
    } catch (error) {
      return res```typescript
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth.status(500).json({ error: 'Errore interno del server' });
    }
  .js"; 

// Importa tutti i servizi con l'estensione .js
import UserService from "./user});

  app.post('/api/users/:email/avatar', requireAuth, async (req, res).service.js";
import VotoService from "./voto.service.js";
import AdminService from => {
    try {
      const { email } = req.params;
      const { avatar_config "./admin.service.js";
import ComunicazioneService from "./comunicazione.service.js";
import } = req.body;
      const result = await UserService.updateUserData(decodeURIComponent(email), { avatar_config });
      if (!result.success) return res.status(500).json({ error: ElezioneService from "./elezione.service.js";
import ComizioService from "./comizio.service. result.error });
      res.json({ success: true, message: 'Configurazione avatar salvata' });
    js";
import NotificaService from "./notifica.service.js";
import { storage } from "./storage} catch (error) {
      return res.status(500).json({ error: 'Errore.js";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const requireAuth = (req: Request, res: Response, next: NextFunction) => { interno del server' });
    }
  });

  app.post('/api/opinioni', requireAuth, async (req, res) => {
    try {
      const result = await UserService.saveUserOpin
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Non autenticato" });
    }
    next();
  };

  const requireAdmin = (reqions(req.user!.email!, req.body);
      if (!result.success) return res.status(50: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || req0).json({ error: result.error });
      return res.status(200).json({ message.user?.ruolo !== 'Admin') {
      return res.status(403).json({ error: 'Opinioni salvate', data: result.data });
    } catch (error) {
      return: "Accesso negato. Riservato agli amministratori." });
    }
    next();
 res.status(500).json({ error: 'Errore interno del server' });
    }
  };

  // =========================================================
  // ROTTE UTENTE (gestite da UserService)
  //  });

  app.get('/api/opinioni', requireAuth, async (req, res) => { =========================================================
  app.get('/api/users', requireAuth, async (req, res)
    try {
      const opinions = await UserService.getUserOpinions(req.user!.email!);
       => {
    try {
      const users = await UserService.getAllUsers();
      return res.status(return res.status(200).json(opinions || {});
    } catch (error) {
200).json(users);
    } catch (error) {
      return res.status(500).      return res.status(500).json({ error: 'Errore interno del server' });
    json({ error: 'Errore nel recupero utenti' });
    }
  });

  app.get}
  });

  app.get('/api/candidati', requireAuth, async (req, res('/api/users/:email', requireAuth, async (req, res) => {
    try {
      ) => {
    try {
      const candidati = await UserService.getCandidati();
      return resconst userData = await UserService.getUserByEmail(decodeURIComponent(req.params.email));
      if (!userData.status(200).json(candidati);
    } catch (error) {
      return) return res.status(404).json({ error: 'Utente non trovato' });
      return res.status(500).json({ error: 'Errore nel recupero candidati' });
     res.status(200).json(userData);
    } catch (error) {
      return res}
  });

  app.get('/api/search-politicians', requireAuth, async (req,.status(500).json({ error: 'Errore nel recupero utente' });
    } res) => {
    try {
      const { q } = req.query;
      if (!q
  });

  app.put('/api/users/:email', requireAuth, async (req, res) || typeof q !== 'string') return res.status(400).json({ error: 'Query mancante => {
    try {
      const { email } = req.params;
      const isOwnProfile =' });
      const politicians = await UserService.searchPoliticians(q);
      return res.status(2 req.user?.email === email;
      const isAdmin = req.user?.ruolo === 'Admin';
00).json(politicians);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // =================      if (!isOwnProfile && !isAdmin) return res.status(403).json({ error: 'Permessi non sufficienti' });
      const result = await UserService.updateUserData(email, req.body);========================================
  // ROTTE VOTO (gestite da VotoService)
  // =================================
      if (!result.success) return res.status(500).json({ error: result.error========================

  app.post('/api/governo/vota', requireAuth, async (req, res });
      return res.status(200).json({ message: 'Profilo aggiornato', data:) => {
      const { categoria, nomeMinistro } = req.body;
      const result = await result.data });
    } catch (error) {
      return res.status(500).json VotoService.voteMinistro(req.user!.uid!, categoria, nomeMinistro);
      if (!result.success({ error: 'Errore interno del server' });
    }
  });

  app.post('/api) return res.status(500).json({ error: result.error });
      return res.status/users/:email/avatar', requireAuth, async (req, res) => {
    try {
      (200).json({ message: 'Voto registrato' });
  });

  app.get('/apiconst { email } = req.params;
      const { avatar_config } = req.body;
      /governo/voti', requireAuth, async (req, res) => {
      const voti =const result = await UserService.updateUserData(decodeURIComponent(email), { avatar_config });
      if (!result await VotoService.getUserVotiMinistri(req.user!.uid!);
      return res.status(20.success) return res.status(500).json({ error: result.error });
      res.json({ success0).json(voti);
  });

  app.get('/api/governo/classifiche: true, message: 'Configurazione avatar salvata' });
    } catch (error) {
      return', async (req, res) => {
      const classifiche = await VotoService.getAllClassifiche res.status(500).json({ error: 'Errore interno del server' });
    }
Ministri();
      return res.status(200).json(classifiche);
  });
  });

  app.post('/api/opinioni', requireAuth, async (req, res) => {  
  // Funzione helper generica per creare le rotte di voto
  const createVotingEndpoints = (
    try {
      const result = await UserService.saveUserOpinions(req.user!.email!, req.bodypath: string, methods: { vote: string, getUserVoti: string, removeVote?: string, getClassifica);
      if (!result.success) return res.status(500).json({ error: result.: string }, entityKey: 'nome' | 'legge' = 'nome') => {
    app.post(`/api/${path}/vota`, requireAuth, async (req, res) => {
      const { [error });
      return res.status(200).json({ message: 'Opinioni salvate', data: result.data });
    } catch (error) {
      return res.status(500).entityKey]: name } = req.body;
      if (!name) return res.status(400json({ error: 'Errore interno del server' });
    }
  });

  app.get('/).json({ error: "Nome o legge mancante" });
      const result = await (VotoService asapi/opinioni', requireAuth, async (req, res) => {
    try {
      const opinions any)[methods.vote](req.user!.uid!, name);
      if (!result.success) return res = await UserService.getUserOpinions(req.user!.email!);
      return res.status(200.status(500).json({ error: result.error });
      return res.status(20).json(opinions || {});
    } catch (error) {
      return res.status(500).json({ message: "Voto registrato" });
    });

    app.get(`/api/${0).json({ error: 'Errore interno del server' });
    }
  });

  app.get('/api/candidati', requireAuth, async (req, res) => {
    try {
path}/voti`, requireAuth, async (req, res) => {
      const voti = await (VotoService as any)[methods.getUserVoti](req.user!.uid!);
      return res.status(2      const candidati = await UserService.getCandidati();
      return res.status(200).json(candidati);
    } catch (error) {
      return res.status(500).00).json(voti);
    });

    if (methods.removeVote) {
      app.json({ error: 'Errore nel recupero candidati' });
    }
  });

  app.delete(`/api/${path}/voti/:name`, requireAuth, async (req, res) => {
        get('/api/search-politicians', requireAuth, async (req, res) => {
    try {const result = await (VotoService as any)[methods.removeVote](req.user!.uid!, decodeURIComponent(req.params.name));
        if (!result.success) return res.status(404).
      const { q } = req.query;
      if (!q || typeof q !== 'string') returnjson({ error: result.error });
        return res.status(200).json({ message: " res.status(400).json({ error: 'Query mancante' });
      const politicians = awaitVoto rimosso" });
      });
    }

    app.get(`/api/${path}/classifica`, async UserService.searchPoliticians(q);
      return res.status(200).json(politicians);
    } catch (error) {
      return res.status(500).json({ error: ' (req, res) => {
      const classifica = await (VotoService as any)[methods.getClassifica]();
      return res.status(200).json(classifica);
    });
  };Internal server error' });
    }
  });

  // =========================================================
  // ROTTE VOTO (gestite da VotoService)
  // =========================================================

  app.post('/

  // Mappatura esplicita e corretta: "URL" -> { nomi ESATTI dei metodiapi/governo/vota', requireAuth, async (req, res) => {
      const { categoria nel servizio }
  createVotingEndpoints('capo-stato', {
    vote: 'voteCapoDiStato',
    getUserVoti: 'getUserVotiCapoDiStato',
    removeVote:, nomeMinistro } = req.body;
      const result = await VotoService.voteMinistro(req 'removeVoteCapoDiStato',
    getClassifica: 'getClassificaCapoDiStato'
.user!.uid!, categoria, nomeMinistro);
      if (!result.success) return res.status(50  });

  createVotingEndpoints('grazia', {
    vote: 'voteGrazia',
    getUser0).json({ error: result.error });
      return res.status(200).json({ messageVoti: 'getUserVotiGrazia',
    removeVote: 'removeVoteGrazia',
    getClass: 'Voto registrato' });
  });

  app.get('/api/governo/voti', requireifica: 'getClassificaGrazia'
  });

  createVotingEndpoints('amnistia', {
    Auth, async (req, res) => {
      const voti = await VotoService.getUserVotiMinistrivote: 'voteAmnistia',
    getUserVoti: 'getUserVotiAmnistia',
    (req.user!.uid!);
      return res.status(200).json(voti);
removeVote: 'removeVoteAmnistia',
    getClassifica: 'getClassificaAmnistia'
    });

  app.get('/api/governo/classifiche', async (req, res) =>}, 'legge');

  createVotingEndpoints('iniziativa-popolare', {
    vote: 'vote {
      const classifiche = await VotoService.getAllClassificheMinistri();
      return res.IniziativaPopolare',
    getUserVoti: 'getUserVotiIniziativaPopolare',
    getClassificastatus(200).json(classifiche);
  });

  // Funzione helper generica per: 'getClassificaIniziativaPopolare'
  });

  createVotingEndpoints('referendum-abrog creare le rotte di voto
  const createVotingEndpoints = (path: string, methods: { vote: stringativo', {
    vote: 'voteReferendumAbrogativo',
    getUserVoti: 'getUserV, getUserVoti: string, removeVote?: string, getClassifica: string }, entityKey: 'nome' | 'legotiReferendumAbrogativo',
    getClassifica: 'getClassificaReferendumAbrogativo'
  });ge' = 'nome') => {
    app.post(`/api/${path}/vota`, requireAuth, async (

  // =========================================================
  // ROTTE AMMINISTRAZIONE (gestite da AdminServicereq, res) => {
      const { [entityKey]: name } = req.body;
      if (!name))
  // =========================================================

  app.delete('/api/users/:email', requireAdmin, async (req return res.status(400).json({ error: "Nome o legge mancante" });
      const result = await, res) => {
    const result = await AdminService.deleteUserByEmail(req.params.email (VotoService as any)[methods.vote](req.user!.uid!, name);
      if (!result);
    if (!result.success) return res.status(500).json({ error: result..success) return res.status(500).json({ error: result.error });
      return reserror });
    return res.status(200).json({ message: 'Utente eliminato' });
  });.status(200).json({ message: "Voto registrato" });
    });

    app

  app.get('/api/pending-users', requireAdmin, async (req, res) => {
.get(`/api/${path}/voti`, requireAuth, async (req, res) => {
      const    const users = await AdminService.getPendingUsers();
    return res.status(200).json voti = await (VotoService as any)[methods.getUserVoti](req.user!.uid!);
(users);
  });

  app.post('/api/approve-user', requireAdmin, async (req      return res.status(200).json(voti);
    });

    if (, res) => {
    const result = await AdminService.approveUser(req.body.userId);
methods.removeVote) {
      app.delete(`/api/${path}/voti/:name`, requireAuth,    if (!result.success) return res.status(500).json({ error: result.error }); async (req, res) => {
        const result = await (VotoService as any)[methods.removeVote](
    return res.status(200).json({ message: 'Utente approvato' });
req.user!.uid!, decodeURIComponent(req.params.name));
        if (!result.success) return  });

  app.post('/api/reject-user', requireAdmin, async (req, res) => res.status(404).json({ error: result.error });
        return res.status(2 {
    const result = await AdminService.rejectUser(req.body.userId, req.body.reason00).json({ message: "Voto rimosso" });
      });
    }

    app);
    if (!result.success) return res.status(500).json({ error: result..get(`/api/${path}/classifica`, async (req, res) => {
      const classifica = await (Votoerror });
    return res.status(200).json({ message: 'Utente rifiutato'Service as any)[methods.getClassifica]();
      return res.status(200).json(class });
  });

  // =========================================================
  // ROTTE COMUNICAZIONI (gestite da ComunicazioneService)
  // =========================================================

  app.post('/api/comunicifica);
    });
  };

  // Mappatura esplicita e corretta: "URL"azioni', requireAuth, async (req, res) => {
    const result = await ComunicazioneService.create -> { nomi ESATTI dei metodi nel servizio }
  createVotingEndpoints('capo-stato', {
Comunicazione(req.user!, req.body);
    if (!result.success) return res.status(500    vote: 'voteCapoDiStato',
    getUserVoti: 'getUserVotiCapoDiStato',
    removeVote: 'removeVoteCapoDiStato',
    getClassifica: 'getClass).json({ error: result.error });
    return res.status(201).json(result);ificaCapoDiStato'
  });

  createVotingEndpoints('grazia', {
    vote:
  });

  app.get('/api/podio-trasparenza', async (req, res 'voteGrazia',
    getUserVoti: 'getUserVotiGrazia',
    removeVote: ') => {
    const podio = await ComunicazioneService.getPodioTrasparenza();
    removeVoteGrazia',
    getClassifica: 'getClassificaGrazia'
  });

  createVotingEndpointsreturn res.status(200).json(podio);
  });

  app.post('/api('amnistia', {
    vote: 'voteAmnistia',
    getUserVoti: 'getUser/comunicazioni/:id/react', requireAuth, async (req, res) => {
    const resultVotiAmnistia',
    removeVote: 'removeVoteAmnistia',
    getClassifica: ' = await ComunicazioneService.reactToComunicazione(req.params.id, req.user!.uid!, reqgetClassificaAmnistia'
  }, 'legge');

  createVotingEndpoints('iniziativa-popolare.body.reaction);
    if (!result.success) return res.status(500).json({', {
    vote: 'voteIniziativaPopolare',
    getUserVoti: 'getUserVoti error: result.error });
    return res.status(200).json({ message: 'ReazioneIniziativaPopolare',
    getClassifica: 'getClassificaIniziativaPopolare'
  });
 registrata' });
  });

  // =========================================================
  // ROTTE NOTIFICHE (gestite da  
  createVotingEndpoints('referendum-abrogativo', {
    vote: 'voteReferendumAb NotificaService)
  // =========================================================

  app.get('/api/notifiche', requireAuth, async (req, res) => {
    const notifiche = await NotificaService.getUserNotificationsrogativo',
    getUserVoti: 'getUserVotiReferendumAbrogativo',
    getClassifica: 'getClassificaReferendumAbrogativo'
  });

  // =========================================================
  // ROT(req.user!.uid!);
    return res.status(200).json(notifiche);TE AMMINISTRAZIONE (gestite da AdminService)
  // =========================================================

  app
  });

  app.patch('/api/notifiche/:id/read', requireAuth, async (.delete('/api/users/:email', requireAdmin, async (req, res) => {
    const result = await Adminreq, res) => {
    const result = await NotificaService.markNotificationAsRead(req.paramsService.deleteUserByEmail(req.params.email);
    if (!result.success) return res..id, req.user!.uid!);
    if (!result.success) return res.status(50status(500).json({ error: result.error });
    return res.status(2000).json({ error: result.error });
    return res.status(200).json({ message).json({ message: 'Utente eliminato' });
  });

  app.get('/api/pending-users',: 'Notifica letta' });
  });

  // =========================================================
  // ROTTE requireAdmin, async (req, res) => {
    const users = await AdminService.getPendingUsers(); ELEZIONI, COMIZI, ECC.
  // =========================================================

  app.get('/api/elezioni', requireAuth, async (req, res) => {
    const elezioni = await Ele
    return res.status(200).json(users);
  });

  app.post('/zioneService.getAllElezioni();
    return res.status(200).json(elezioni);api/approve-user', requireAdmin, async (req, res) => {
    const result = await Admin
  });

  app.post('/api/comizi', requireAuth, async (req, res) =>Service.approveUser(req.body.userId);
    if (!result.success) return res.status( {
      const result = await ComizioService.saveComizio(req.body, req.user!);
      if(!500).json({ error: result.error });
    return res.status(200).jsonresult.success) return res.status(500).json({ error: result.error });
      return({ message: 'Utente approvato' });
  });

  app.post('/api/reject- res.status(201).json(result.data);
  });

  app.get('/apiuser', requireAdmin, async (req, res) => {
    const result = await AdminService.rejectUser/comizi', async (req, res) => {
      const comizi = await ComizioService.getAll(req.body.userId, req.body.reason);
    if (!result.success) return res.Comizi();
      return res.status(200).json(comizi);
  });

  status(500).json({ error: result.error });
    return res.status(200const httpServer = createServer(app);
  return httpServer;
}
```).json({ message: 'Utente rifiutato' });
  });

  // =========================================================
  // ROTTE COMUNICAZIONI (gestite da ComunicazioneService)
  // =================================