import { Utente } from './types.js';
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
  app.get('/api/users', requireAuth, async (req, res) => { try { const users = await UserService.getAllUsers(); return res.status(200).json(users); } catch (error) { return res.status(500).json({ error: 'Errore nel recupero utenti' }); } });
  app.get('/api/users/:email', requireAuth, async (req, res) => { try { const userData = await UserService.getUserByEmail(decodeURIComponent(req.params.email)); if (!userData) return res.status(404).json({ error: 'Utente non trovato' }); return res.status(200).json(userData); } catch (error) { return res.status(500).json({ error: 'Errore nel recupero utente' }); } });
  app.put('/api/users/:email', requireAuth, async (req, res) => { 
    try { 
      const { email } = req.params; 
      const isOwnProfile = req.user?.email === email; 
      const isAdmin = req.user?.ruolo === 'Admin'; 
      if (!isOwnProfile && !isAdmin) return res.status(403).json({ error: 'Permessi non sufficienti' }); 

      const result = await UserService.saveUserData({ email, ...req.body }); 

      if (!result.success) return res.status(500).json({ error: result.error }); 
      return res.status(200).json({ message: 'Profilo aggiornato', data: result.data }); 
    } catch (error) { 
      return res.status(500).json({ error: 'Errore interno del server' }); 
    } 
  });
  app.post('/api/users/:email/avatar', requireAuth, async (req, res) => { try { const { email } = req.params; const { avatar_config } = req.body; const result = await UserService.saveUserData({ email: decodeURIComponent(email), avatar_config }); if (!result.success) return res.status(500).json({ error: result.error }); res.json({ success: true, message: 'Configurazione avatar salvata' }); } catch (error) { return res.status(500).json({ error: 'Errore interno del server' }); } });
   app.post('/api/opinioni', requireAuth, async (req, res) => { try { const result = await UserService.saveUserData({ email: req.user!.email!, ...req.body }); if (!result.success) return res.status(500).json({ error: result.error }); return res.status(200).json({ message: 'Opinioni salvate', data: result.data }); } catch (error) { return res.status(500).json({ error: 'Errore interno del server' }); } });
  app.get('/api/opinioni', requireAuth, async (req, res) => { try { const opinions = await UserService.getUserOpinions(req.user!.email!); return res.status(200).json(opinions || {}); } catch (error) { return res.status(500).json({ error: 'Errore interno del server' }); } });
  app.get('/api/candidati', requireAuth, async (req, res) => { try { const candidati = await UserService.getCandidati(); return res.status(200).json(candidati); } catch (error) { return res.status(500).json({ error: 'Errore nel recupero candidati' }); } });
  app.get('/api/search-politicians', requireAuth, async (req, res) => { try { const { q } = req.query; if (!q || typeof q !== 'string') return res.status(400).json({ error: 'Query mancante' }); const politicians = await UserService.searchPoliticians(q); return res.status(200).json(politicians); } catch (error) { return res.status(500).json({ error: 'Internal server error' }); } });

  // Nuova rotta per completare il profilo con dati di elezione/candidatura
  app.post('/api/complete-politician-profile', requireAuth, async (req, res) => {
    try {
      if (!req.user?.email) {
        return res.status(401).json({ error: "Utente non autenticato." });
      }

      const politicianData: Partial<Utente> = req.body;

      const result = await UserService.saveUserData({ email: req.user.email, ...politicianData });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ message: "Profilo completato con successo." });
    } catch (error) {
      console.error("Errore nel completamento del profilo:", error);
      return res.status(500).json({ error: "Errore interno del server." });
    }
  });

  
  // ===== NUOVA ROTTA PER STATISTICHE =====
  app.get('/api/statistiche-opinioni', requireAdmin, async (req, res) => {
    try {
        const allUsersData = await UserService.getAllUsers();
        return res.status(200).json(allUsersData);
    } catch (error) {
        console.error("Errore nel recuperare le statistiche opinioni:", error);
        return res.status(500).json({ error: "Errore interno del server" });
    }
  });

  // Aggiungi questo blocco di codice dopo la rotta per /api/statistiche-opinioni

  public static async getOpinionDetailStats(opinionField: string, regione?: string): Promise<any> {
    try {
      // VALIDAZIONE SPOSTATA QUI ALL'INIZIO
      const validFields = ["energia_nucleare", "sperimentazione_animale", "legalizzazione_canapa", "caccia", "unione_europea"];
      if (!opinionField || !validFields.includes(opinionField)) {
        return { error: "Campo opinione non valido o mancante" };
      }

      if (!adminDb) {
        console.error("Admin SDK non inizializzato.");
        return { error: "Errore di configurazione del server" };
      }

      // Il resto della funzione rimane identico a prima
      const calculateAgeRange = (birthDateString: string): string | undefined => {
        if (!birthDateString) return undefined;
        const birthDate = new Date(birthDateString);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        if (age >= 18 && age <= 24) return '18-24';
        if (age >= 25 && age <= 34) return '25-34';
        if (age >= 35 && age <= 44) return '35-44';
        if (age >= 45 && age <= 54) return '45-54';
        if (age >= 55 && age <= 64) return '55-64';
        if (age >= 65) return '65+';
        return undefined;
      };

      let firestoreQuery: Query = 
          adminDb.collection('utenti').select(opinionField, 'genere', 'data_nascita', 'regione_residenza');

      if (regione) {
        firestoreQuery = firestoreQuery.where('regione_residenza', '==', regione);
      }

      const snapshot = await firestoreQuery.get();

      if (snapshot.empty) {
        return { 
          genderDistributionByOpinion: { favorevole: {}, contrario: {}, astenuto: {} },
          ageDistributionByOpinion: { favorevole: {}, contrario: {}, astenuto: {} }
        };
      }

      const stats = {
        genderDistributionByOpinion: {
          favorevole: {} as Record<string, number>,
          contrario: {} as Record<string, number>,
          astenuto: {} as Record<string, number>
        },
        ageDistributionByOpinion: {
          favorevole: {} as Record<string, number>,
          contrario: {} as Record<string, number>,
          astenuto: {} as Record<string, number>
        }
      };

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const opinion = data[opinionField];
        const gender = (data.genere || 'Non specificato').toLowerCase();
        const ageRange = calculateAgeRange(data.data_nascita);

        if (typeof opinion === 'string') {
          const normalizedOpinion = opinion.toLowerCase();
          let targetOpinionGroup: keyof typeof stats.genderDistributionByOpinion | null = null;
          if (normalizedOpinion === 'favorevole') targetOpinionGroup = 'favorevole';
          else if (normalizedOpinion === 'contrario') targetOpinionGroup = 'contrario';
          else if (normalizedOpinion === 'astenuto' || normalizedOpinion === 'indeciso') targetOpinionGroup = 'astenuto';

          if (targetOpinionGroup) {
            stats.genderDistributionByOpinion[targetOpinionGroup][gender] = (stats.genderDistributionByOpinion[targetOpinionGroup][gender] || 0) + 1;

            if (ageRange) {
              stats.ageDistributionByOpinion[targetOpinionGroup][ageRange] = (stats.ageDistributionByOpinion[targetOpinionGroup][ageRange] || 0) + 1;
            }
          }
        }
      });

      return stats;
    } catch (error) {
      return this.handleError(error, 'getOpinionDetailStats');
    }
  }

  // =========================================================
  // ROTTE VOTO (gestite da VotoService)
  // =========================================================
  app.post('/api/governo/vota', requireAuth, async (req, res) => { const { categoria, nomeMinistro } = req.body; const result = await VotoService.voteMinistro(req.user!.uid!, categoria, nomeMinistro); if (!result.success) return res.status(500).json({ error: result.error }); return res.status(200).json({ message: 'Voto registrato' }); });
  app.get('/api/governo/voti', requireAuth, async (req, res) => { const voti = await VotoService.getUserVotiMinistri(req.user!.uid!); return res.status(200).json(voti); });
  app.get('/api/governo/classifiche', async (req, res) => { const classifiche = await VotoService.getAllClassificheMinistri(); return res.status(200).json(classifiche); });

  const createVotingEndpoints = (path: string, methods: { vote: string, getUserVoti: string, removeVote?: string, getClassifica: string }, entityKey: 'nome' | 'legge' = 'nome') => {
    app.post(`/api/${path}/vota`, requireAuth, async (req, res) => { const { [entityKey]: name } = req.body; if (!name) return res.status(400).json({ error: "Nome o legge mancante" }); const result = await (VotoService as any)[methods.vote](req.user!.uid!, name); if (!result.success) return res.status(500).json({ error: result.error }); return res.status(200).json({ message: "Voto registrato" }); });
    app.get(`/api/${path}/voti`, requireAuth, async (req, res) => { const voti = await (VotoService as any)[methods.getUserVoti](req.user!.uid!); return res.status(200).json(voti); });
    if (methods.removeVote) { app.delete(`/api/${path}/voti/:name`, requireAuth, async (req, res) => { const result = await (VotoService as any)[methods.removeVote](req.user!.uid!, decodeURIComponent(req.params.name)); if (!result.success) return res.status(404).json({ error: result.error }); return res.status(200).json({ message: "Voto rimosso" }); }); }
    app.get(`/api/${path}/classifica`, async (req, res) => { const classifica = await (VotoService as any)[methods.getClassifica](); return res.status(200).json(classifica); });
  };

  createVotingEndpoints('capo-stato', { vote: 'voteCapoDiStato', getUserVoti: 'getUserVotiCapoDiStato', removeVote: 'removeVoteCapoDiStato', getClassifica: 'getClassificaCapoDiStato' });
  createVotingEndpoints('grazia', { vote: 'voteGrazia', getUserVoti: 'getUserVotiGrazia', removeVote: 'removeVoteGrazia', getClassifica: 'getClassificaGrazia' });
  createVotingEndpoints('amnistia', { vote: 'voteAmnistia', getUserVoti: 'getUserVotiAmnistia', removeVote: 'removeVoteAmnistia', getClassifica: 'getClassificaAmnistia' }, 'legge');
  createVotingEndpoints('iniziative-popolari', { vote: 'voteIniziativaPopolare', getUserVoti: 'getUserVotiIniziativaPopolare', getClassifica: 'getClassificaIniziativaPopolare' });
  createVotingEndpoints('referendum-abrogativo', { vote: 'voteReferendumAbrogativo', getUserVoti: 'getUserVotiReferendumAbrogativo', getClassifica: 'getClassificaReferendumAbrogativo' });

  // =========================================================
  // ALTRE ROTTE
  // =========================================================
  app.delete('/api/users/:email', requireAdmin, async (req, res) => { const result = await AdminService.deleteUserByEmail(req.params.email); if (!result.success) return res.status(500).json({ error: result.error }); return res.status(200).json({ message: 'Utente eliminato' }); });
  app.get('/api/pending-users', requireAdmin, async (req, res) => { const users = await AdminService.getPendingUsers(); return res.status(200).json(users); });
  app.post('/api/approve-user', requireAdmin, async (req, res) => { const result = await AdminService.approveUser(req.body.userId); if (!result.success) return res.status(500).json({ error: result.error }); return res.status(200).json({ message: 'Utente approvato' }); });
  app.post('/api/reject-user', requireAdmin, async (req, res) => { const result = await AdminService.rejectUser(req.body.userId, req.body.reason); if (!result.success) return res.status(500).json({ error: result.error }); return res.status(200).json({ message: 'Utente rifiutato' }); });
  app.post('/api/comunicazioni', requireAuth, async (req, res) => { const result = await ComunicazioneService.createComunicazione(req.user!, req.body); if (!result.success) return res.status(500).json({ error: result.error }); return res.status(201).json(result); });
  app.get('/api/podio-trasparenza', async (req, res) => { const podio = await ComunicazioneService.getPodioTrasparenza(); return res.status(200).json(podio); });
  app.post('/api/comunicazioni/:id/react', requireAuth, async (req, res) => { const result = await ComunicazioneService.reactToComunicazione(req.params.id, req.user!.uid!, req.body.reaction); if (!result.success) return res.status(500).json({ error: result.error }); return res.status(200).json({ message: 'Reazione registrata' }); });
  app.get('/api/notifiche', requireAuth, async (req, res) => { const notifiche = await NotificaService.getUserNotifications(req.user!.uid!); return res.status(200).json(notifiche); });
  app.patch('/api/notifiche/:id/read', requireAuth, async (req, res) => { const result = await NotificaService.markNotificationAsRead(req.params.id, req.user!.uid!); if (!result.success) return res.status(500).json({ error: result.error }); return res.status(200).json({ message: 'Notifica letta' }); });
  app.get('/api/elezioni', requireAuth, async (req, res) => { const elezioni = await ElezioneService.getAllElezioni(); return res.status(200).json(elezioni); });
  app.post('/api/comizi', requireAuth, async (req, res) => { const result = await ComizioService.saveComizio(req.body, req.user!); if(!result.success) return res.status(500).json({ error: result.error }); return res.status(201).json(result.data); });
  app.get('/api/comizi', async (req, res) => { const comizi = await ComizioService.getAllComizi(); return res.status(200).json(comizi); });

  const httpServer = createServer(app);
  return httpServer;
}