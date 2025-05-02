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

  const httpServer = createServer(app);

  return httpServer;
}
