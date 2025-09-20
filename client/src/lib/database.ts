import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: import.meta.env.VITE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

// Funzioni helper per il database
export const db = {
  // Query generica
  query: (text: string, params?: any[]) => pool.query(text, params),
  
  // Ottieni client per transazioni
  getClient: () => pool.connect(),
  
  // Chiudi connessione
  end: () => pool.end()
};

// Funzioni specifiche per le tabelle principali
export const users = {
  // Ottieni tutti gli utenti
  getAll: async () => {
    const result = await db.query('SELECT * FROM utenti ORDER BY created_at DESC');
    return result.rows;
  },
  
  // Ottieni utente per ID
  getById: async (id: string) => {
    const result = await db.query('SELECT * FROM utenti WHERE id = $1', [id]);
    return result.rows[0];
  },
  
  // Ottieni utente per email
  getByEmail: async (email: string) => {
    const result = await db.query('SELECT * FROM utenti WHERE email = $1', [email]);
    return result.rows[0];
  },
  
  // Crea nuovo utente
  create: async (userData: any) => {
    const { id, email, nome, cognome, ...otherData } = userData;
    const result = await db.query(
      `INSERT INTO utenti (id, email, nome, cognome, created_at, updated_at, ${Object.keys(otherData).join(', ')})
       VALUES ($1, $2, $3, $4, NOW(), NOW(), ${Object.keys(otherData).map((_, i) => `$${i + 5}`).join(', ')})
       RETURNING *`,
      [id, email, nome, cognome, ...Object.values(otherData)]
    );
    return result.rows[0];
  },
  
  // Aggiorna utente
  update: async (id: string, updates: any) => {
    const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const result = await db.query(
      `UPDATE utenti SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...Object.values(updates)]
    );
    return result.rows[0];
  }
};

export const opinions = {
  // Ottieni tutte le opinioni
  getAll: async () => {
    const result = await db.query('SELECT * FROM opinioni ORDER BY created_at DESC');
    return result.rows;
  },
  
  // Ottieni opinione per ID
  getById: async (id: string) => {
    const result = await db.query('SELECT * FROM opinioni WHERE id = $1', [id]);
    return result.rows[0];
  },
  
  // Crea nuova opinione
  create: async (opinionData: any) => {
    const { id, ...otherData } = opinionData;
    const result = await db.query(
      `INSERT INTO opinioni (id, created_at, ${Object.keys(otherData).join(', ')})
       VALUES ($1, NOW(), ${Object.keys(otherData).map((_, i) => `$${i + 2}`).join(', ')})
       RETURNING *`,
      [id, ...Object.values(otherData)]
    );
    return result.rows[0];
  }
};

export const votes = {
  // Ottieni voti capo stato
  getCapoStato: async () => {
    const result = await db.query('SELECT * FROM voti_capo_stato ORDER BY timestamp DESC');
    return result.rows;
  },
  
  // Ottieni voti ministri
  getMinistri: async () => {
    const result = await db.query('SELECT * FROM voti_ministri ORDER BY timestamp DESC');
    return result.rows;
  },
  
  // Ottieni voti amnistia
  getAmnistia: async () => {
    const result = await db.query('SELECT * FROM voti_amnistia ORDER BY timestamp DESC');
    return result.rows;
  },
  
  // Ottieni voti grazia
  getGrazia: async () => {
    const result = await db.query('SELECT * FROM voti_grazia ORDER BY timestamp DESC');
    return result.rows;
  }
};

export const initiatives = {
  // Ottieni iniziative popolari
  getPopolari: async () => {
    const result = await db.query('SELECT * FROM iniziative_popolari ORDER BY created_at DESC');
    return result.rows;
  },
  
  // Ottieni ICE
  getICE: async () => {
    const result = await db.query('SELECT * FROM ice ORDER BY data_creazione DESC');
    return result.rows;
  },
  
  // Ottieni referendum
  getReferendum: async () => {
    const result = await db.query('SELECT * FROM referendum_abrogativi ORDER BY created_at DESC');
    return result.rows;
  }
};

export const elections = {
  // Ottieni elezioni
  getAll: async () => {
    const result = await db.query('SELECT * FROM elezioni ORDER BY created_at DESC');
    return result.rows;
  }
};

export const notifications = {
  // Ottieni notifiche utente
  getUserNotifications: async (userId: string) => {
    const result = await db.query(
      'SELECT * FROM notifiche_utente WHERE utente_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  },
  
  // Ottieni notifiche admin
  getAdminNotifications: async () => {
    const result = await db.query('SELECT * FROM admin_notifications ORDER BY created_at DESC');
    return result.rows;
  }
};

export default db;
