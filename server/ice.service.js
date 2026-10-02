import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

class ICEService {
  // Lista tutte le ICE
  static async listICE() {
    if (!pool) return [];
    try {
      const result = await pool.query('SELECT * FROM ice');
      return result.rows.map(row => ({ id: row.id, ...row }));
    } catch (error) {
      console.error('Error fetching ICEs:', error);
      return [];
    }
  }

  // Aggiunge una nuova ICE
  static async addICE({ nome, descrizione, dataInizio, dataFine, sitoWeb }) {
    if (!pool) return { success: false, error: 'Database non configurato' };
    try {
      const result = await pool.query(
        'INSERT INTO ice (nome, descrizione, data_inizio, data_fine, sito_web, quorum, data_creazione) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [nome, descrizione, dataInizio, dataFine, sitoWeb, 'pending', new Date().toISOString()]
      );
      return { success: true, id: result.rows[0].id };
    } catch (error) {
      console.error('Error adding ICE:', error);
      return { success: false, error: error.message };
    }
  }

  // Aggiorna il quorum di una ICE
  static async patchQuorum(id, quorum) {
    if (!pool) return { success: false, error: 'Database non configurato' };
    try {
      await pool.query('UPDATE ice SET quorum = $1 WHERE id = $2', [quorum, id]);
      return { success: true };
    } catch (error) {
      console.error('Error updating quorum:', error);
      return { success: false, error: error.message };
    }
  }

  // Modifica una ICE
  static async updateICE(id, { nome, descrizione, dataInizio, dataFine, sitoWeb }) {
    if (!pool) return { success: false, error: 'Database non configurato' };
    try {
      await pool.query(
        'UPDATE ice SET nome = $1, descrizione = $2, data_inizio = $3, data_fine = $4, sito_web = $5 WHERE id = $6',
        [nome, descrizione, dataInizio, dataFine, sitoWeb, id]
      );
      return { success: true };
    } catch (error) {
      console.error('Error updating ICE:', error);
      return { success: false, error: error.message };
    }
  }

  // Elimina una ICE
  static async deleteICE(id) {
    if (!pool) return { success: false, error: 'Database non configurato' };
    try {
      await pool.query('DELETE FROM ice WHERE id = $1', [id]);
      return { success: true };
    } catch (error) {
      console.error('Error deleting ICE:', error);
      return { success: false, error: error.message };
    }
  }
}

export default ICEService; 