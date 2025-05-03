import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Middleware di autenticazione per le rotte protette
  const requireAuth = (req: any, res: any, next: any) => {
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

  const httpServer = createServer(app);

  return httpServer;
}
