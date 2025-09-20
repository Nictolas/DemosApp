#!/usr/bin/env node

/**
 * Configurazione Auth.js (NextAuth) per DemosApp
 */

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

export const authOptions = {
  providers: [
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
      if (account?.provider === 'google') {
        try {
          // Verifica se l'utente esiste già nel database
          const existingUser = await pool.query(
            'SELECT * FROM utenti WHERE email = $1',
            [user.email]
          );
          
          if (existingUser.rows.length === 0) {
            // Crea nuovo utente se non esiste
            const nameParts = user.name?.split(' ') || ['Utente', 'Anonimo'];
            const nome = nameParts[0];
            const cognome = nameParts.slice(1).join(' ') || 'Anonimo';
            
            await pool.query(`
              INSERT INTO utenti (id, email, nome, cognome, status, ruolo, premium)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
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
              false
            ]);
          }
          
          return true;
        } catch (error) {
          console.error('Errore durante signIn:', error);
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
