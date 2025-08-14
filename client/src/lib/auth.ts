import NextAuth from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PostgreSQLAdapter } from '@auth/postgresql-adapter';
import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Configurazione Auth.js
export const authOptions: NextAuthOptions = {
  adapter: PostgreSQLAdapter(pool),
  
  providers: [
    // Provider Google
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    
    // Provider Credenziali (per login email/password)
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Query per verificare le credenziali nel database
          const result = await pool.query(
            'SELECT * FROM utenti WHERE email = $1',
            [credentials.email]
          );

          const user = result.rows[0];
          
          if (!user) {
            return null;
          }

          // TODO: Implementare verifica password hashata
          // Per ora, accetta qualsiasi password (solo per sviluppo)
          if (user.status === 'approved') {
            return {
              id: user.id,
              email: user.email,
              name: `${user.nome} ${user.cognome}`,
              image: null,
              role: user.ruolo || 'user',
              premium: user.premium || false
            };
          }

          return null;
        } catch (error) {
          console.error('Errore autenticazione:', error);
          return null;
        }
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // Aggiungi informazioni utente al token JWT
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.premium = user.premium;
      }
      
      return token;
    },

    async session({ session, token }) {
      // Aggiungi informazioni utente alla sessione
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.premium = token.premium as boolean;
      }
      
      return session;
    },

    async signIn({ user, account, profile }) {
      // Logica personalizzata per il sign-in
      if (account?.provider === 'google') {
        // Verifica se l'utente esiste nel database
        try {
          const result = await pool.query(
            'SELECT * FROM utenti WHERE email = $1',
            [user.email]
          );

          if (result.rows.length === 0) {
            // Crea nuovo utente se non esiste
            const newUser = await pool.query(
              `INSERT INTO utenti (id, email, nome, cognome, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *`,
              [
                user.id,
                user.email,
                user.name?.split(' ')[0] || '',
                user.name?.split(' ').slice(1).join(' ') || '',
                'pending', // Status iniziale
                new Date(),
                new Date()
              ]
            );
          }
        } catch (error) {
          console.error('Errore durante sign-in:', error);
          return false;
        }
      }

      return true;
    }
  },

  pages: {
    signIn: '/auth-page',
    signOut: '/',
    error: '/auth-page',
    verifyRequest: '/auth-page',
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Hook personalizzato per l'autenticazione
export const useAuth = () => {
  // Questo hook sarà implementato con useSession di NextAuth
  // Per ora, restituisce un placeholder
  return {
    user: null,
    loading: false,
    signIn: async (email: string, password: string) => {
      // Implementazione sign-in
    },
    signOut: async () => {
      // Implementazione sign-out
    },
    signInWithGoogle: async () => {
      // Implementazione sign-in con Google
    }
  };
};

// Funzioni di utilità per l'autenticazione
export const authUtils = {
  // Verifica se l'utente è autenticato
  isAuthenticated: (user: any) => {
    return !!user && user.status === 'approved';
  },

  // Verifica se l'utente è admin
  isAdmin: (user: any) => {
    return user?.role === 'admin';
  },

  // Verifica se l'utente è premium
  isPremium: (user: any) => {
    return user?.premium === true;
  },

  // Verifica se l'utente può accedere a funzionalità specifiche
  canAccess: (user: any, feature: string) => {
    if (!user) return false;
    
    switch (feature) {
      case 'admin':
        return user.role === 'admin';
      case 'premium':
        return user.premium === true;
      case 'voting':
        return user.status === 'approved';
      default:
        return true;
    }
  }
};

// Configurazione per il client
export const authConfig = {
  providers: authOptions.providers,
  callbacks: authOptions.callbacks,
  pages: authOptions.pages,
  secret: authOptions.secret,
};

export default NextAuth(authOptions);
