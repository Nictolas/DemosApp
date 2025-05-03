import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import SupabaseService from "./supabase-service";
import { db } from "../db";
import { users, utenti } from "@shared/schema";
import { eq } from "drizzle-orm";

// Estendi l'interfaccia Request per includere user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
      };
      isAuthenticated(): boolean;
    }
  }
}

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
      if (req.user && req.user.id !== userId) {
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

  // API per aggiornare il profilo utente
  app.put('/api/users/:email', requireAuth, async (req, res) => {
    try {
      const { email } = req.params;
      const userData = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email utente non valida' });
      }
      
      console.log(`User ID richiedente: ${req.user?.id}`);
      console.log(`Email richiedente: ${req.user?.email}`);
      console.log("Dati di aggiornamento ricevuti:", userData);
      
      // Verifica se l'utente è admin o sta modificando il proprio profilo
      const isOwnProfile = req.user?.email === email;
      let isAdmin = false;
      
      // Verifica se l'utente è admin (controllo in Supabase)
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
      
      // Verifica anche nel database locale
      if (req.user?.id) {
        const userDetails = await storage.getUserProfile(req.user.id);
        if (!isAdmin && userDetails && userDetails.ruolo === 'Admin') {
          isAdmin = true;
          console.log("L'utente è un admin secondo il database locale");
        }
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
      
      // Se è il proprio profilo, aggiorna anche il database locale
      if (isOwnProfile && req.user?.id) {
        try {
          // Cerca l'utente nel DB locale
          const localUser = await storage.getUserByEmail(email);
          
          if (localUser) {
            // Aggiorna anche in PostgreSQL
            await db.update(utenti)
              .set({
                nome: userData.nome,
                cognome: userData.cognome,
                data_nascita: userData.data_nascita,
                genere: userData.genere,
                cittadinanza: userData.cittadinanza,
                paese_residenza: userData.paese_residenza,
                regione_residenza: userData.regione_residenza,
                provincia_residenza: userData.provincia_residenza,
                comune_residenza: userData.comune_residenza,
                paese_elezione: userData.paese_elezione || '',
                regione_elezione: userData.regione_elezione || '',
                provincia_elezione: userData.provincia_elezione || '',
                comune_elezione: userData.comune_elezione || '',
                paese_candidatura: userData.paese_candidatura || '',
                regione_candidatura: userData.regione_candidatura || '',
                provincia_candidatura: userData.provincia_candidatura || '',
                comune_candidatura: userData.comune_candidatura || '',
                ruolo: userData.ruolo,
                grado_elezione: userData.grado_elezione || '',
                grado_candidatura: userData.grado_candidatura || ''
              })
              .where(eq(utenti.user_id, localUser.id));
              
            console.log("Profilo aggiornato anche nel database locale");
          } else {
            console.log("Utente non trovato nel database locale, aggiornato solo su Supabase");
          }
        } catch (dbError) {
          console.error("Errore nell'aggiornamento del database locale:", dbError);
          // Continuiamo comunque perché Supabase è il database principale
        }
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

  // API per eliminare un utente (solo per Admin)
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

      // Verifica se l'utente che fa la richiesta è un Admin
      // Problema: storage.getUserById cerca l'utente nella tabella utenti per id, 
      // ma cerchiamo per l'id dell'utente, non per user_id
      
      console.log("User ID richiedente:", req.user.id);
      console.log("Email richiedente:", req.user.email);
      
      // Prima cerchiamo nella tabella utenti per user_id
      const userDetails = await storage.getUserProfile(req.user.id);
      console.log("Dettagli utente da user_id:", userDetails);
      
      // Poi cerchiamo l'utente in Supabase tramite l'email
      let isAdmin = false;
      
      try {
        // Verifica in Supabase usando il nostro servizio
        const supabaseUser = await SupabaseService.getUserByEmail(req.user.email);
        console.log("Dati da Supabase:", supabaseUser);
        
        if (supabaseUser && supabaseUser.ruolo === 'Admin') {
          isAdmin = true;
          console.log("L'utente è un admin secondo Supabase");
        }
      } catch (error) {
        console.error("Errore nel controllo Supabase:", error);
      }
      
      // Poi cerchiamo in utenti locali
      if (!isAdmin && userDetails && userDetails.ruolo === 'Admin') {
        isAdmin = true;
        console.log("L'utente è un admin secondo il database locale");
      }
      
      if (!isAdmin) {
        return res.status(403).json({ error: 'Solo gli amministratori possono eliminare utenti' });
      }

      // Verifica se l'utente esiste
      const userToDelete = await storage.getUserByEmail(email);
      if (!userToDelete) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      console.log(`Deleting user with email ${email} from PostgreSQL`);
      
      // Elimina i dettagli dell'utente nel database locale
      await db.delete(utenti).where(eq(utenti.user_id, userToDelete.id));
      
      // Elimina l'utente nel database locale
      await db.delete(users).where(eq(users.id, userToDelete.id));
      
      // Elimina l'utente in Supabase
      const { success, error } = await SupabaseService.deleteUserByEmail(email);
      
      if (!success) {
        console.error("Errore durante l'eliminazione dell'utente da Supabase:", error);
        // Continuiamo comunque, è stato eliminato dal database locale
      }
      
      return res.status(200).json({ message: 'Utente eliminato con successo' });
    } catch (error) {
      console.error("Errore durante l'eliminazione dell'utente:", error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // API per salvare le opinioni dell'utente
  app.post('/api/opinioni', requireAuth, async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      console.log(`Utente autenticato. ID: ${req.user.id}, Email: ${req.user.email}`);
      
      // Utilizza direttamente l'ID dalla sessione Express, che è l'ID dalla tabella "users"
      // Questo dovrebbe corrispondere con il vincolo di chiave esterna sulla tabella "opinioni"
      const userId = req.user.id;
      
      // Salva le opinioni dell'utente con l'ID numerico della tabella users
      const opinionsData = req.body;
      console.log(`Salvando opinioni per utente con ID: ${userId}`, opinionsData);
      
      const result = await SupabaseService.saveUserOpinions(userId.toString(), opinionsData);
      
      if (!result.success) {
        console.error('Errore nel salvataggio delle opinioni:', result.error);
        
        // In caso di fallimento, proviamo a usare l'email come fallback (per retrocompatibilità)
        console.log('Tentativo di salvataggio con email come ID:', req.user.email);
        const fallbackResult = await SupabaseService.saveUserOpinions(req.user.email, opinionsData);
        
        if (fallbackResult.success) {
          console.log('Salvataggio riuscito con email come ID');
          return res.status(200).json({
            message: 'Opinioni salvate con metodo alternativo',
            data: fallbackResult.data,
            note: fallbackResult.note || 'Salvate usando l\'email come identificativo',
            temp_storage: true
          });
        }
        
        return res.status(500).json({ 
          error: 'Errore nel salvataggio delle opinioni', 
          details: result.error,
          data: result.data,
          note: result.note
        });
      }

      // Anche se ci sono stati problemi, restituiamo un successo dato che i dati sono salvati in memoria
      return res.status(200).json({ 
        message: 'Opinioni salvate',
        data: result.data,
        note: result.note, // Questo potrebbe contenere informazioni sul salvataggio in memoria
        persistent: result.success && !result.note // Indica se i dati sono persistenti (nel DB) o temporanei (in memoria)
      });
    } catch (error) {
      console.error('Errore durante il salvataggio delle opinioni:', error);
      
      // Anche in caso di errore grave, proviamo a salvare in memoria
      if (req.user && req.user.email) {
        const tempUserId = req.user.email;
        const opinionsData = req.body;
        
        try {
          SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
          SupabaseService.tempOpinions[tempUserId] = {
            utente_id: tempUserId,
            ...opinionsData
          };
          
          return res.status(200).json({
            message: 'Opinioni salvate solo in memoria temporanea a causa di un errore',
            data: [SupabaseService.tempOpinions[tempUserId]],
            error_message: error instanceof Error ? error.message : 'Errore sconosciuto',
            temp_storage: true
          });
        } catch (memoryError) {
          console.error('Errore anche nel salvataggio in memoria:', memoryError);
        }
      }
      
      return res.status(500).json({ error: 'Errore grave durante il salvataggio delle opinioni' });
    }
  });

  // API per ottenere le opinioni dell'utente
  app.get('/api/opinioni', requireAuth, async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      console.log(`Utente autenticato per richiesta opinioni. ID: ${req.user.id}, Email: ${req.user.email}`);
      
      // Utilizza direttamente l'ID dalla sessione Express, che è l'ID dalla tabella "users"
      // Questo dovrebbe corrispondere con il vincolo di chiave esterna sulla tabella "opinioni"
      const userId = req.user.id;
      
      // Recupera le opinioni dell'utente usando l'ID numerico della tabella users
      console.log(`Recuperando opinioni per utente con ID numerico: ${userId}`);
      const opinions = await SupabaseService.getUserOpinions(userId.toString());
      
      // Se non viene trovato nulla, controlla se ci sono opinioni salvate con ID alternativo
      if (!opinions || (opinions && Object.keys(opinions).every(k => !opinions[k]))) {
        console.log('Nessuna opinione trovata con ID numerico, provo con altri metodi...');
        
        // Prima cerca con l'email (metodo di fallback)
        console.log('Provo a recuperare opinioni usando email come ID:', req.user.email);
        const opinionsWithEmail = await SupabaseService.getUserOpinions(req.user.email);
        
        if (opinionsWithEmail && Object.keys(opinionsWithEmail).some(k => !!opinionsWithEmail[k])) {
          console.log('Trovate opinioni usando email come ID');
          return res.status(200).json(opinionsWithEmail);
        }
        
        // Come ultima risorsa, cerca nelle opinioni memorizzate temporaneamente
        if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[req.user.email]) {
          console.log('Trovate opinioni in memoria temporanea per:', req.user.email);
          return res.status(200).json(SupabaseService.tempOpinions[req.user.email]);
        }
        
        // Se non abbiamo niente, restituisci un oggetto opinioni vuoto
        return res.status(200).json({
          energia_nucleare: '',
          sperimentazione_animale: '',
          legalizzazione_canapa: '',
          caccia: '',
          unione_europea: '',
          temp_storage: true,
          message: 'Nessuna opinione trovata per questo utente'
        });
      }
      
      return res.status(200).json(opinions || {});
    } catch (error) {
      console.error('Errore durante il recupero delle opinioni:', error);
      
      // Anche in caso di errore, prova a recuperare dalla memoria
      if (req.user && req.user.email && SupabaseService.tempOpinions && SupabaseService.tempOpinions[req.user.email]) {
        return res.status(200).json({
          ...SupabaseService.tempOpinions[req.user.email],
          temp_storage: true,
          error_message: 'Recuperato da memoria a causa di un errore'
        });
      }
      
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // API per ottenere le opinioni di un utente specifico (solo per Admin)
  app.get('/api/opinioni/:utente_id', requireAuth, async (req, res) => {
    try {
      const { utente_id } = req.params;
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      // Verifica se l'utente che fa la richiesta è un admin
      let isAdmin = false;
      
      // Verifica in Supabase
      const supabaseUser = await SupabaseService.getUserByEmail(req.user.email);
      if (supabaseUser && supabaseUser.ruolo === 'Admin') {
        isAdmin = true;
      }
      
      // Verifica nel database locale
      if (!isAdmin) {
        const userDetails = await storage.getUserProfile(req.user.id);
        if (userDetails && userDetails.ruolo === 'Admin') {
          isAdmin = true;
        }
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

  // API per aggiornare le opinioni di un utente specifico (solo per Admin)
  app.put('/api/opinioni/:utente_id', requireAuth, async (req, res) => {
    try {
      const { utente_id } = req.params;
      const opinionsData = req.body;
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }

      // Verifica se l'utente che fa la richiesta è un admin
      let isAdmin = false;
      
      // Verifica in Supabase
      const supabaseUser = await SupabaseService.getUserByEmail(req.user.email);
      if (supabaseUser && supabaseUser.ruolo === 'Admin') {
        isAdmin = true;
      }
      
      // Verifica nel database locale
      if (!isAdmin) {
        const userDetails = await storage.getUserProfile(req.user.id);
        if (userDetails && userDetails.ruolo === 'Admin') {
          isAdmin = true;
        }
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
