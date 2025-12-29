#!/usr/bin/env node

/**
 * Configurazione Auth.js (NextAuth) per DemosApp
 */

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { Pool } from 'pg';
import { CIEProvider } from './providers/cie-provider.js';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

export const authOptions = {
  providers: [
    // Provider CIE - Sostituisce il Codice Fiscale
    CIEProvider({
      clientId: process.env.CIE_CLIENT_ID,
      clientSecret: process.env.CIE_CLIENT_SECRET,
    }),
    
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
    }),
    
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Implementa logica per credenziali personalizzate se necessario
        return null;
      }
    }),
  ],
  
  session: {
    strategy: 'jwt',
  },
  
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        // Primo accesso - salva info utente nel token
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    
    async session({ session, token }) {
      // Passa info utente alla sessione
      if (token) {
        session.user.id = token.userId;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture;
      }
      return session;
    },
    
    async signIn({ user, account, profile }) {
      if (account?.provider === 'cie') {
        try {
          // Verifica se l'utente esiste già nel database tramite codice fiscale CIE
          const existingUser = await pool.query(
            'SELECT * FROM users WHERE codice_fiscale = $1 OR email = $2',
            [user.codice_fiscale, user.email]
          );
          
          if (existingUser.rows.length === 0) {
            // Crea nuovo utente CIE se non esiste
            await pool.query(`
              INSERT INTO users (
                id, email, nome, cognome, codice_fiscale, 
                data_nascita, sesso, status, ruolo, auth_method, verified
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (email) DO UPDATE SET
                nome = EXCLUDED.nome,
                cognome = EXCLUDED.cognome,
                codice_fiscale = EXCLUDED.codice_fiscale,
                auth_method = EXCLUDED.auth_method,
                verified = EXCLUDED.verified,
                updated_at = CURRENT_TIMESTAMP
            `, [
              user.id,
              user.email,
              user.nome,
              user.cognome,
              user.codice_fiscale,
              user.data_nascita,
              user.sesso,
              'approved', // CIE è sempre approvato
              'user',
              'cie',
              true
            ]);
          } else {
            // Aggiorna metodo di autenticazione se utente esiste
            await pool.query(`
              UPDATE users SET 
                auth_method = 'cie',
                verified = true,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [existingUser.rows[0].id]);
          }
          
          return true;
        } catch (error) {
          console.error('Errore durante signIn CIE:', error);
          return false;
        }
      }
      
      if (account?.provider === 'google') {
        try {
          // Verifica se l'utente esiste già nel database
          const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [user.email]
          );
          
          if (existingUser.rows.length === 0) {
            // Crea nuovo utente se non esiste
            const nameParts = user.name?.split(' ') || ['Utente', 'Anonimo'];
            const nome = nameParts[0];
            const cognome = nameParts.slice(1).join(' ') || 'Anonimo';
            
            await pool.query(`
              INSERT INTO users (id, email, nome, cognome, status, ruolo, premium, auth_method)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (email) DO UPDATE SET
                nome = EXCLUDED.nome,
                cognome = EXCLUDED.cognome,
                updated_at = CURRENT_TIMESTAMP
            `, [
              user.id,
              user.email,
              nome,
              cognome,
              'approved',
              'user',
              false,
              'google'
            ]);
          }
          
          return true;
        } catch (error) {
          console.error('Errore durante signIn Google:', error);
          return false;
        }
      }
      
      return true;
    },
  },
  
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
};

export default NextAuth(authOptions);
