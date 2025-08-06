import { v4 as uuidv4 } from 'uuid';
import pool from './config/database.js';

class AuthService {
  static async register(userData) {
    const client = await pool.connect();
    try {
      const { email, password, ...userDetails } = userData;
      
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM utenti WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        return { success: false, error: 'Utente già esistente' };
      }
      
      // For now, store password as plain text (in production, use bcrypt)
      const userId = uuidv4();
      
      // Insert user
      const result = await client.query(
        `INSERT INTO utenti (id, email, password_hash, nome, cognome, data_nascita, 
         comune_nascita, comune_residenza, created_at, updated_at, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), 'pending') 
         RETURNING id, email, nome, cognome`,
        [userId, email, password, userDetails.nome, userDetails.cognome, 
         userDetails.data_nascita, userDetails.comune_nascita, userDetails.comune_residenza]
      );
      
      return { success: true, user: result.rows[0] };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Errore durante la registrazione' };
    } finally {
      client.release();
    }
  }

  static async login(email, password) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, nome, cognome, status FROM utenti WHERE email = $1 AND password_hash = $2',
        [email, password]
      );
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Credenziali non valide' };
      }
      
      const user = result.rows[0];
      
      if (user.status !== 'approved') {
        return { success: false, error: 'Account in attesa di approvazione' };
      }
      
      // In production, generate a proper JWT token here
      const token = `demo-token-${user.id}`;
      
      return { 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          cognome: user.cognome
        },
        token 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Errore durante il login' };
    } finally {
      client.release();
    }
  }

  static async getUserById(userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, nome, cognome, data_nascita, comune_nascita, comune_residenza, status FROM utenti WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Utente non trovato' };
      }
      
      return { success: true, user: result.rows[0] };
    } catch (error) {
      console.error('Get user error:', error);
      return { success: false, error: 'Errore nel recupero utente' };
    } finally {
      client.release();
    }
  }

  static handleError(error, method) {
    console.error(`AuthService.${method} error:`, error);
    return { 
      success: false, 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Errore interno del server' 
    };
  }
}

export default AuthService;
