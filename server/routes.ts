import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import FirebaseService, { UserOpinions } from "./firebase-service";
import { db } from "../db";
import { users, utenti, User } from "@shared/schema";
import { eq } from "drizzle-orm";

// Estendi l'interfaccia Request per includere user
// Interface already defined in auth.ts
// Keep this empty as a workaround to avoid type conflict

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Middleware di autenticazione per le rotte protette
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Non autenticato" });
    }
    next();
  };

  // User registration routes (protected)
  app.post('/api/utenti', requireAuth, async (req, res) => {
    try {
      const userData = req.body;
      const result = await storage.insertUser(userData);
      return res.status(201).json(result);
    } catch (error) {
      console.error('Error creating utente:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/utenti', requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      return res.status(200).json(users);
    } catch (error) {
      console.error('Error fetching utenti:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/utenti/:id', requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.status(200).json(user);
    } catch (error) {
      console.error('Error fetching utente:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // API per ottenere il profilo dell'utente
  app.get('/api/users/:id/profile', requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'ID utente non valido' });
      }
      
      // Verifica se l'utente sta cercando di accedere al proprio profilo o è un admin
      if (req.user && Number(req.user.id) !== userId) {
        return res.status(403).json({ error: 'Non autorizzato ad accedere a questo profilo' });
      }
      
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile) {
        return res.status(404).json({ error: 'Profilo utente non trovato' });
      }
      
      return res.status(200).json(userProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });
  
  // API per ottenere tutti gli utenti con i loro profili (per la gestione utenti)
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      // Qui potremmo aggiungere una verifica del ruolo (solo admin può vedere tutti gli utenti)
      const users = await FirebaseService.getAllUsersOpinions();
      return res.status(200).json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // API per aggiornare il profilo utente - UTILIZZA ESCLUSIVAMENTE SUPABASE
  app.put('/api/users/:email', requireAuth, async (req, res) => {
    try {
      const { email } = req.params;
      const userData = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email utente non valida' });
      }
      
      console.log(`User ID richiedente: ${req.user?.id}`);
      console.log(`Email richiedente: ${req.user?.email}`);
      console.log(`UUID richiedente: ${req.user?.uuid || 'non disponibile'}`);
      console.log("Dati di aggiornamento ricevuti:", userData);
      
      // Verifica se l'utente è admin o sta modificando il proprio profilo
      const isOwnProfile = req.user?.email === email;
      let isAdmin = false;
      
      // Verifica se l'utente è admin (controllo SOLO in Firebase)
      try {
        if (req.user?.email) {
          const firebaseUser = await FirebaseService.getUserByEmail(req.user.email);
          if (firebaseUser && firebaseUser.ruolo === 'Admin') {
            isAdmin = true;
            console.log("L'utente è un admin secondo Firebase");
          }
        }
      } catch (error) {
        console.error("Errore nel controllo Firebase:", error);
      }
      
      // Se non è il proprio profilo e non è admin, blocca l'operazione
      if (!isOwnProfile && !isAdmin) {
        return res.status(403).json({ 
          error: 'Non hai i permessi per modificare questo profilo' 
        });
      }
      
      // Verifica se l'utente esiste in Firebase
      const existingUser = await FirebaseService.getUserByEmail(email);
      if (!existingUser) {
        return res.status(404).json({ error: 'Utente non trovato in Firebase' });
      }
      
      // Aggiorna il profilo in Firebase
      const { success, error, data } = await FirebaseService.updateUserData(email, userData);
      
      if (!success) {
        return res.status(500).json({ 
          error: 'Errore durante l\'aggiornamento del profilo su Firebase',
          details: error
        });
      }
      
      // Aggiorniamo la sessione se l'utente sta modificando il proprio profilo
      if (isOwnProfile && req.user) {
        // Aggiorna il profilo memorizzato nella sessione
        req.user.profile = data;
        
        // Si noti che il profilo completo è ora nella richiesta dell'utente e sarà 
        // disponibile in tutte le chiamate API future
        console.log("Profilo nella sessione aggiornato");
      }
      
      return res.status(200).json({ 
        message: 'Profilo aggiornato con successo',
        data
      });
    } catch (error) {
      console.error("Errore durante l'aggiornamento del profilo:", error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // API per eliminare un utente (solo per Admin) - UTILIZZA ESCLUSIVAMENTE SUPABASE
  app.delete('/api/users/:email', requireAuth, async (req, res) => {
    try {
      const { email } = req.params;
      
      if (!email) {
        return res.status(400).json({ error: 'Email utente non valida' });
      }

      // Verifica se l'utente che fa la richiesta è autenticato
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      console.log("User ID richiedente:", req.user.id);
      console.log("Email richiedente:", req.user.email);
      console.log("UUID richiedente:", req.user.uuid || "non disponibile");
      
      // Verifica se l'utente che fa la richiesta è admin (controllo SOLO in Firebase)
      let isAdmin = false;
      
      // Verifica in Firebase usando il nostro servizio
      try {
        const supabaseUser = await FirebaseService.getUserByEmail(req.user.email);
        console.log("Dati da Firebase:", supabaseUser);
        
        if (supabaseUser && supabaseUser.ruolo === 'Admin') {
          isAdmin = true;
          console.log("L'utente è un admin secondo Firebase");
        }
      } catch (error) {
        console.error("Errore nel controllo Firebase:", error);
      }
      
      if (!isAdmin) {
        return res.status(403).json({ error: 'Solo gli amministratori possono eliminare utenti' });
      }

      // Verifica se l'utente esiste in Firebase
      const userToDelete = await FirebaseService.getUserByEmail(email);
      if (!userToDelete) {
        return res.status(404).json({ error: 'Utente non trovato in Firebase' });
      }

      console.log(`Richiesta eliminazione utente con email ${email} da Firebase`);
      
      // Elimina l'utente in Firebase
      const { success, error } = await FirebaseService.deleteUserByEmail(email);
      
      if (!success) {
        console.error("Errore durante l'eliminazione dell'utente da Firebase:", error);
        return res.status(500).json({ 
          error: "Errore durante l'eliminazione dell'utente", 
          details: error 
        });
      }
      
      return res.status(200).json({ message: 'Utente eliminato con successo' });
    } catch (error) {
      console.error("Errore durante l'eliminazione dell'utente:", error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // API per salvare le opinioni dell'utente - UTILIZZA ESCLUSIVAMENTE SUPABASE
  app.post('/api/opinioni', requireAuth, async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      console.log(`Utente autenticato. ID: ${req.user.id}, Email: ${req.user.email}, UUID: ${req.user.uuid || req.user.id}`);
      
      const opinionsData = req.body;
      
      // Priorità di identificativi per salvare le opinioni:
      // 1. UID (il più affidabile, è l'ID di Firebase Auth)
      // 2. Email (secondo più affidabile)
      // 3. ID di sessione (usato solo come ultima risorsa)
      
      const userId = req.user.uid || req.user.id; // Preferisco usare l'UID ma fallback all'ID
      const email = req.user.email;
      
      // Assicuriamo che l'email sia presente nei dati delle opinioni
      // Prima verifichiamo se l'email è nel payload, altrimenti usiamo quella dell'utente
      if (!opinionsData.email && email) {
        opinionsData.email = email;
        console.log(`Email aggiunta automaticamente ai dati: ${email}`);
      }
      
      // Logghiamo l'operazione
      console.log(`Salvando opinioni su Firebase per utente - UUID: ${userId}, Email: ${email}`);
      console.log('Dati opinioni completi:', JSON.stringify(opinionsData, null, 2));
      
      // Salviamo direttamente con l'UUID - convertiamo a stringa per sicurezza
      let result = await FirebaseService.saveUserOpinions(String(userId), opinionsData);
      
      // Se fallisce, proviamo con l'email
      if (!result.success && email) {
        console.log(`Fallback: salvando con email ${email}`);
        result = await FirebaseService.saveUserOpinions(email, opinionsData);
      }
      
      // Verifichiamo il risultato
      if (!result.success) {
        console.error('Errore nel salvataggio delle opinioni:', result.error);
        return res.status(500).json({ 
          error: 'Errore durante il salvataggio delle opinioni', 
          details: result.error 
        });
      }
      
      // Salvataggio riuscito, invia risposta
      return res.status(200).json({ 
        message: 'Opinioni salvate con successo',
        data: result.data,
        note: result.note
      });
    } catch (error) {
      console.error('Errore durante il salvataggio delle opinioni:', error);
      return res.status(500).json({ 
        error: 'Errore grave durante il salvataggio delle opinioni',
        message: error instanceof Error ? error.message : 'Errore sconosciuto'
      });
    }
  });

  // API per ottenere le opinioni dell'utente - UTILIZZA ESCLUSIVAMENTE SUPABASE
  app.get('/api/opinioni', requireAuth, async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      console.log(`Utente autenticato per richiesta opinioni. ID: ${req.user.id}, Email: ${req.user.email}, UUID: ${req.user.uuid || req.user.id}`);
      
      // Priorità di identificativi per recuperare le opinioni:
      // 1. UUID (il più affidabile, è l'ID di Firebase Auth)
      // 2. Email (secondo più affidabile)
      
      const userId = req.user.uuid || req.user.id; // Preferisco usare l'UUID ma fallback all'ID
      const email = req.user.email;
      
      console.log(`Recuperando opinioni con UUID: ${userId}`);
      // Prova prima con l'UUID
      let opinions = await FirebaseService.getUserOpinions(String(userId));
      
      // Se non trova nulla con UUID, prova con l'email
      if (!opinions || (opinions && Object.keys(opinions).every(k => !opinions[k as keyof typeof opinions]))) {
        console.log(`Nessuna opinione trovata con UUID, tento con email: ${email}`);
        const emailOpinions = await FirebaseService.getUserOpinions(email);
        
        if (emailOpinions && Object.keys(emailOpinions).some(k => emailOpinions[k as keyof typeof emailOpinions])) {
          opinions = emailOpinions;
        }
      }
      
      // Se abbiamo trovato opinioni, restituiscile
      if (opinions && Object.keys(opinions).some(k => opinions[k as keyof typeof opinions])) {
        return res.status(200).json(opinions);
      }
      
      // Se non abbiamo trovato nulla, restituisci un oggetto vuoto
      return res.status(200).json({
        energia_nucleare: '',
        sperimentazione_animale: '',
        legalizzazione_canapa: '',
        caccia: '',
        unione_europea: '',
        message: 'Nessuna opinione trovata per questo utente'
      });
    } catch (error) {
      console.error('Errore durante il recupero delle opinioni:', error);
      return res.status(500).json({
        energia_nucleare: '',
        sperimentazione_animale: '',
        legalizzazione_canapa: '',
        caccia: '',
        unione_europea: '',
        error: 'Errore nel recupero delle opinioni',
        message: error instanceof Error ? error.message : 'Errore sconosciuto'
      });
    }
  });

  // API per ottenere le opinioni di un utente specifico (solo per Admin) - UTILIZZA ESCLUSIVAMENTE SUPABASE
  app.get('/api/opinioni/:utente_id', requireAuth, async (req, res) => {
    try {
      const { utente_id } = req.params;
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      // Verifica se l'utente che fa la richiesta è un admin - SOLO VIA SUPABASE
      let isAdmin = false;
      
      // Verifica in Firebase usando l'email dell'utente
      const supabaseUser = await FirebaseService.getUserByEmail(req.user.email);
      if (supabaseUser && supabaseUser.ruolo === 'Admin') {
        isAdmin = true;
      }
      
      // Se non è admin, blocca l'operazione
      if (!isAdmin) {
        return res.status(403).json({ error: 'Solo gli amministratori possono visualizzare le opinioni di altri utenti' });
      }

      // Recupera le opinioni dell'utente specificato
      const opinions = await FirebaseService.getUserOpinions(utente_id);
      
      if (!opinions) {
        return res.status(404).json({ error: 'Opinioni non trovate per questo utente' });
      }
      
      return res.status(200).json(opinions);
    } catch (error) {
      console.error('Errore durante il recupero delle opinioni:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // API per recuperare tutte le opinioni per statistiche - UTILIZZA ESCLUSIVAMENTE SUPABASE
  app.get('/api/statistiche-opinioni', requireAuth, async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }
      
      // Recupera tutte le opinioni degli utenti usando il servizio Firebase
      // Questa funzione utilizza il client admin che bypassa RLS
      const allOpinions = await FirebaseService.getAllUsersOpinions();
      
      console.log(`Recuperate ${allOpinions.length} opinioni per le statistiche`);
      
      return res.status(200).json(allOpinions);
    } catch (error) {
      console.error('Errore durante il recupero delle statistiche opinioni:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // API per aggiornare le opinioni di un utente specifico (solo per Admin) - UTILIZZA ESCLUSIVAMENTE SUPABASE
  app.put('/api/opinioni/:utente_id', requireAuth, async (req, res) => {
    try {
      const { utente_id } = req.params;
      const opinionsData = req.body;
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      // Verifica se l'utente che fa la richiesta è un admin - SOLO VIA SUPABASE
      let isAdmin = false;
      
      // Verifica in Firebase usando l'email dell'utente
      const supabaseUser = await FirebaseService.getUserByEmail(req.user.email);
      if (supabaseUser && supabaseUser.ruolo === 'Admin') {
        isAdmin = true;
      }
      
      // Se non è admin, blocca l'operazione
      if (!isAdmin) {
        return res.status(403).json({ error: 'Solo gli amministratori possono modificare le opinioni di altri utenti' });
      }

      // Aggiorna le opinioni dell'utente specificato
      const result = await FirebaseService.saveUserOpinions(utente_id, opinionsData);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: 'Errore durante l\'aggiornamento delle opinioni',
          details: result.error
        });
      }
      
      return res.status(200).json({ 
        message: 'Opinioni aggiornate con successo',
        data: result.data
      });
    } catch (error) {
      console.error('Errore durante l\'aggiornamento delle opinioni:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Route per recuperare dati utente tramite email (usata dal profilo)
  app.get('/api/users/:email', requireAuth, async (req, res) => {
    try {
      const { email } = req.params;
      const userData = await FirebaseService.getUserByEmail(decodeURIComponent(email));
      
      if (!userData) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }
      
      return res.status(200).json(userData);
    } catch (error) {
      console.error('Errore nel recupero utente:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Route per recuperare tutti gli utenti (usata dalla gestione utenti)
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const users = await FirebaseService.getAllUsersOpinions();
      return res.status(200).json(users);
    } catch (error) {
      console.error('Errore nel recupero utenti:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Route per recuperare candidati
  app.get('/api/candidati', requireAuth, async (req, res) => {
    try {
      const users = await FirebaseService.getAllUsersOpinions();
      const candidati = users.filter(user => 
        user.ruolo === 'Candidato' || user.ruolo === 'Politico Candidato'
      );
      return res.status(200).json(candidati);
    } catch (error) {
      console.error('Errore nel recupero candidati:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Route per reset password
  app.post('/api/reset-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email richiesta' });
      }

      const result = await FirebaseService.resetPassword(email);
      
      if (result.success) {
        return res.status(200).json({ message: 'Email di reset inviata con successo' });
      } else {
        return res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Errore nel reset password:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ===== COMUNICAZIONI API ROUTES =====

  // Check for duplicate comunicazione
  app.get('/api/comunicazioni/check-duplicate', requireAuth, async (req, res) => {
    try {
      const { titolo, zona } = req.query;
      
      if (!titolo || !zona) {
        return res.status(400).json({ error: 'Titolo e zona sono richiesti' });
      }

      const existingComunicazione = await FirebaseService.checkDuplicateComunicazione(
        String(titolo), 
        String(zona)
      );
      
      if (existingComunicazione) {
        return res.status(200).json({
          exists: true,
          comunicazione: existingComunicazione
        });
      }
      
      return res.status(200).json({ exists: false });
    } catch (error) {
      console.error('Errore nel controllo duplicati comunicazione:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Create new comunicazione
  app.post('/api/comunicazioni', requireAuth, async (req, res) => {
    try {
      const { titolo, voto_dato, commento, vincitore, zona, isDuplicate } = req.body;
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      // Get user data
      const userData = await FirebaseService.getUserByEmail(req.user.email);
      if (!userData) {
        return res.status(404).json({ error: 'Dati utente non trovati' });
      }

      // Check if user has the right role
      if (userData.ruolo !== 'Politico' && userData.ruolo !== 'Candidato Politico') {
        return res.status(403).json({ error: 'Solo i Politici e Candidati Politici possono creare comunicazioni' });
      }

      // Elimina tutte le comunicazioni precedenti dell'utente
      console.log(`🗑️ Eliminando comunicazioni precedenti per utente: ${req.user.uid || req.user.id}`);
      const deleteResult = await FirebaseService.deletePreviousComunicazioni(req.user.uid || req.user.id);
      
      if (!deleteResult.success) {
        console.error('Errore eliminazione comunicazioni precedenti:', deleteResult.error);
        // Continua comunque con la creazione della nuova comunicazione
      } else {
        console.log(`✅ Eliminate ${deleteResult.deletedCount} comunicazioni precedenti e relative notifiche`);
      }

      const comunicazioneData = {
        id_utente: req.user.uid || req.user.id,
        nome: userData.nome,
        cognome: userData.cognome,
        ruolo: userData.ruolo,
        titolo,
        voto_dato,
        commento: commento || "",
        vincitore,
        zona,
        data_creazione: new Date().toISOString(),
        punti_trasparenza: isDuplicate ? 1 : 3,
        likes: 0,
        dislikes: 0
      };

      const result = await FirebaseService.saveComunicazione(comunicazioneData);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: 'Errore durante il salvataggio della comunicazione',
          details: result.error
        });
      }

      // Update user's ultima comunicazione
      const ultimaComunicazione = {
        titolo,
        voto_dato,
        vincitore,
        data: new Date().toISOString()
      };

      await FirebaseService.updateUltimaComunicazione(req.user.email, ultimaComunicazione);

      // Send notifications to users who chose this representative
      await FirebaseService.sendNotificationsForComunicazione(
        req.user.email, // Usa l'email invece dell'UID per il confronto
        userData.nome,
        userData.cognome,
        titolo,
        voto_dato,
        commento || "",
        vincitore,
        result.comunicazioneId || ''
      );

      return res.status(201).json({ 
        message: 'Comunicazione creata con successo',
        data: result.data
      });
    } catch (error) {
      console.error('Errore durante la creazione della comunicazione:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Get user's last communication
  app.get('/api/ultima-comunicazione', requireAuth, async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      const ultimaComunicazione = await FirebaseService.getUltimaComunicazione(req.user.uid || req.user.id);
      
      if (!ultimaComunicazione) {
        return res.status(404).json({ error: 'Nessuna comunicazione precedente trovata' });
      }

      return res.status(200).json(ultimaComunicazione);
    } catch (error) {
      console.error('Errore nel recupero ultima comunicazione:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Get podio trasparenza
  app.get('/api/podio-trasparenza', async (req, res) => {
    try {
      const podioUsers = await FirebaseService.getPodioTrasparenza();
      return res.status(200).json(podioUsers);
    } catch (error) {
      console.error('Errore nel recupero podio trasparenza:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ===== NOTIFICHE API ROUTES =====

  // Get user notifications
  app.get('/api/notifiche', requireAuth, async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      const notifiche = await FirebaseService.getUserNotifications(req.user.uid || req.user.id);
      return res.status(200).json(notifiche);
    } catch (error) {
      console.error('Errore nel recupero notifiche:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Mark notification as read
  app.patch('/api/notifiche/:id/read', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      const result = await FirebaseService.markNotificationAsRead(id, req.user.uuid || req.user.id);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: 'Errore durante l\'aggiornamento della notifica',
          details: result.error
        });
      }

      return res.status(200).json({ message: 'Notifica segnata come letta' });
    } catch (error) {
      console.error('Errore durante l\'aggiornamento della notifica:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // React to comunicazione (like/dislike)
  app.post('/api/comunicazioni/:id/react', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { reaction } = req.body;
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      if (!['like', 'dislike'].includes(reaction)) {
        return res.status(400).json({ error: 'Reazione non valida' });
      }

      const result = await FirebaseService.reactToComunicazione(
        id, 
        req.user.uuid || req.user.id, 
        reaction
      );
      
      if (!result.success) {
        return res.status(500).json({ 
          error: 'Errore durante la reazione',
          details: result.error
        });
      }

      return res.status(200).json({ 
        message: 'Reazione registrata con successo',
        data: result.data
      });
    } catch (error) {
      console.error('Errore durante la reazione:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Endpoint per salvare la configurazione dell'avatar
  app.post('/api/users/:email/avatar', requireAuth, async (req, res) => {
    try {
      const { email } = req.params;
      const { avatar_config } = req.body;

      if (!email || !avatar_config) {
        return res.status(400).json({ error: 'Email e configurazione avatar richieste' });
      }

      // Decodifica l'email se necessario
      const decodedEmail = decodeURIComponent(email);

      // Aggiorna la configurazione avatar nel database Firebase
      const result = await FirebaseService.updateUserData(decodedEmail, { avatar_config });

      if (result.success) {
        res.json({ success: true, message: 'Configurazione avatar salvata con successo' });
      } else {
        res.status(500).json({ error: result.error || 'Errore nel salvataggio della configurazione avatar' });
      }
    } catch (error) {
      console.error('Errore durante il salvataggio della configurazione avatar:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ===== ELEZIONI API ROUTES =====

  // Get all elections
  app.get('/api/elezioni', requireAuth, async (req, res) => {
    try {
      const elezioni = await FirebaseService.getAllElezioni();
      return res.status(200).json(elezioni);
    } catch (error) {
      console.error('Errore nel recupero delle elezioni:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Get specific election by ID
  app.get('/api/elezioni/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const elezione = await FirebaseService.getElezioneById(id);
      
      if (!elezione) {
        return res.status(404).json({ error: 'Elezione non trovata' });
      }
      
      return res.status(200).json(elezione);
    } catch (error) {
      console.error('Errore nel recupero dell\'elezione:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Create new election
  app.post('/api/elezioni', requireAuth, async (req, res) => {
    try {
      const elezioneData = req.body;
      
      // Validate required fields
      const requiredFields = ['tipo', 'nome', 'dataInizio', 'dataFine', 'circa'];
      for (const field of requiredFields) {
        if (elezioneData[field] === undefined || elezioneData[field] === null) {
          return res.status(400).json({ error: `Campo richiesto mancante: ${field}` });
        }
      }

      // Validate tipo field
      const validTypes = ['sovranazione', 'stato', 'regione', 'provincia', 'comune'];
      if (!validTypes.includes(elezioneData.tipo)) {
        return res.status(400).json({ error: 'Tipo di elezione non valido' });
      }

      // Validate dates if not circa
      if (!elezioneData.circa) {
        const dataInizio = new Date(elezioneData.dataInizio);
        const dataFine = new Date(elezioneData.dataFine);
        
        if (isNaN(dataInizio.getTime()) || isNaN(dataFine.getTime())) {
          return res.status(400).json({ error: 'Date non valide' });
        }
        
        if (dataFine <= dataInizio) {
          return res.status(400).json({ error: 'La data di fine deve essere successiva alla data di inizio' });
        }
      } else {
        // Validate years if circa is true
        const annoInizio = parseInt(elezioneData.dataInizio);
        const annoFine = parseInt(elezioneData.dataFine);
        
        if (isNaN(annoInizio) || isNaN(annoFine)) {
          return res.status(400).json({ error: 'Anni non validi' });
        }
        
        if (annoFine < annoInizio) {
          return res.status(400).json({ error: 'L\'anno di fine deve essere successivo o uguale all\'anno di inizio' });
        }
      }

      const result = await FirebaseService.createElezione(elezioneData);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: 'Errore durante la creazione dell\'elezione',
          details: result.error
        });
      }

      return res.status(201).json({ 
        id: result.id,
        message: 'Elezione creata con successo'
      });
    } catch (error) {
      console.error('Errore durante la creazione dell\'elezione:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Update election
  app.put('/api/elezioni/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const elezioneData = req.body;
      
      // Validate required fields
      const requiredFields = ['sovranazione', 'stato', 'regione', 'provincia', 'comune', 'dataInizio', 'dataFine'];
      for (const field of requiredFields) {
        if (!elezioneData[field]) {
          return res.status(400).json({ error: `Campo richiesto mancante: ${field}` });
        }
      }

      // Validate dates
      const dataInizio = new Date(elezioneData.dataInizio);
      const dataFine = new Date(elezioneData.dataFine);
      
      if (dataFine <= dataInizio) {
        return res.status(400).json({ error: 'La data di fine deve essere successiva alla data di inizio' });
      }

      // Check if election exists
      const existingElezione = await FirebaseService.getElezioneById(id);
      if (!existingElezione) {
        return res.status(404).json({ error: 'Elezione non trovata' });
      }

      const result = await FirebaseService.updateElezione(id, elezioneData);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: 'Errore durante l\'aggiornamento dell\'elezione',
          details: result.error
        });
      }

      return res.status(200).json({ message: 'Elezione aggiornata con successo' });
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'elezione:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Delete election
  app.delete('/api/elezioni/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if election exists
      const existingElezione = await FirebaseService.getElezioneById(id);
      if (!existingElezione) {
        return res.status(404).json({ error: 'Elezione non trovata' });
      }

      const result = await FirebaseService.deleteElezione(id);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: 'Errore durante l\'eliminazione dell\'elezione',
          details: result.error
        });
      }

      return res.status(200).json({ message: 'Elezione eliminata con successo' });
    } catch (error) {
      console.error('Errore durante l\'eliminazione dell\'elezione:', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
