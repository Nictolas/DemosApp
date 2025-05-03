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

  const httpServer = createServer(app);

  return httpServer;
}
