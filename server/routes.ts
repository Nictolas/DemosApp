import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import SupabaseService, { UserOpinions } from "./supabase-service";
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
      const users = await storage.getAllUsers();
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
      
      // Verifica se l'utente è admin (controllo SOLO in Supabase)
      try {
        if (req.user?.email) {
          const supabaseUser = await SupabaseService.getUserByEmail(req.user.email);
          if (supabaseUser && supabaseUser.ruolo === 'Admin') {
            isAdmin = true;
            console.log("L'utente è un admin secondo Supabase");
          }
        }
      } catch (error) {
        console.error("Errore nel controllo Supabase:", error);
      }
      
      // Se non è il proprio profilo e non è admin, blocca l'operazione
      if (!isOwnProfile && !isAdmin) {
        return res.status(403).json({ 
          error: 'Non hai i permessi per modificare questo profilo' 
        });
      }
      
      // Verifica se l'utente esiste in Supabase
      const existingUser = await SupabaseService.getUserByEmail(email);
      if (!existingUser) {
        return res.status(404).json({ error: 'Utente non trovato in Supabase' });
      }
      
      // Aggiorna il profilo in Supabase
      const { success, error, data } = await SupabaseService.updateUserData(email, userData);
      
      if (!success) {
        return res.status(500).json({ 
          error: 'Errore durante l\'aggiornamento del profilo su Supabase',
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
      
      // Verifica se l'utente che fa la richiesta è admin (controllo SOLO in Supabase)
      let isAdmin = false;
      
      // Verifica in Supabase usando il nostro servizio
      try {
        const supabaseUser = await SupabaseService.getUserByEmail(req.user.email);
        console.log("Dati da Supabase:", supabaseUser);
        
        if (supabaseUser && supabaseUser.ruolo === 'Admin') {
          isAdmin = true;
          console.log("L'utente è un admin secondo Supabase");
        }
      } catch (error) {
        console.error("Errore nel controllo Supabase:", error);
      }
      
      if (!isAdmin) {
        return res.status(403).json({ error: 'Solo gli amministratori possono eliminare utenti' });
      }

      // Verifica se l'utente esiste in Supabase
      const userToDelete = await SupabaseService.getUserByEmail(email);
      if (!userToDelete) {
        return res.status(404).json({ error: 'Utente non trovato in Supabase' });
      }

      console.log(`Richiesta eliminazione utente con email ${email} da Supabase`);
      
      // Elimina l'utente in Supabase
      const { success, error } = await SupabaseService.deleteUserByEmail(email);
      
      if (!success) {
        console.error("Errore durante l'eliminazione dell'utente da Supabase:", error);
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
      // 1. UUID (il più affidabile, è l'ID di Supabase Auth)
      // 2. Email (secondo più affidabile)
      // 3. ID di sessione (usato solo come ultima risorsa)
      
      const userId = req.user.uuid || req.user.id; // Preferisco usare l'UUID ma fallback all'ID
      const email = req.user.email;
      
      // Assicuriamo che l'email sia presente nei dati delle opinioni
      // Prima verifichiamo se l'email è nel payload, altrimenti usiamo quella dell'utente
      if (!opinionsData.email && email) {
        opinionsData.email = email;
        console.log(`Email aggiunta automaticamente ai dati: ${email}`);
      }
      
      // Logghiamo l'operazione
      console.log(`Salvando opinioni su Supabase per utente - UUID: ${userId}, Email: ${email}`);
      console.log('Dati opinioni completi:', JSON.stringify(opinionsData, null, 2));
      
      // Salviamo direttamente con l'UUID - convertiamo a stringa per sicurezza
      let result = await SupabaseService.saveUserOpinions(String(userId), opinionsData);
      
      // Se fallisce, proviamo con l'email
      if (!result.success && email) {
        console.log(`Fallback: salvando con email ${email}`);
        result = await SupabaseService.saveUserOpinions(email, opinionsData);
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
      // 1. UUID (il più affidabile, è l'ID di Supabase Auth)
      // 2. Email (secondo più affidabile)
      
      const userId = req.user.uuid || req.user.id; // Preferisco usare l'UUID ma fallback all'ID
      const email = req.user.email;
      
      console.log(`Recuperando opinioni con UUID: ${userId}`);
      // Prova prima con l'UUID
      let opinions = await SupabaseService.getUserOpinions(String(userId));
      
      // Se non trova nulla con UUID, prova con l'email
      if (!opinions || (opinions && Object.keys(opinions).every(k => !opinions[k as keyof typeof opinions]))) {
        console.log(`Nessuna opinione trovata con UUID, tento con email: ${email}`);
        const emailOpinions = await SupabaseService.getUserOpinions(email);
        
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
      
      // Verifica in Supabase usando l'email dell'utente
      const supabaseUser = await SupabaseService.getUserByEmail(req.user.email);
      if (supabaseUser && supabaseUser.ruolo === 'Admin') {
        isAdmin = true;
      }
      
      // Se non è admin, blocca l'operazione
      if (!isAdmin) {
        return res.status(403).json({ error: 'Solo gli amministratori possono visualizzare le opinioni di altri utenti' });
      }

      // Recupera le opinioni dell'utente specificato
      const opinions = await SupabaseService.getUserOpinions(utente_id);
      
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
      
      // Recupera tutte le opinioni degli utenti usando il servizio Supabase
      // Questa funzione utilizza il client admin che bypassa RLS
      const allOpinions = await SupabaseService.getAllUsersOpinions();
      
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
      
      // Verifica in Supabase usando l'email dell'utente
      const supabaseUser = await SupabaseService.getUserByEmail(req.user.email);
      if (supabaseUser && supabaseUser.ruolo === 'Admin') {
        isAdmin = true;
      }
      
      // Se non è admin, blocca l'operazione
      if (!isAdmin) {
        return res.status(403).json({ error: 'Solo gli amministratori possono modificare le opinioni di altri utenti' });
      }

      // Aggiorna le opinioni dell'utente specificato
      const result = await SupabaseService.saveUserOpinions(utente_id, opinionsData);
      
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

  const httpServer = createServer(app);

  return httpServer;
}
